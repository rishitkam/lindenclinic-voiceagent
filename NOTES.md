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

## Tuning decisions
- **Speech-to-text streams** (`ElevenLabsRealtimeSTTService`, manual commit on Pipecat's VAD signal), so the transcript is ready as soon as the caller stops. Doctor surnames are passed as `keyterms`. `STT_MODE=segmented` switches back to the upload-per-utterance service.
- **Turn detection:** Silero VAD with `stop_secs=0.5` plus Pipecat's default Smart Turn v3 model. 0.2 s was tried and cut callers off mid phone number ("999-709-" / "4849" became two turns), so it was raised.
- **Phone numbers are handled in code, not by the LLM.** The model miscounted digits in a live call. Now it passes the raw words to the tool with `phone_confirmed=false`; `phone.extract_digits` counts them and the tool returns either `read_back` or `digits_heard` for an incomplete number. Parts said across turns are joined by the model.
- **Filler speech:** on `on_function_calls_started` a short phrase ("Let me check.") is pushed as a `TTSSpeakFrame` (not added to context), because OpenAI models usually emit tool calls without text.
- **Voice:** ElevenLabs default voice (free plan refuses Voice Library voices via the API), `stability=0.4`, `similarity_boost=0.8`, `speed=1.05`.
- **LLM:** `LLM_PROVIDER=openai` with `gpt-4.1-mini` (cheap, reliable tool calling, output capped at 300 tokens) or `gemini`.
- **Measured on a live call:** STT ~0.5 s, LLM first token 0.7–1.0 s, TTS first audio ~0.2 s.
- **Setup errors** (missing keys) are reported by `/api/health` and shown in the phone instead of ringing.
