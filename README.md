# Linden: voice appointment desk

Voice agent that checks doctor availability, books and cancels appointments, identifying callers only by the phone number they say. Dashboard shows doctors, slots, appointments, live transcript and agent activity.

**LLM:** OpenAI `gpt-4.1-mini` (or Google Gemini `gemini-2.5-flash` on the free tier; set `LLM_PROVIDER` in `server/.env`) · **STT/TTS:** ElevenLabs (Scribe / Flash v2.5) · **Voice framework:** Pipecat (SmallWebRTC transport, Silero VAD) · **Data:** SQLite mock data

## Run locally
Requirements: Python 3.12, Node 20+, an OpenAI API key (or a free Gemini key), an ElevenLabs API key with **Speech to Text** and **Text to Speech** permissions.

Notes:
- On the ElevenLabs free plan, `ELEVENLABS_VOICE_ID` must be a **default** voice (Voice Library voices are refused via the API). `.env.example` ships a default one.
- Open the dashboard in Chrome and allow the microphone. If a key is missing, the phone screen names it.

```bash
cd server
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in OPENAI_API_KEY and ELEVENLABS_API_KEY
uvicorn app.main:app --port 7860
```
```bash
cd web
npm install
npm run dev            # open http://localhost:5173
```
Reset demo data: `python -m app.seed --reset` (or "Reset data" in the footer). Demo number with an existing booking: 98765 43210.

## Features
- Voice agent with `check_doctor_availability`, `book_appointment`, `cancel_appointment` (Pipecat function calling)
- Number read back digit by digit and confirmed before booking or cancelling (enforced in code, not just the prompt)
- Dashboard: doctors with live slots per day, appointments, agent activity log, all updated in real time
- Phone-style call screen: ringing, connected, ended; caller name, timer, mute, end call, live transcript, voice waveform, booking confirmation card, ring and end-call sounds
- Rows and slots highlight when the agent books or cancels; mobile layout; reduced-motion support
- Silero VAD for turn detection and barge-in

## How it works
Browser ⇄ WebRTC ⇄ Pipecat pipeline (Silero VAD → ElevenLabs STT → OpenAI gpt-4.1-mini with three tools → ElevenLabs TTS). Tools read and write SQLite; each tool call also goes out on a Server-Sent Events stream that the dashboard listens to. See [PIPELINE.md](PIPELINE.md).

The caller is identified only by the phone number they say. `book_appointment` and `cancel_appointment` refuse to run unless `phone_confirmed` is true, so the agent must read the number back first. Cancelling is two steps: the first call lists the caller's appointments, the second (with `appointment_id`) cancels after the caller confirms.

## Project layout
```
server/app/
  config.py      env, paths, timezone
  timeutil.py    clinic-local time + spoken dates/times
  phone.py       parse spoken phone numbers ("double nine", "+91 ...")
  db.py          SQLite schema, transactions
  seed.py        mock doctors, slots, appointments (python -m app.seed --reset)
  repository.py  all SQL queries
  tools.py       the three tools + Pipecat registration
  prompts.py     system prompt (built per call with today's dates)
  events.py      in-process pub/sub for SSE
  bot.py         Pipecat pipeline
  main.py        FastAPI: REST, SSE, WebRTC signalling
web/src/
  hooks/useCall.ts        call lifecycle + live transcript
  hooks/useClinicData.ts  REST + SSE, row highlights
  components/             TopBar, DoctorsPanel, AppointmentsPanel, ActivityLog, PhoneCall, ...
```

## Tests
`cd server && pytest`
