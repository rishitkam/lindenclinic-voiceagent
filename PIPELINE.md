# Linden: how the voice pipeline works

## The flow (Its one call)

```mermaid
flowchart TD
    A["You speak in the browser"]
    B["ElevenLabs transcribes it live, while you're still talking"]
    C["GPT-4.1 mini / Gemini reads it and decides what to do"]
    D["Tools hit a SQLite database of mock doctors and slots<br/>check_doctor_availability<br/>book_appointment<br/>cancel_appointment"]
    E["ElevenLabs speaks the reply back to you"]
    F["The dashboard updates live (rows flash, slot turns booked)"]

    A -- "audio over WebRTC (Pipecat, peer to peer)" --> B
    B -- "Silero VAD + Smart Turn decide you've actually finished" --> C
    C -- "if it needs the schedule, it calls a tool" --> D
    D --> E
    E -- "at the same time" --> F
```

## The bits I'm proud of

- **Your phone number is your ID.** No login. Asha reads it back digit by digit and only books after you say yes. The code enforces this too, not just the prompt.
- **The model never counts digits.** It got a 10 digit number wrong once, so now the code extracts the digits and hands back the exact read-back.
- **No double bookings.** A database rule allows only one active booking per slot.
- **No awkward silence.** While it looks something up, it says "One moment."

## What I'd do next

Real phone calls (Twilio), Multilingual support, SMS reminders, and Postgres instead of SQLite.
