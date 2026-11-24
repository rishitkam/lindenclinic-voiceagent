"""The voice pipeline: mic audio -> STT -> LLM(+tools) -> TTS -> speaker audio.

Written against pipecat-ai 1.17. Silero VAD lives in the user context aggregator;
RTVI (transcripts + bot-ready for the browser) is added automatically by PipelineWorker.
"""
import aiohttp
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from . import events
from .config import env, require_env
from .prompts import build_system_prompt
from .tools import TOOLS, register_tools


async def run_bot(webrtc_connection) -> None:
    async with aiohttp.ClientSession() as http:
        transport = SmallWebRTCTransport(
            webrtc_connection=webrtc_connection,
            params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
        )

        stt = ElevenLabsSTTService(
            api_key=require_env("ELEVENLABS_API_KEY"),
            aiohttp_session=http,
            settings=ElevenLabsSTTService.Settings(language=Language.EN),
        )
        tts = ElevenLabsTTSService(
            api_key=require_env("ELEVENLABS_API_KEY"),
            settings=ElevenLabsTTSService.Settings(
                voice=require_env("ELEVENLABS_VOICE_ID"),
                model=env("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5"),
            ),
        )
        llm = GoogleLLMService(
            api_key=require_env("GOOGLE_API_KEY"),
            settings=GoogleLLMService.Settings(model=env("GEMINI_MODEL", "gemini-2.5-flash")),
        )
        register_tools(llm)

        context = LLMContext(messages=[{"role": "system", "content": build_system_prompt()}], tools=TOOLS)
        aggregators = LLMContextAggregatorPair(
            context,
            # Silero VAD decides when the caller started/stopped speaking (bonus requirement).
            user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.6))),
        )

        pipeline = Pipeline([
            transport.input(),
            stt,
            aggregators.user(),
            llm,
            tts,
            transport.output(),
            aggregators.assistant(),
        ])
        task = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=True, enable_usage_metrics=True))

        @task.rtvi.event_handler("on_client_ready")
        async def on_client_ready(_rtvi):
            # PipelineWorker already calls set_bot_ready(); we just make the agent greet.
            await task.queue_frames([LLMRunFrame()])

        @transport.event_handler("on_client_connected")
        async def on_client_connected(_transport, _client):
            logger.info("call connected")
            events.publish({"type": "call.started"})

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(_transport, _client):
            logger.info("call ended")
            events.publish({"type": "call.ended"})
            await task.cancel()

        await WorkerRunner(handle_sigint=False).run(task)
