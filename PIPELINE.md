# Pipeline

> Draft. Rewrite this in your own words before submitting.

The browser connects to a Python server over WebRTC using Pipecat's peer-to-peer SmallWebRTC transport, so no third-party room service is needed. Caller audio is streamed to ElevenLabs Scribe realtime speech-to-text, which transcribes while the caller is still talking. Silero VAD detects speech, and Pipecat's Smart Turn model decides when the caller has actually finished (a 0.5 s pause, so a pause in the middle of a phone number doesn't end the turn). The finished text goes to OpenAI gpt-4.1-mini, which has three tools: check availability, book and cancel. The tools run against a SQLite database of mock doctors and 30-minute slots.

The phone number is the only identity. The model never counts digits itself: it passes what the caller said to the tool, the code extracts the digits (handling "double nine", "+91", numbers split across turns) and returns the exact read-back. Booking or cancelling only goes through once the tool is called again with `phone_confirmed` true, after the caller says yes; the code refuses otherwise. While a tool runs, a short "One moment." is spoken so there is no dead air. The model's reply goes to ElevenLabs TTS (Flash v2.5) and streams back to the browser.

Separately, every tool call publishes an event on a Server-Sent Events stream (`/api/events`). That is how the dashboard refreshes and highlights rows in real time, and how the phone shows the booking card.

```
mic ─► WebRTC ─► ElevenLabs realtime STT + Silero VAD / Smart Turn ─► gpt-4.1-mini (+ tools ─► SQLite) ─► ElevenLabs TTS ─► WebRTC ─► speaker
                                                        └─► SSE events ─► dashboard
```
