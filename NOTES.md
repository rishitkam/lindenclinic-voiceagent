# Implementation notes

- Built against **pipecat-ai 1.17.0** and `@pipecat-ai/client-js` 1.17 / `client-react` 1.12 / `small-webrtc-transport` 1.11.
- Differences from HANDOFF_PLAN.md caused by the newer Pipecat:
  - Silero VAD is passed to `LLMUserAggregatorParams(vad_analyzer=...)`, not `TransportParams`.
  - RTVI is added automatically by `PipelineWorker` (which also calls `set_bot_ready()`); we only hook `task.rtvi` `on_client_ready` to start the greeting.
  - `PipelineTask`/`PipelineRunner` are deprecated → `PipelineWorker` / `WorkerRunner`.
  - Services take `settings=Service.Settings(...)` (model, voice, language); `ElevenLabsSTTService` needs an `aiohttp_session`.
  - Signalling uses Pipecat's `SmallWebRTCRequestHandler` (POST + PATCH `/api/offer` for trickle ICE).
  - Tool schemas import from `pipecat.adapters.llm.schemas.*`.
  - Browser transcript uses `RTVIEvent.BotOutput` (sentence segments) since `BotTranscript` is deprecated.
- A call that never gets "bot ready" gives up after 20 s with an error in the phone.
