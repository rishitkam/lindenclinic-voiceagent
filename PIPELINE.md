# Pipeline

> Draft. Rewrite this in your own words before submitting.

The browser connects to a Python server over WebRTC using Pipecat's peer-to-peer SmallWebRTC transport, so no third-party room service is needed. Incoming audio goes through Silero VAD, which decides when the caller has stopped talking; that segment is sent to ElevenLabs Scribe for transcription. The text is added to the conversation context and sent to OpenAI gpt-4.1-mini, which has three tools: check availability, book and cancel. The tools run against a SQLite database of mock doctors and 30-minute slots. Booking and cancelling need the phone number plus a `phone_confirmed` flag, so the model has to read the number back and get a yes first; the code refuses otherwise. The model's reply goes to ElevenLabs TTS (Flash v2.5) and streams back to the browser.

Separately, every tool call publishes an event on a Server-Sent Events stream (`/api/events`). That is how the dashboard refreshes and highlights rows in real time, and how the phone shows the booking card.

```
mic ─► WebRTC ─► Silero VAD ─► ElevenLabs STT ─► gpt-4.1-mini (+ tools ─► SQLite) ─► ElevenLabs TTS ─► WebRTC ─► speaker
                                                        └─► SSE events ─► dashboard
```
