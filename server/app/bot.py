"""The voice pipeline: mic audio -> STT -> LLM(+tools) -> TTS -> speaker audio.

Written against pipecat-ai 1.17. Silero VAD lives in the user context aggregator;
RTVI (transcripts + bot-ready for the browser) is added automatically by PipelineWorker.
"""
import aiohttp
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
import random

from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService, ElevenLabsSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from . import events
from . import repository as repo
from .config import env, require_env
from .prompts import build_system_prompt
from .tools import TOOLS, register_tools


def make_llm():
    """LLM_PROVIDER=gemini (free tier, default) or openai (paid, gpt-4.1-mini by default)."""
    provider = env("LLM_PROVIDER", "gemini").lower()
    if provider == "openai":
        from pipecat.services.openai.llm import OpenAILLMService

        model = env("OPENAI_MODEL", "gpt-4.1-mini")
        logger.info(f"LLM: OpenAI {model}")
        return OpenAILLMService(
            api_key=require_env("OPENAI_API_KEY"),
            # Short spoken replies: cap output so a runaway answer can't burn credit.
            settings=OpenAILLMService.Settings(model=model, max_completion_tokens=300),
        )
    model = env("GEMINI_MODEL", "gemini-2.5-flash")
    logger.info(f"LLM: Gemini {model}")
    return GoogleLLMService(api_key=require_env("GOOGLE_API_KEY"), settings=GoogleLLMService.Settings(model=model))


def make_stt(http):
    """Streaming speech-to-text by default: words are transcribed while the caller talks, so the
    final text is ready almost as soon as they stop. STT_MODE=segmented falls back to uploading
    each finished utterance (slower, but simpler)."""
    key = require_env("ELEVENLABS_API_KEY")
    if env("STT_MODE", "realtime") == "segmented":
        return ElevenLabsSTTService(api_key=key, aiohttp_session=http, settings=ElevenLabsSTTService.Settings(language=Language.EN))
    # Doctor surnames are unusual words; listing them helps the recogniser spell them right.
    surnames = [d["name"].split()[-1] for d in repo.list_doctors()]
    return ElevenLabsRealtimeSTTService(
        api_key=key,
        settings=ElevenLabsRealtimeSTTService.Settings(language=Language.EN, keyterms=surnames),
    )


async def run_bot(webrtc_connection) -> None:
    async with aiohttp.ClientSession() as http:
        transport = SmallWebRTCTransport(
            webrtc_connection=webrtc_connection,
            params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
        )

        stt = make_stt(http)
        tts = ElevenLabsTTSService(
            api_key=require_env("ELEVENLABS_API_KEY"),
            settings=ElevenLabsTTSService.Settings(
                voice=require_env("ELEVENLABS_VOICE_ID"),
                model=env("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5"),
                # A little less "stability" = more natural intonation; slightly brisker pace.
                stability=0.4,
                similarity_boost=0.8,
                use_speaker_boost=True,
                speed=1.05,
            ),
        )
        llm = make_llm()
        register_tools(llm)

        # Fill the short silence while a tool runs (checking slots, booking), like a person would.
        fillers = {
            "check_doctor_availability": ["Let me check.", "One moment.", "Sure, let me look."],
            "book_appointment": ["One moment.", "Just a second."],  # may only be a read-back check
            "cancel_appointment": ["Let me pull that up.", "One moment."],
        }

        @llm.event_handler("on_function_calls_started")
        async def on_function_calls_started(service, function_calls):
            phrase = random.choice(fillers.get(function_calls[0].function_name, ["One moment."]))
            # Not added to the LLM's context, so it doesn't confuse the conversation history.
            await service.push_frame(TTSSpeakFrame(phrase, append_to_context=False))

        context = LLMContext(messages=[{"role": "system", "content": build_system_prompt()}], tools=TOOLS)
        aggregators = LLMContextAggregatorPair(
            context,
            # Silero VAD detects speech (bonus requirement). Pipecat's Smart Turn model then decides
            # whether the caller has actually finished, so a short silence threshold is safe and
            # still keeps the wait short. 0.5s (not 0.2s) so a caller pausing mid phone number isn't cut off.
            user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.5))),
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
