# HANDOFF PLAN, Voice AI Doctor Appointment Assistant

> **Read this whole file before writing any code.** It is the single source of truth.
> Source brief: `SDE_Intern_Round1_Assignment.pdf` (same folder).
> **Deadline: Wednesday 25 November 2026, 11:00 PM IST.** Core requirements first, bonuses after.
> Everything here is **free**: Gemini free tier, ElevenLabs free plan, Pipecat's peer‑to‑peer WebRTC (no Daily/LiveKit account), SQLite, localhost.

---

## 0. How to use this document (rules for the implementing AI)

1. Work **phase by phase** (Section 9). Do not start a phase until the previous phase's **Checkpoint** passes.
2. Code blocks marked **`EXACT`** are version‑independent: copy them as written.
   Code blocks marked **`REFERENCE, VERIFY`** touch Pipecat / Pipecat‑client APIs that change between versions. Before using them, run the **Verification protocol (Section 8)** and adapt *only* import paths / class names / argument names, never the behaviour.
3. Do not invent features, rename files, rename tools, or change the stack. If something in this plan is impossible, stop and write down why in `NOTES.md`, then pick the closest option that keeps behaviour identical.
4. Never print, log, or commit API keys. Never commit `.env`.
5. ElevenLabs free credits are small. **Test all logic with pytest first (no keys needed).** Only make real voice calls once Phases 1–4 pass.
6. Keep the user (a student who must *explain every line* in an interview) in mind: simple, readable code, short functions, comments only where something is non‑obvious.

---

## 1. What we are building (one paragraph)

A browser dashboard for a fictional clinic ("**Linden Clinic**"). The user clicks **Try call**; a phone‑style screen pops up, rings, and connects to a voice agent ("**Asha**"). The caller speaks; audio streams over WebRTC to a Python **Pipecat** pipeline: **Silero VAD → ElevenLabs STT → Gemini LLM (with 3 tools) → ElevenLabs TTS** → audio back to the browser. The agent can **check doctor availability, book, and cancel**. The caller is identified **only by the phone number they say**, which the agent **reads back digit by digit and gets a "yes" before booking/cancelling**. Data is mock data in **SQLite**. The dashboard shows doctors + slots, appointments, a live transcript, and a live "agent activity" log, all updating in real time when the agent books/cancels.

---

## 2. Requirement → where it is satisfied (Definition of Done)

| # | Requirement (from PDF) | Implemented in | Verified by |
|---|---|---|---|
| R1 | Pipecat pipeline: audio → STT → LLM → TTS → audio | `server/app/bot.py` | Phase 5 checkpoint |
| R2 | STT = ElevenLabs | `ElevenLabsSTTService` in `bot.py` | server logs show STT transcripts |
| R3 | TTS = ElevenLabs | `ElevenLabsTTSService` in `bot.py` | you hear the voice |
| R4 | LLM with free usage (Gemini) | `GoogleLLMService` in `bot.py` | README states model |
| R5 | Tools registered in pipeline: `check_doctor_availability`, `book_appointment`, `cancel_appointment` (exact names) | `server/app/tools.py` + `llm.register_function` | pytest + live call |
| R6 | Caller identified only by spoken phone number; no login/OTP/caller‑ID | `phone.py`, tools, prompt | live call |
| R7 | Agent reads number back & confirms before booking/cancelling | prompt + `phone_confirmed` guard in tools | pytest `PHONE_NOT_CONFIRMED` + live call |
| R8 | Mock doctors/specialities/slots (SQLite) | `db.py`, `seed.py` | `/api/doctors` |
| R9 | All three actions end‑to‑end in one conversation, natural speech | prompt | QA script Q1–Q3 |
| R10 | Dashboard: start/end call from browser | `PhoneCall.tsx`, `useCall.ts` | manual |
| R11 | Live transcript | `useCall.ts` + `Transcript.tsx` | manual |
| R12 | Doctors and their available slots | `DoctorsPanel.tsx` | manual |
| R13 | Appointments list updates after book/cancel | SSE `/api/events` + `useClinicData.ts` | manual |
| R14 | Professional, non‑generic look, minimal wording | Section 7 design spec | self‑review checklist 7.9 |
| B1 | Bonus: Silero VAD | `bot.py` transport params | logs |
| B2 | Bonus: phone‑style call screen (ringing → connected → ended, name, timer, mute, end, transcript inside) | `PhoneCall.tsx` | manual |
| B3 | Bonus: waveform, transitions, booking card in phone, row highlight, ring/end sounds, mobile layout | Section 7 | manual |
| S1 | GitHub repo, README (how to run + which LLM), `.env.example`, no keys | Phase 9 | checklist 10 |
| S2 | ≤3 min video of one booking flow | Section 11 script | user records |
| S3 | Short honest pipeline description | `PIPELINE.md` | user rewrites in own words |

---

## 3. Tech stack (fixed, do not change)

| Layer | Choice | Why |
|---|---|---|
| Python | **3.12** (not 3.13/3.14, some audio wheels lag) | stability |
| Voice framework | **pipecat-ai** (latest at install time, then frozen) with extras `google,elevenlabs,silero,webrtc` | required |
| Transport | **Pipecat SmallWebRTC** (peer‑to‑peer WebRTC, runs locally) | free, no third‑party account |
| VAD | **Silero** (`SileroVADAnalyzer`) | bonus + needed to segment speech for STT |
| STT | **ElevenLabs Scribe** via `ElevenLabsSTTService` (segmented, VAD‑driven). Optional upgrade: `ElevenLabsRealtimeSTTService` if present | required |
| LLM | **Google Gemini** via `GoogleLLMService`, model from env, default `gemini-2.5-flash` | free tier |
| TTS | **ElevenLabs** via `ElevenLabsTTSService`, model `eleven_flash_v2_5` (lowest latency, cheapest) | required |
| Web server | **FastAPI + uvicorn**, same process as the bot | simple |
| DB | **SQLite** via Python stdlib `sqlite3` (no ORM) | free, explainable |
| Realtime dashboard updates | **Server‑Sent Events** (`/api/events`) | trivial, one‑way, no extra libs |
| Frontend | **React 18 + Vite + TypeScript**, plain CSS with CSS variables (no Tailwind, no UI kit) | full control over look |
| Frontend voice client | `@pipecat-ai/client-js`, `@pipecat-ai/client-react`, `@pipecat-ai/small-webrtc-transport` | official |
| Animation | `motion` (Framer Motion's package) | smooth state transitions |
| Fonts | `@fontsource/instrument-serif`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` (self‑hosted, free) | non‑generic look |
| Tests | `pytest` | logic without voice credits |

Ports: **server 7860**, **web 5173** (Vite proxies `/api` → 7860, so no CORS issues).

---

## 4. Architecture

### 4.1 Diagram

```
 Browser (React, :5173)                                   Python process (FastAPI + Pipecat, :7860)
┌──────────────────────────────────────┐                ┌────────────────────────────────────────────────────────┐
│ Dashboard                            │  GET /api/doctors, /api/appointments  ┌───────────────┐               │
│  ├ DoctorsPanel  ◄───────────────────┼────────────────┼──────────────────────►│ repository.py │◄──► SQLite     │
│  ├ AppointmentsPanel                 │                │                       └──────▲────────┘   data/clinic.db│
│  ├ ActivityLog                       │  SSE /api/events (booked/cancelled/tool)       │                        │
│  │      ▲────────────────────────────┼────────────────┼──── events.py (pub/sub) ◄────┤                        │
│  └ PhoneCall (overlay)               │                │                               │                        │
│      PipecatClient                   │ POST/PATCH /api/offer (SDP signalling)         │                        │
│      SmallWebRTCTransport ───────────┼────────────────┼──► SmallWebRTCConnection      │                        │
│        mic audio  ═══════════════════╪═══ WebRTC ═════╪══► Pipeline:                  │                        │
│        bot audio  ◄══════════════════╪════════════════╪═══  transport.input()         │                        │
│        RTVI data channel (transcript,│                │     → RTVIProcessor           │                        │
│          bot-ready)  ◄───────────────┼────────────────┼──   → ElevenLabs STT          │                        │
└──────────────────────────────────────┘                │     → user context aggregator │                        │
                                                        │     → Gemini LLM ──tools──► tools.py ─────────────────┘
                                                        │     → ElevenLabs TTS                                   │
                                                        │     → transport.output()                               │
                                                        │     → assistant context aggregator                     │
                                                        └────────────────────────────────────────────────────────┘
```

### 4.2 Two channels, two jobs (important, do not mix them)

* **WebRTC (audio + RTVI data channel):** audio both ways, plus transcript events and "bot ready". Owned by Pipecat; we only consume its client callbacks.
* **SSE `/api/events`:** *our* app events, `appointment.booked`, `appointment.cancelled`, `tool`, `call.started`, `call.ended`, `data.reset`. Emitted by `tools.py`/`bot.py`, consumed by the dashboard *and* the phone (booking card). This works even if RTVI APIs change, which is why data updates do **not** go over RTVI.

### 4.3 Call sequence

```
User clicks "Try call"
 → UI state = ringing, ring sound starts, mic permission requested
 → client.connect() → POST /api/offer (SDP) → server creates SmallWebRTCConnection, starts run_bot() in background
 → WebRTC connects → RTVI "client-ready" → server: set_bot_ready() + run LLM once (greeting)
 → client gets BotReady → (after ≥1.6 s of ringing) UI state = connected, timer starts, connect chime
 → loop: user speaks → VAD detects end → STT text → LLM → (maybe tool call → result → LLM) → TTS audio
         transcript lines appear via RTVI callbacks; tool calls publish SSE events → dashboard refreshes + flashes rows
 → user clicks End (or bot hangs up) → client.disconnect() → server on_client_disconnected → task.cancel()
 → UI state = ended (end tone, shows duration) → after 2.2 s overlay closes → idle
```

### 4.4 Conversation flow (what the agent does)

```
Greet ("Linden Clinic, this is Asha. How can I help?")
 ├─ Availability question → check_doctor_availability(doctor_name|speciality, date?) → offer ≤3 times
 ├─ Book:
 │    1. know doctor + slot (from a check_doctor_availability result in THIS call)
 │    2. ask name (once; optional) and phone number
 │    3. read phone back digit by digit in groups ("9 8 7 6 5, 4 3 2 1 0, is that right?")
 │    4. caller says yes → book_appointment(slot_id, patient_name, phone, phone_confirmed=true)
 │       caller says no → ask again, repeat step 3
 │    5. confirm doctor, day, time out loud
 ├─ Cancel:
 │    1. ask phone → read back → yes
 │    2. cancel_appointment(phone, phone_confirmed=true)  (no appointment_id) → tool returns the caller's
 │       upcoming appointments with status CONFIRM_WHICH
 │    3. agent: "I see Dr. Malhotra, tomorrow at 11 AM. Cancel that one?" → yes
 │    4. cancel_appointment(phone, phone_confirmed=true, appointment_id="APT-XXXX") → done
 └─ "Anything else?" → goodbye
```

The **two‑step cancel inside one tool** is deliberate: it forces the agent to confirm *which* appointment without adding a fourth tool.

---

## 5. Repository layout (create exactly this)

```
nexovai/
├── .gitignore
├── README.md
├── PIPELINE.md
├── NOTES.md                      # implementer notes: versions, deviations (keep short)
├── SDE_Intern_Round1_Assignment.pdf
├── HANDOFF_PLAN.md               # this file
├── server/
│   ├── .env.example
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── app/
│   │   ├── __init__.py           # empty
│   │   ├── config.py             # env + paths + timezone
│   │   ├── timeutil.py           # now(), parsing, spoken formats
│   │   ├── phone.py              # normalize + speak phone numbers
│   │   ├── db.py                 # schema, connections, transactions, id generator
│   │   ├── seed.py               # mock doctors/slots/appointments (+ CLI)
│   │   ├── repository.py         # ALL SQL queries; returns plain dicts
│   │   ├── events.py             # in‑process pub/sub for SSE
│   │   ├── tools.py              # tool logic (pure) + Pipecat schemas/registration
│   │   ├── prompts.py            # system prompt builder
│   │   ├── bot.py                # Pipecat pipeline (run_bot)
│   │   └── main.py               # FastAPI app: REST, SSE, WebRTC signalling
│   ├── data/                     # clinic.db created at runtime (gitignored)
│   └── tests/
│       ├── conftest.py
│       ├── test_phone.py
│       ├── test_timeutil.py
│       ├── test_repository.py
│       └── test_tools.py
└── web/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types.ts
        ├── lib/
        │   ├── api.ts
        │   ├── format.ts
        │   └── sounds.ts
        ├── hooks/
        │   ├── useClinicData.ts
        │   ├── useCall.ts
        │   └── useCallTimer.ts
        ├── components/
        │   ├── TopBar.tsx
        │   ├── DoctorsPanel.tsx
        │   ├── AppointmentsPanel.tsx
        │   ├── ActivityLog.tsx
        │   ├── PhoneCall.tsx
        │   ├── Transcript.tsx
        │   ├── Waveform.tsx
        │   └── ConfirmationCard.tsx
        └── styles/
            ├── tokens.css
            └── app.css
```

---

## 6. Backend, detailed spec and code

### 6.1 `server/requirements.txt` (EXACT)

```
pipecat-ai[google,elevenlabs,silero,webrtc]
fastapi
uvicorn[standard]
python-dotenv
loguru
tzdata
pytest
```

After the first successful install **and** a working call, replace this file's lines with exact pins from `pip freeze` for these packages (e.g. `pipecat-ai[...]==X.Y.Z`) and record the Pipecat version in `NOTES.md`. Never upgrade during the build.

Optional dev helper (only if it installs cleanly): `pipecat-ai-small-webrtc-prebuilt`, gives a ready test UI to verify the bot before the React app exists (Phase 5).

### 6.2 `server/.env.example` (EXACT)

```
# Google AI Studio key (free): https://aistudio.google.com/apikey
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# ElevenLabs key (free plan). Key needs Speech-to-Text AND Text-to-Speech permissions.
ELEVENLABS_API_KEY=
# Any voice ID from your ElevenLabs "My Voices"/default voices list
ELEVENLABS_VOICE_ID=
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5

CLINIC_TZ=Asia/Kolkata
```

### 6.3 `.gitignore` (EXACT, repo root, create BEFORE `git init`/first commit)

```
.env
*.env
!.env.example
.venv/
__pycache__/
*.pyc
.pytest_cache/
server/data/*.db
server/data/*.db-*
node_modules/
web/dist/
.DS_Store
```

### 6.4 `server/pytest.ini` (EXACT)

```ini
[pytest]
testpaths = tests
pythonpath = .
```

### 6.5 `app/config.py` (EXACT)

```python
"""Configuration: paths, timezone, and API keys read from server/.env."""
import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

SERVER_DIR = Path(__file__).resolve().parent.parent
load_dotenv(SERVER_DIR / ".env")

TZ = ZoneInfo(os.getenv("CLINIC_TZ", "Asia/Kolkata"))
DB_PATH = Path(os.getenv("DB_PATH", str(SERVER_DIR / "data" / "clinic.db")))
CLINIC_NAME = "Linden Clinic"
AGENT_NAME = "Asha"
DAYS_AHEAD = 7  # how many days of slots exist / are shown


def require_env(name: str) -> str:
    """Read a required env var, failing with a clear message (keys are only needed for calls)."""
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing {name}. Copy server/.env.example to server/.env and fill it in.")
    return value


def env(name: str, default: str) -> str:
    return os.getenv(name, default).strip() or default
```

### 6.6 `app/timeutil.py` (EXACT)

All datetimes in the app are **naive clinic‑local** datetimes, stored as text `YYYY-MM-DDTHH:MM`. Text in that format sorts correctly, so SQL `<`/`>` comparisons work.

```python
"""Time helpers. Everything is naive local clinic time (Asia/Kolkata by default)."""
from datetime import date, datetime, timedelta

from .config import TZ

FMT = "%Y-%m-%dT%H:%M"
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class DateParseError(ValueError):
    pass


def now_local() -> datetime:
    return datetime.now(TZ).replace(tzinfo=None, second=0, microsecond=0)


def to_text(dt: datetime) -> str:
    return dt.strftime(FMT)


def from_text(text: str) -> datetime:
    return datetime.strptime(text, FMT)


def spoken_time(dt: datetime) -> str:
    hour = dt.hour % 12 or 12
    suffix = "AM" if dt.hour < 12 else "PM"
    return f"{hour} {suffix}" if dt.minute == 0 else f"{hour}:{dt.minute:02d} {suffix}"


def spoken_date(d: date, today: date | None = None) -> str:
    today = today or now_local().date()
    base = f"{d.strftime('%A')} {d.day} {d.strftime('%B')}"   # no %-d: breaks on Windows
    if d == today:
        return f"today, {base}"
    if d == today + timedelta(days=1):
        return f"tomorrow, {base}"
    return base


def spoken_datetime(dt: datetime, today: date | None = None) -> str:
    return f"{spoken_date(dt.date(), today)} at {spoken_time(dt)}"


def parse_date_arg(text: str, today: date) -> date:
    """Accept 'YYYY-MM-DD', 'today', 'tomorrow', or a weekday name (next occurrence, today counts)."""
    t = text.strip().lower()
    if t == "today":
        return today
    if t == "tomorrow":
        return today + timedelta(days=1)
    for i, name in enumerate(WEEKDAYS):
        if name in t:
            return today + timedelta(days=(i - today.weekday()) % 7)
    try:
        return date.fromisoformat(t[:10])
    except ValueError as exc:
        raise DateParseError(f"Could not understand the date '{text}'. Use YYYY-MM-DD.") from exc
```

### 6.7 `app/phone.py` (EXACT)

STT may give `"98765 43210"`, `"+91 98765-43210"`, `"nine eight seven…"`, or Indian‑style `"double nine"`. All must work.

```python
"""Phone number normalisation. The phone number is the ONLY caller identity."""
import re

_WORDS = {
    "zero": "0", "oh": "0", "o": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}
_REPEAT = {"double": 2, "triple": 3}


def normalize_phone(raw) -> str | None:
    """Return a 10-digit string, or None if the input is not a valid number."""
    if raw is None:
        return None
    tokens = re.findall(r"[a-z]+|\d", str(raw).lower())
    digits: list[str] = []
    repeat = 1
    for tok in tokens:
        if tok in _REPEAT:
            repeat = _REPEAT[tok]
            continue
        digit = tok if tok.isdigit() else _WORDS.get(tok)
        if digit is not None:
            digits.append(digit * repeat)
        repeat = 1
    number = "".join(digits)
    if len(number) == 12 and number.startswith("91"):
        number = number[2:]
    elif len(number) == 11 and number.startswith("0"):
        number = number[1:]
    return number if len(number) == 10 else None


def spoken_phone(number: str) -> str:
    """'9876543210' -> '9 8 7 6 5, 4 3 2 1 0' (TTS reads it digit by digit with a pause)."""
    return f"{' '.join(number[:5])}, {' '.join(number[5:])}"


def display_phone(number: str) -> str:
    """'9876543210' -> '98765 43210' (for the dashboard)."""
    return f"{number[:5]} {number[5:]}"
```

### 6.8 `app/db.py` (EXACT)

Design decision: **a slot is "available" iff it is in the future and has no appointment with status `booked`.** There is no `is_booked` column, one source of truth, impossible to get out of sync. A partial unique index makes double‑booking impossible even under races.

```python
"""SQLite schema and connection helpers. One short-lived connection per operation."""
import secrets
import sqlite3
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS doctors (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    speciality       TEXT NOT NULL,
    room             TEXT NOT NULL,
    experience_years INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS slots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id    TEXT NOT NULL REFERENCES doctors(id),
    starts_at    TEXT NOT NULL,              -- 'YYYY-MM-DDTHH:MM', clinic local time
    duration_min INTEGER NOT NULL DEFAULT 30,
    UNIQUE (doctor_id, starts_at)
);
CREATE TABLE IF NOT EXISTS appointments (
    id           TEXT PRIMARY KEY,           -- e.g. 'APT-7K3Q'
    slot_id      INTEGER NOT NULL REFERENCES slots(id),
    patient_name TEXT NOT NULL,
    phone        TEXT NOT NULL,              -- 10 digits
    status       TEXT NOT NULL CHECK (status IN ('booked', 'cancelled')),
    created_at   TEXT NOT NULL,
    cancelled_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_slot
    ON appointments(slot_id) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone);
"""

_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion when spoken


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)  # we manage transactions
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def read():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaction():
    """BEGIN IMMEDIATE takes the write lock up front, so check-then-insert is race-free."""
    conn = connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def init_schema() -> None:
    with read() as conn:
        conn.executescript(SCHEMA)


def new_appointment_id(conn: sqlite3.Connection) -> str:
    while True:
        candidate = "APT-" + "".join(secrets.choice(_ID_ALPHABET) for _ in range(4))
        if not conn.execute("SELECT 1 FROM appointments WHERE id = ?", (candidate,)).fetchone():
            return candidate
```

### 6.9 `app/seed.py` (EXACT)

```python
"""Mock data. Run `python -m app.seed --reset` from server/ to start fresh."""
import argparse
import random
from datetime import timedelta

from .config import DAYS_AHEAD
from .db import init_schema, new_appointment_id, read, transaction
from .timeutil import now_local, to_text

# (id, name, speciality, room, years, working weekdays: 0=Mon ... 5=Sat; Sunday closed)
DOCTORS = [
    ("dr-ananya-rao", "Dr. Ananya Rao", "Cardiology", "Room 204", 14, [0, 2, 4, 5]),
    ("dr-vikram-sethi", "Dr. Vikram Sethi", "Orthopedics", "Room 112", 11, [1, 3, 5]),
    ("dr-meera-iyer", "Dr. Meera Iyer", "Dermatology", "Room 305", 9, [0, 1, 3, 4]),
    ("dr-arjun-malhotra", "Dr. Arjun Malhotra", "General Medicine", "Room 101", 17, [0, 1, 2, 3, 4, 5]),
    ("dr-kavya-nair", "Dr. Kavya Nair", "Pediatrics", "Room 208", 8, [0, 2, 3, 5]),
    ("dr-rohan-desai", "Dr. Rohan Desai", "ENT", "Room 310", 12, [1, 2, 4, 5]),
]
TIMES = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "17:00", "17:30", "18:00", "18:30"]
DEMO_PHONE = "9876543210"  # has one booking with Dr. Malhotra -> use it to demo cancellation
FIRST = ["Aarav", "Diya", "Ishaan", "Saanvi", "Kabir", "Anika", "Vihaan", "Myra", "Reyansh", "Aditi", "Neel", "Tara"]
LAST = ["Sharma", "Gupta", "Reddy", "Kapoor", "Joshi", "Pillai", "Bose", "Khanna", "Menon", "Chopra"]


def has_doctors() -> bool:
    with read() as conn:
        return conn.execute("SELECT 1 FROM doctors LIMIT 1").fetchone() is not None


def ensure_future_slots(days: int = DAYS_AHEAD) -> None:
    """Idempotent: adds missing slots for today..today+days-1. Never deletes anything."""
    today = now_local().date()
    with transaction() as conn:
        for doctor in DOCTORS:
            doctor_id, weekdays = doctor[0], doctor[5]
            for offset in range(days):
                day = today + timedelta(days=offset)
                if day.weekday() not in weekdays:
                    continue
                for t in TIMES:
                    conn.execute(
                        "INSERT OR IGNORE INTO slots (doctor_id, starts_at) VALUES (?, ?)",
                        (doctor_id, f"{day.isoformat()}T{t}"),
                    )


def _prebook() -> None:
    rng = random.Random(42)
    now = now_local()
    now_s = to_text(now)
    tomorrow = (now + timedelta(days=1)).date().isoformat()
    with transaction() as conn:
        demo = conn.execute(
            "SELECT id FROM slots WHERE doctor_id = 'dr-arjun-malhotra' AND starts_at = ?",
            (f"{tomorrow}T11:00",),
        ).fetchone() or conn.execute(
            "SELECT id FROM slots WHERE doctor_id = 'dr-arjun-malhotra' AND starts_at > ? ORDER BY starts_at LIMIT 1",
            (now_s,),
        ).fetchone()
        rows = []
        if demo:
            rows.append((demo["id"], "Rahul Verma", DEMO_PHONE))
        for r in conn.execute("SELECT id FROM slots WHERE starts_at > ? ORDER BY id", (now_s,)).fetchall():
            if demo and r["id"] == demo["id"]:
                continue
            if rng.random() < 0.15:
                name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
                phone = rng.choice("6789") + "".join(rng.choice("0123456789") for _ in range(9))
                rows.append((r["id"], name, phone))
        for i, (slot_id, name, phone) in enumerate(rows):
            created = to_text(now - timedelta(minutes=30 + i * 7))  # older than any live booking
            conn.execute(
                "INSERT INTO appointments (id, slot_id, patient_name, phone, status, created_at) "
                "VALUES (?, ?, ?, ?, 'booked', ?)",
                (new_appointment_id(conn), slot_id, name, phone, created),
            )


def seed_all(reset: bool = False) -> None:
    init_schema()
    with transaction() as conn:
        if reset:
            conn.execute("DELETE FROM appointments")
            conn.execute("DELETE FROM slots")
            conn.execute("DELETE FROM doctors")
        for doctor_id, name, spec, room, years, _ in DOCTORS:
            conn.execute(
                "INSERT OR IGNORE INTO doctors (id, name, speciality, room, experience_years) VALUES (?, ?, ?, ?, ?)",
                (doctor_id, name, spec, room, years),
            )
    ensure_future_slots()
    _prebook()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete all data and reseed")
    args = parser.parse_args()
    seed_all(reset=args.reset)
    print("Seeded.")
```

### 6.10 `app/repository.py` (EXACT)

All SQL lives here. Functions return **plain dicts with camelCase keys** (that is what the dashboard API sends). Raises `ClinicError(code, message)` for business errors.

```python
"""Every database read/write. No Pipecat or FastAPI imports in this file."""
import difflib
import re
import sqlite3
from datetime import date, datetime, timedelta

from .config import DAYS_AHEAD
from .db import new_appointment_id, read, transaction
from .phone import display_phone
from .timeutil import from_text, now_local, spoken_datetime, spoken_time, to_text


class ClinicError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


SPECIALITY_ALIASES = {
    "cardiology": "Cardiology", "cardiologist": "Cardiology", "heart": "Cardiology", "chest pain": "Cardiology",
    "orthopedics": "Orthopedics", "orthopaedics": "Orthopedics", "orthopedic": "Orthopedics",
    "ortho": "Orthopedics", "bone": "Orthopedics", "bones": "Orthopedics", "joint": "Orthopedics",
    "knee": "Orthopedics", "back pain": "Orthopedics",
    "dermatology": "Dermatology", "dermatologist": "Dermatology", "skin": "Dermatology", "rash": "Dermatology",
    "general medicine": "General Medicine", "general": "General Medicine", "physician": "General Medicine",
    "gp": "General Medicine", "fever": "General Medicine", "cold": "General Medicine", "family doctor": "General Medicine",
    "pediatrics": "Pediatrics", "paediatrics": "Pediatrics", "pediatrician": "Pediatrics",
    "paediatrician": "Pediatrics", "child": "Pediatrics", "children": "Pediatrics", "kids": "Pediatrics", "baby": "Pediatrics",
    "ent": "ENT", "e n t": "ENT", "ear": "ENT", "nose": "ENT", "throat": "ENT",
}


# ---------- doctors ----------

def _doctor(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"], "name": row["name"], "speciality": row["speciality"],
        "room": row["room"], "experienceYears": row["experience_years"],
    }


def list_doctors() -> list[dict]:
    with read() as conn:
        return [_doctor(r) for r in conn.execute("SELECT * FROM doctors ORDER BY name")]


def resolve_speciality(text: str) -> str | None:
    padded = " " + " ".join(re.findall(r"[a-z]+", text.lower())) + " "
    for alias in sorted(SPECIALITY_ALIASES, key=len, reverse=True):  # longest match first
        if f" {alias} " in padded:
            return SPECIALITY_ALIASES[alias]
    return None


def _clean_name(text: str) -> list[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return [w for w in words if w not in {"dr", "doctor", "doc"}]


def _name_score(query: str, full_name: str) -> float:
    q, n = _clean_name(query), _clean_name(full_name)
    if not q:
        return 0.0
    if q == n:
        return 1.0
    return max(difflib.SequenceMatcher(None, a, b).ratio() for a in q for b in n)


def find_doctors(doctor_name: str | None = None, speciality: str | None = None) -> list[dict]:
    """Fuzzy match because STT mishears names ('Dr Ayer' -> Dr. Meera Iyer)."""
    doctors = list_doctors()
    if doctor_name and _clean_name(doctor_name):
        scored = [(_name_score(doctor_name, d["name"]), d) for d in doctors]
        best = max(score for score, _ in scored)
        if best < 0.6:
            return []
        doctors = [d for score, d in scored if score >= best - 0.05]
    if speciality:
        spec = resolve_speciality(speciality)
        if spec is None:
            known = ", ".join(sorted({d["speciality"] for d in list_doctors()}))
            raise ClinicError("UNKNOWN_SPECIALITY", f"No speciality called '{speciality}'. We have: {known}.")
        doctors = [d for d in doctors if d["speciality"] == spec]
    return doctors


# ---------- slots ----------

def _slot(row: sqlite3.Row, today: date) -> dict:
    dt = from_text(row["starts_at"])
    return {
        "id": row["id"], "startsAt": row["starts_at"], "date": dt.date().isoformat(),
        "time": dt.strftime("%H:%M"), "label": spoken_time(dt), "spoken": spoken_datetime(dt, today),
    }


def available_slots(doctor_id: str, on_date: date | None = None, now: datetime | None = None) -> list[dict]:
    now = now or now_local()
    sql = (
        "SELECT s.* FROM slots s WHERE s.doctor_id = ? AND s.starts_at > ? "
        "AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status = 'booked')"
    )
    params: list = [doctor_id, to_text(now)]
    if on_date:
        sql += " AND substr(s.starts_at, 1, 10) = ?"
        params.append(on_date.isoformat())
    sql += " ORDER BY s.starts_at"
    with read() as conn:
        return [_slot(r, now.date()) for r in conn.execute(sql, params)]


def doctors_with_slots(days: int = DAYS_AHEAD) -> dict:
    """For the dashboard: every slot in the window with status available|booked|past."""
    now = now_local()
    today = now.date()
    end = today + timedelta(days=days)
    with read() as conn:
        rows = conn.execute(
            "SELECT s.*, EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status = 'booked') AS booked "
            "FROM slots s WHERE s.starts_at >= ? AND s.starts_at < ? ORDER BY s.starts_at",
            (f"{today.isoformat()}T00:00", f"{end.isoformat()}T00:00"),
        ).fetchall()
    by_doctor: dict[str, list] = {}
    for r in rows:
        slot = _slot(r, today)
        slot["status"] = "booked" if r["booked"] else ("past" if r["starts_at"] <= to_text(now) else "available")
        by_doctor.setdefault(r["doctor_id"], []).append(slot)
    doctors = [{**d, "slots": by_doctor.get(d["id"], [])} for d in list_doctors()]
    return {
        "today": today.isoformat(),
        "days": [(today + timedelta(days=i)).isoformat() for i in range(days)],
        "doctors": doctors,
    }


# ---------- appointments ----------

_APPT_SQL = (
    "SELECT a.*, s.starts_at, s.doctor_id, d.name AS doctor_name, d.speciality, d.room "
    "FROM appointments a JOIN slots s ON s.id = a.slot_id JOIN doctors d ON d.id = s.doctor_id"
)


def _appointment(row: sqlite3.Row) -> dict:
    dt = from_text(row["starts_at"])
    return {
        "id": row["id"], "status": row["status"], "patientName": row["patient_name"],
        "phone": row["phone"], "phoneDisplay": display_phone(row["phone"]),
        "slotId": row["slot_id"], "doctorId": row["doctor_id"], "doctorName": row["doctor_name"],
        "speciality": row["speciality"], "room": row["room"], "startsAt": row["starts_at"],
        "spoken": spoken_datetime(dt), "createdAt": row["created_at"], "cancelledAt": row["cancelled_at"],
    }


def get_appointment(appointment_id: str) -> dict | None:
    with read() as conn:
        row = conn.execute(f"{_APPT_SQL} WHERE a.id = ?", (appointment_id,)).fetchone()
    return _appointment(row) if row else None


def list_appointments() -> list[dict]:
    """Newest first, so a booking made during the call appears at the top."""
    with read() as conn:
        rows = conn.execute(f"{_APPT_SQL} ORDER BY a.created_at DESC, a.id").fetchall()
    return [_appointment(r) for r in rows]


def upcoming_for_phone(phone: str) -> list[dict]:
    with read() as conn:
        rows = conn.execute(
            f"{_APPT_SQL} WHERE a.phone = ? AND a.status = 'booked' AND s.starts_at > ? ORDER BY s.starts_at",
            (phone, to_text(now_local())),
        ).fetchall()
    return [_appointment(r) for r in rows]


def book(slot_id: int, patient_name: str, phone: str) -> dict:
    now_s = to_text(now_local())
    try:
        with transaction() as conn:
            slot = conn.execute("SELECT * FROM slots WHERE id = ?", (slot_id,)).fetchone()
            if not slot:
                raise ClinicError("SLOT_NOT_FOUND", "That slot does not exist. Check availability again.")
            if slot["starts_at"] <= now_s:
                raise ClinicError("SLOT_IN_PAST", "That time has already passed. Offer a later slot.")
            if conn.execute("SELECT 1 FROM appointments WHERE slot_id = ? AND status = 'booked'", (slot_id,)).fetchone():
                raise ClinicError("SLOT_TAKEN", "That slot was just taken. Check availability again and offer another time.")
            clash = conn.execute(
                "SELECT 1 FROM appointments a JOIN slots s ON s.id = a.slot_id "
                "WHERE a.phone = ? AND a.status = 'booked' AND s.starts_at = ?",
                (phone, slot["starts_at"]),
            ).fetchone()
            if clash:
                raise ClinicError("CALLER_BUSY", "This phone number already has an appointment at that exact time.")
            appointment_id = new_appointment_id(conn)
            conn.execute(
                "INSERT INTO appointments (id, slot_id, patient_name, phone, status, created_at) "
                "VALUES (?, ?, ?, ?, 'booked', ?)",
                (appointment_id, slot_id, patient_name, phone, now_s),
            )
    except sqlite3.IntegrityError as exc:  # unique index caught a race
        raise ClinicError("SLOT_TAKEN", "That slot was just taken. Offer another time.") from exc
    return get_appointment(appointment_id)


def cancel(appointment_id: str, phone: str) -> dict:
    with transaction() as conn:
        row = conn.execute(
            "SELECT * FROM appointments WHERE id = ? AND phone = ? AND status = 'booked'", (appointment_id, phone)
        ).fetchone()
        if not row:
            raise ClinicError("NOT_FOUND", "No active appointment with that ID for this phone number.")
        conn.execute(
            "UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE id = ?",
            (to_text(now_local()), appointment_id),
        )
    return get_appointment(appointment_id)
```

### 6.11 `app/events.py` (EXACT)

```python
"""Tiny in-process pub/sub. Tools publish; each SSE client has its own queue."""
import asyncio

from .timeutil import now_local, to_text

_subscribers: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


def publish(event: dict) -> None:
    """Must be called from the event loop thread (i.e. from async code)."""
    event = {**event, "at": to_text(now_local())}
    for queue in list(_subscribers):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            pass  # a stuck client must never block the voice pipeline
```

### 6.12 `app/tools.py`, logic (EXACT) + Pipecat glue (REFERENCE, VERIFY)

**Contract for every tool result** (what the LLM sees): `{"ok": true, ...}` or `{"ok": false, "error": "CODE", "message": "instruction for the agent"}`. Keys are snake_case. A private key `_events` (list of dashboard events) is popped by the wrapper before the result goes to the LLM.

Tool schemas (names and parameters are final):

| Tool | Params | Required |
|---|---|---|
| `check_doctor_availability` | `doctor_name` str, `speciality` str, `date` str (`YYYY-MM-DD`) | none (at least one of name/speciality recommended) |
| `book_appointment` | `slot_id` int, `phone` str, `phone_confirmed` bool, `patient_name` str | `slot_id`, `phone`, `phone_confirmed` |
| `cancel_appointment` | `phone` str, `phone_confirmed` bool, `appointment_id` str | `phone`, `phone_confirmed` |

```python
"""The three tools. Pure logic first (testable without Pipecat), Pipecat glue at the bottom."""
import asyncio

from loguru import logger

from . import events
from . import repository as repo
from .phone import normalize_phone, spoken_phone
from .repository import ClinicError
from .timeutil import DateParseError, now_local, parse_date_arg, spoken_date

MAX_DOCTORS = 4
MAX_SLOTS = 8


def _error(code: str, message: str, **extra) -> dict:
    return {"ok": False, "error": code, "message": message, **extra}


def _as_bool(value) -> bool:
    return value is True or (isinstance(value, str) and value.strip().lower() in {"true", "yes"})


def _as_int(value) -> int | None:
    try:
        return int(float(value))  # Gemini sometimes sends 12.0 or "12"
    except (TypeError, ValueError):
        return None


def _checked_phone(args: dict) -> tuple[str | None, dict | None]:
    phone = normalize_phone(args.get("phone"))
    if not phone:
        return None, _error("INVALID_PHONE", "That is not a 10-digit phone number. Ask the caller to say it again slowly.")
    if not _as_bool(args.get("phone_confirmed")):
        return None, _error(
            "PHONE_NOT_CONFIRMED",
            f"Read the number back first: '{spoken_phone(phone)}'. Only call again with phone_confirmed=true after the caller says yes.",
        )
    return phone, None


def _summary(appt: dict) -> dict:
    return {
        "appointment_id": appt["id"], "doctor_name": appt["doctorName"], "speciality": appt["speciality"],
        "when": appt["spoken"], "room": appt["room"], "patient_name": appt["patientName"],
    }


def check_doctor_availability(args: dict) -> dict:
    today = now_local().date()
    name = (args.get("doctor_name") or "").strip() or None
    speciality = (args.get("speciality") or "").strip() or None
    date_text = (args.get("date") or "").strip() or None
    try:
        on_date = parse_date_arg(date_text, today) if date_text else None
        doctors = repo.find_doctors(name, speciality)
    except DateParseError as exc:
        return _error("BAD_DATE", str(exc))
    except ClinicError as exc:
        return _error(exc.code, exc.message)
    if on_date and on_date < today:
        return _error("DATE_IN_PAST", "That date has passed. Ask for a date from today onwards.")
    if not doctors:
        everyone = [{"doctor_name": d["name"], "speciality": d["speciality"]} for d in repo.list_doctors()]
        return _error("DOCTOR_NOT_FOUND", "No matching doctor. Tell the caller who is available.", doctors=everyone)

    results = []
    for d in doctors[:MAX_DOCTORS]:
        all_future = repo.available_slots(d["id"])
        if on_date:
            slots = [s for s in all_future if s["date"] == on_date.isoformat()]
        else:
            first_dates = sorted({s["date"] for s in all_future})[:2]  # next two days with openings
            slots = [s for s in all_future if s["date"] in first_dates]
        entry = {
            "doctor_name": d["name"], "speciality": d["speciality"], "room": d["room"],
            "slots": [{"slot_id": s["id"], "when": s["spoken"]} for s in slots[:MAX_SLOTS]],
            "more_slots_not_listed": max(0, len(slots) - MAX_SLOTS),
        }
        if not slots:
            entry["next_available"] = all_future[0]["spoken"] if all_future else None
        results.append(entry)
    return {
        "ok": True,
        "date_searched": spoken_date(on_date, today) if on_date else "next available days",
        "results": results,
        "note": "Offer at most three times out loud. Use the exact slot_id when booking.",
        "_events": [],
    }


def book_appointment(args: dict) -> dict:
    phone, err = _checked_phone(args)
    if err:
        return err
    slot_id = _as_int(args.get("slot_id"))
    if slot_id is None:
        return _error("BAD_SLOT", "slot_id must be a number from check_doctor_availability. Check availability first.")
    name = " ".join((args.get("patient_name") or "").split())[:60].title() or "Caller"
    try:
        appt = repo.book(slot_id, name, phone)
    except ClinicError as exc:
        return _error(exc.code, exc.message)
    return {
        "ok": True,
        "appointment": _summary(appt),
        "note": "Tell the caller it is booked: doctor, day and time. Keep it short.",
        "_events": [{"type": "appointment.booked", "appointment": appt}],
    }


def cancel_appointment(args: dict) -> dict:
    phone, err = _checked_phone(args)
    if err:
        return err
    upcoming = repo.upcoming_for_phone(phone)
    if not upcoming:
        return _error("NO_APPOINTMENT", f"No upcoming appointment for {spoken_phone(phone)}. Ask the caller to check the number.")
    wanted = (args.get("appointment_id") or "").strip().upper().replace(" ", "")
    if not wanted:
        return _error(
            "CONFIRM_WHICH",
            "Tell the caller which appointment(s) you found and ask them to confirm which to cancel. "
            "Then call cancel_appointment again with that appointment_id.",
            appointments=[_summary(a) for a in upcoming],
        )
    if not wanted.startswith("APT-"):
        wanted = "APT-" + wanted.removeprefix("APT")
    try:
        appt = repo.cancel(wanted, phone)
    except ClinicError as exc:
        return _error(exc.code, exc.message, appointments=[_summary(a) for a in upcoming])
    return {
        "ok": True,
        "cancelled": _summary(appt),
        "note": "Confirm the cancellation in one sentence.",
        "_events": [{"type": "appointment.cancelled", "appointment": appt}],
    }


HANDLERS = {
    "check_doctor_availability": check_doctor_availability,
    "book_appointment": book_appointment,
    "cancel_appointment": cancel_appointment,
}


# ---------------- Pipecat glue (REFERENCE, VERIFY imports, see Section 8) ----------------
from pipecat.adapters.schemas.function_schema import FunctionSchema  # noqa: E402
from pipecat.adapters.schemas.tools_schema import ToolsSchema  # noqa: E402

TOOLS = ToolsSchema(standard_tools=[
    FunctionSchema(
        name="check_doctor_availability",
        description="Find open appointment slots. Search by doctor name and/or speciality, optionally for one date.",
        properties={
            "doctor_name": {"type": "string", "description": "Doctor's name as the caller said it, e.g. 'Dr Rao'."},
            "speciality": {"type": "string", "description": "Speciality or problem, e.g. 'cardiology', 'skin', 'child'."},
            "date": {"type": "string", "description": "Date in YYYY-MM-DD. Omit to get the next available days."},
        },
        required=[],
    ),
    FunctionSchema(
        name="book_appointment",
        description="Book a slot. Only after the caller confirmed the phone number you read back to them.",
        properties={
            "slot_id": {"type": "integer", "description": "slot_id from check_doctor_availability."},
            "phone": {"type": "string", "description": "Caller's phone number, digits only."},
            "phone_confirmed": {"type": "boolean", "description": "True only if you read the number back and the caller said yes."},
            "patient_name": {"type": "string", "description": "Patient's name, if given."},
        },
        required=["slot_id", "phone", "phone_confirmed"],
    ),
    FunctionSchema(
        name="cancel_appointment",
        description=(
            "Cancel the caller's appointment, found by phone number. Call first WITHOUT appointment_id to list "
            "their appointments, confirm with the caller, then call again WITH appointment_id."
        ),
        properties={
            "phone": {"type": "string", "description": "Caller's phone number, digits only."},
            "phone_confirmed": {"type": "boolean", "description": "True only if you read the number back and the caller said yes."},
            "appointment_id": {"type": "string", "description": "e.g. 'APT-7K3Q', from a previous cancel_appointment result."},
        },
        required=["phone", "phone_confirmed"],
    ),
])


def register_tools(llm) -> None:
    for name, fn in HANDLERS.items():
        llm.register_function(name, _make_handler(name, fn))


def _make_handler(name: str, fn):
    async def handler(params):  # params: pipecat FunctionCallParams
        args = dict(params.arguments or {})
        logger.info(f"tool {name} args={args}")
        try:
            result = await asyncio.to_thread(fn, args)  # sqlite is blocking: keep it off the event loop
        except Exception:
            logger.exception(f"tool {name} crashed")
            result = _error("INTERNAL", "Something went wrong on our side. Apologise and offer to try again.")
        dashboard_events = result.pop("_events", [])
        events.publish({"type": "tool", "name": name, "args": args, "ok": result.get("ok", False),
                        "error": result.get("error")})
        for event in dashboard_events:
            events.publish(event)
        logger.info(f"tool {name} -> ok={result.get('ok')} error={result.get('error')}")
        await params.result_callback(result)
    return handler
```

> Tests import `tools.py`, which imports Pipecat at the bottom. That is fine because Pipecat is installed. If importing Pipecat in tests is slow or fails, move the glue (everything below the marker) into `app/tool_registry.py` and import that from `bot.py` instead. Do not do this pre‑emptively.

### 6.13 `app/prompts.py` (EXACT)

```python
"""System prompt. Rebuilt per call so 'today' is always correct."""
from datetime import timedelta

from . import repository as repo
from .config import AGENT_NAME, CLINIC_NAME, DAYS_AHEAD
from .timeutil import now_local, spoken_time


def build_system_prompt() -> str:
    now = now_local()
    today = now.date()
    calendar = "\n".join(
        f"- {(today + timedelta(days=i)).strftime('%A')} {(today + timedelta(days=i)).day} "
        f"{(today + timedelta(days=i)).strftime('%B')} = {(today + timedelta(days=i)).isoformat()}"
        for i in range(DAYS_AHEAD)
    )
    doctors = "\n".join(f"- {d['name']}: {d['speciality']}" for d in repo.list_doctors())
    return f"""You are {AGENT_NAME}, the receptionist answering the phone at {CLINIC_NAME}. You help callers check doctor availability, book appointments and cancel appointments.

NOW: {today.strftime('%A')} {today.day} {today.strftime('%B')} {today.year}, {spoken_time(now)}, India time. The clinic is closed on Sundays.
Dates (use these exact YYYY-MM-DD values in tool calls, never calculate dates yourself):
{calendar}

Doctors:
{doctors}

HOW YOU SPEAK (your words are turned into speech):
- One or two short sentences per turn. Warm, calm, natural. Never sound like a form.
- Plain words only: no lists, markdown, emojis, symbols or abbreviations like "Dr" -> say "Doctor".
- Say times like "10:30 AM", dates like "Wednesday 26 November". Never say slot_id or appointment IDs out loud unless asked.
- Offer at most three time options at once.
- If you did not catch something, ask the caller to repeat it.

IDENTITY: The caller is identified ONLY by the phone number they say. There is no login, OTP or caller ID. Never claim to know who they are.

PHONE NUMBER RULE (mandatory before booking or cancelling):
1. Ask for their 10-digit mobile number.
2. Read it back digit by digit in two groups of five, e.g. "9 8 7 6 5, 4 3 2 1 0. Is that right?"
3. Only after a clear yes, call the tool with phone_confirmed true. If they say no, ask for it again and repeat step 2.
4. Once confirmed in this call, do not ask again for the same number.

CHECKING AVAILABILITY: Always call check_doctor_availability before offering times. Never invent doctors, dates or times. If the caller describes a problem (for example "skin rash"), pass it as speciality.

BOOKING:
1. Agree on a doctor and one exact slot from the latest check_doctor_availability result.
2. Ask for the patient's name once (if they decline, continue).
3. Get and confirm the phone number (rule above).
4. Call book_appointment with that slot_id.
5. Confirm: doctor, day and time. Ask if there is anything else.
If the tool says SLOT_TAKEN, apologise, check availability again and offer other times.

CANCELLING:
1. Get and confirm the phone number.
2. Call cancel_appointment WITHOUT appointment_id. It returns the caller's upcoming appointments.
3. Say which appointment you found (doctor, day, time) and ask if they want it cancelled. If there are several, ask which one.
4. After a clear yes, call cancel_appointment again WITH that appointment_id.
5. Confirm it is cancelled.

TOOL ERRORS: Every tool result has "ok". If ok is false, follow its "message" and explain simply. Never pretend something worked.

OTHER: You cannot give medical advice; for emergencies tell them to call 112 or go to the nearest emergency room. Stay on clinic topics. When the caller is done, say a short goodbye.

Start the call by saying exactly: "Hello, {CLINIC_NAME}, this is {AGENT_NAME}. How can I help you today?"
"""
```

### 6.14 `app/bot.py` (REFERENCE, VERIFY every import against the installed Pipecat, Section 8)

```python
"""The voice pipeline: mic audio -> VAD -> STT -> LLM(+tools) -> TTS -> speaker audio."""
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame                       # VERIFY (older: use get_context_frame, below)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext    # VERIFY (older: OpenAILLMContext)
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair  # VERIFY
from pipecat.processors.frameworks.rtvi import RTVIConfig, RTVIObserver, RTVIProcessor
from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport  # VERIFY path

from . import events
from .config import env, require_env
from .prompts import build_system_prompt
from .tools import TOOLS, register_tools


async def run_bot(webrtc_connection) -> None:
    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.6)),  # bonus: Silero VAD
        ),
    )

    stt = ElevenLabsSTTService(
        api_key=require_env("ELEVENLABS_API_KEY"),
        params=ElevenLabsSTTService.InputParams(language=Language.EN),  # VERIFY param name
    )
    tts = ElevenLabsTTSService(
        api_key=require_env("ELEVENLABS_API_KEY"),
        voice_id=require_env("ELEVENLABS_VOICE_ID"),
        model=env("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5"),
    )
    llm = GoogleLLMService(api_key=require_env("GOOGLE_API_KEY"), model=env("GEMINI_MODEL", "gemini-2.5-flash"))
    register_tools(llm)

    context = LLMContext(messages=[{"role": "system", "content": build_system_prompt()}], tools=TOOLS)
    aggregators = LLMContextAggregatorPair(context)
    rtvi = RTVIProcessor(config=RTVIConfig(config=[]))

    pipeline = Pipeline([
        transport.input(),
        rtvi,
        stt,
        aggregators.user(),
        llm,
        tts,
        transport.output(),
        aggregators.assistant(),
    ])
    task = PipelineTask(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        observers=[RTVIObserver(rtvi)],
    )

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi_processor):
        await rtvi_processor.set_bot_ready()
        await task.queue_frames([LLMRunFrame()])  # LLM speaks the greeting from the prompt

    @transport.event_handler("on_client_connected")
    async def on_client_connected(_transport, _client):
        logger.info("client connected")
        events.publish({"type": "call.started"})

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(_transport, _client):
        logger.info("client disconnected")
        events.publish({"type": "call.ended"})
        await task.cancel()

    await PipelineRunner(handle_sigint=False).run(task)
```

**Older‑Pipecat fallback** (use ONLY if `LLMContext`/`LLMRunFrame` do not exist in the installed version):

```python
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
context = OpenAILLMContext(messages=[{"role": "system", "content": build_system_prompt()}], tools=TOOLS)
aggregators = llm.create_context_aggregator(context)
# greeting:
await task.queue_frames([aggregators.user().get_context_frame()])
```

Notes:
* If `ElevenLabsSTTService` requires an `aiohttp_session` argument, create `session = aiohttp.ClientSession()` at the start of `run_bot`, pass it, and `await session.close()` in a `finally:` around the runner.
* If the installed Pipecat adds RTVI automatically to `PipelineTask` (look for `enable_rtvi` / `rtvi_processor` in `PipelineTask.__init__`), do **not** add a second RTVIProcessor; use the task's built‑in one and its `on_client_ready` event.
* If Gemini puts the system message nowhere (agent ignores rules), pass it instead as `GoogleLLMService(..., system_instruction=build_system_prompt())` and start `messages` empty.
* Gemini returning an empty answer right after a tool call is a known issue with some "thinking" models. If it happens, set `GEMINI_MODEL=gemini-2.5-flash-lite` (or the newest free "flash" model listed in AI Studio), no code change needed.
* Optional upgrade (only after everything works): `ElevenLabsRealtimeSTTService` for lower latency. Keep the segmented one if in doubt.

### 6.15 `app/main.py` (REFERENCE, VERIFY the WebRTC parts)

```python
"""HTTP API: dashboard data, SSE events, WebRTC signalling for the voice call."""
import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from loguru import logger
from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection  # VERIFY path

from . import events
from . import repository as repo
from .bot import run_bot
from .db import init_schema
from .seed import ensure_future_slots, has_doctors, seed_all

connections: dict[str, SmallWebRTCConnection] = {}
ICE_SERVERS = [IceServer(urls="stun:stun.l.google.com:19302")]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_schema()
    if not has_doctors():
        seed_all()
    ensure_future_slots()
    yield
    await asyncio.gather(*(c.disconnect() for c in connections.values()), return_exceptions=True)
    connections.clear()


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/doctors")
async def get_doctors():
    return await asyncio.to_thread(repo.doctors_with_slots)


@app.get("/api/appointments")
async def get_appointments():
    return await asyncio.to_thread(repo.list_appointments)


@app.post("/api/reset")
async def reset():
    await asyncio.to_thread(seed_all, True)
    events.publish({"type": "data.reset"})
    return {"ok": True}


@app.get("/api/events")
async def stream_events(request: Request):
    queue = events.subscribe()

    async def generate():
        try:
            yield "retry: 2000\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            events.unsubscribe(queue)

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/offer")
async def offer(request: dict, background_tasks: BackgroundTasks):
    pc_id = request.get("pc_id")
    if pc_id and pc_id in connections:
        conn = connections[pc_id]
        await conn.renegotiate(sdp=request["sdp"], type=request["type"], restart_pc=request.get("restart_pc", False))
    else:
        conn = SmallWebRTCConnection(ICE_SERVERS)
        await conn.initialize(sdp=request["sdp"], type=request["type"])

        @conn.event_handler("closed")
        async def on_closed(closed_conn: SmallWebRTCConnection):
            logger.info(f"peer connection closed {closed_conn.pc_id}")
            connections.pop(closed_conn.pc_id, None)

        background_tasks.add_task(run_bot, conn)

    answer = conn.get_answer()
    connections[answer["pc_id"]] = conn
    return answer
```

**Signalling check (important):** newer `@pipecat-ai/small-webrtc-transport` versions also send **`PATCH /api/offer`** with trickle‑ICE candidates. If the browser console/server log shows `405 Method Not Allowed` on PATCH, the installed Pipecat will have a helper, search for `SmallWebRTCRequestHandler` (Section 8). If it exists, replace the hand‑written `/api/offer` with the helper exactly as the official `p2p-webrtc`/`voice-agent` example for that version does (both POST and PATCH routes). If it does not exist, the client will not send PATCH and the code above is correct.

**Run:** from `server/`: `uvicorn app.main:app --port 7860` (no `--reload` while testing calls, reload kills live calls).

### 6.16 Tests (EXACT), must all pass before any voice work

`tests/conftest.py`:
```python
import pytest


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """Every test gets its own seeded database file."""
    from app import config, db
    path = tmp_path / "test.db"
    monkeypatch.setattr(config, "DB_PATH", path)
    monkeypatch.setattr(db, "DB_PATH", path)
    from app.seed import seed_all
    seed_all(reset=True)
    yield
```

`tests/test_phone.py`:
```python
from app.phone import normalize_phone, spoken_phone


def test_plain_and_formatted():
    assert normalize_phone("9876543210") == "9876543210"
    assert normalize_phone("+91 98765-43210") == "9876543210"
    assert normalize_phone("098765 43210") == "9876543210"


def test_words_and_double():
    assert normalize_phone("nine eight seven six five four three two one zero") == "9876543210"
    assert normalize_phone("double nine 8 7 6 5 4 3 2 1") == "9987654321"


def test_invalid():
    assert normalize_phone("12345") is None
    assert normalize_phone(None) is None


def test_spoken():
    assert spoken_phone("9876543210") == "9 8 7 6 5, 4 3 2 1 0"
```

`tests/test_timeutil.py`:
```python
from datetime import date, datetime

from app.timeutil import parse_date_arg, spoken_time

TODAY = date(2026, 11, 25)  # a Wednesday


def test_parse():
    assert parse_date_arg("2026-11-27", TODAY) == date(2026, 11, 27)
    assert parse_date_arg("tomorrow", TODAY) == date(2026, 11, 26)
    assert parse_date_arg("Friday", TODAY) == date(2026, 11, 27)
    assert parse_date_arg("wednesday", TODAY) == TODAY


def test_spoken_time():
    assert spoken_time(datetime(2026, 1, 1, 10, 0)) == "10 AM"
    assert spoken_time(datetime(2026, 1, 1, 17, 30)) == "5:30 PM"
    assert spoken_time(datetime(2026, 1, 1, 12, 0)) == "12 PM"
```

`tests/test_repository.py`:
```python
import pytest

from app import repository as repo
from app.repository import ClinicError


def test_find_doctor_fuzzy():
    assert repo.find_doctors("Dr Ayer")[0]["name"] == "Dr. Meera Iyer"
    assert repo.find_doctors(speciality="skin rash")[0]["speciality"] == "Dermatology"
    assert repo.find_doctors("Doctor Zzzzz") == []


def test_unknown_speciality():
    with pytest.raises(ClinicError):
        repo.find_doctors(speciality="astrology")


def test_book_then_slot_unavailable_then_cancel_frees_it():
    slot = repo.available_slots("dr-ananya-rao")[0]
    appt = repo.book(slot["id"], "Test User", "9000000001")
    assert appt["status"] == "booked"
    assert slot["id"] not in [s["id"] for s in repo.available_slots("dr-ananya-rao")]
    with pytest.raises(ClinicError) as exc:
        repo.book(slot["id"], "Other", "9000000002")
    assert exc.value.code == "SLOT_TAKEN"
    repo.cancel(appt["id"], "9000000001")
    assert slot["id"] in [s["id"] for s in repo.available_slots("dr-ananya-rao")]


def test_cancel_wrong_phone_fails():
    slot = repo.available_slots("dr-rohan-desai")[0]
    appt = repo.book(slot["id"], "A", "9000000003")
    with pytest.raises(ClinicError):
        repo.cancel(appt["id"], "9000000004")


def test_demo_phone_has_booking():
    assert len(repo.upcoming_for_phone("9876543210")) == 1
```

`tests/test_tools.py`:
```python
from app import repository as repo
from app.tools import book_appointment, cancel_appointment, check_doctor_availability


def test_availability_by_speciality():
    r = check_doctor_availability({"speciality": "heart"})
    assert r["ok"] and r["results"][0]["doctor_name"] == "Dr. Ananya Rao"
    assert len(r["results"][0]["slots"]) <= 8


def test_availability_unknown_doctor():
    r = check_doctor_availability({"doctor_name": "Doctor Nobody"})
    assert r["ok"] is False and r["error"] == "DOCTOR_NOT_FOUND" and r["doctors"]


def test_book_requires_confirmation():
    slot_id = repo.available_slots("dr-kavya-nair")[0]["id"]
    r = book_appointment({"slot_id": slot_id, "phone": "9123456780", "phone_confirmed": False})
    assert r["error"] == "PHONE_NOT_CONFIRMED"


def test_book_happy_path_and_events():
    slot_id = repo.available_slots("dr-kavya-nair")[0]["id"]
    r = book_appointment({"slot_id": float(slot_id), "phone": "+91 91234 56780",
                          "phone_confirmed": True, "patient_name": "priya shah"})
    assert r["ok"] and r["appointment"]["patient_name"] == "Priya Shah"
    assert r["_events"][0]["type"] == "appointment.booked"


def test_cancel_two_step():
    first = cancel_appointment({"phone": "9876543210", "phone_confirmed": True})
    assert first["error"] == "CONFIRM_WHICH"
    appt_id = first["appointments"][0]["appointment_id"]
    second = cancel_appointment({"phone": "9876543210", "phone_confirmed": True, "appointment_id": appt_id})
    assert second["ok"] and second["_events"][0]["type"] == "appointment.cancelled"
    third = cancel_appointment({"phone": "9876543210", "phone_confirmed": True})
    assert third["error"] == "NO_APPOINTMENT"
```

> If a test fails, fix the **code**, not the test, unless the test contradicts this plan (then write why in `NOTES.md`).

---

## 7. Frontend, detailed spec

### 7.1 Setup commands (from repo root)

```bash
npm create vite@latest web -- --template react-ts
```
```bash
cd web && npm install @pipecat-ai/client-js @pipecat-ai/client-react @pipecat-ai/small-webrtc-transport motion @fontsource/instrument-serif @fontsource-variable/geist @fontsource-variable/geist-mono
```

Delete Vite's demo files (`App.css`, `index.css`, `assets/react.svg`, the demo content in `App.tsx`). Do **not** install Tailwind, shadcn, MUI, Chakra, or any icon pack, icons are 4–5 tiny inline SVGs written by hand.

`web/vite.config.ts` (EXACT):
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:7860", changeOrigin: true } },
  },
});
```

### 7.2 Types, `src/types.ts` (EXACT; mirrors backend JSON)

```ts
export type SlotStatus = "available" | "booked" | "past";
export interface Slot { id: number; startsAt: string; date: string; time: string; label: string; status: SlotStatus; }
export interface Doctor { id: string; name: string; speciality: string; room: string; experienceYears: number; slots: Slot[]; }
export interface DoctorsResponse { today: string; days: string[]; doctors: Doctor[]; }
export interface Appointment {
  id: string; status: "booked" | "cancelled"; patientName: string; phone: string; phoneDisplay: string;
  slotId: number; doctorId: string; doctorName: string; speciality: string; room: string;
  startsAt: string; spoken: string; createdAt: string; cancelledAt: string | null;
}
export type ClinicEvent =
  | { type: "appointment.booked"; appointment: Appointment; at: string }
  | { type: "appointment.cancelled"; appointment: Appointment; at: string }
  | { type: "tool"; name: string; args: Record<string, unknown>; ok: boolean; error: string | null; at: string }
  | { type: "call.started" | "call.ended" | "data.reset"; at: string };
export type CallStatus = "idle" | "ringing" | "connected" | "ended" | "error";
export interface TranscriptLine { id: number; role: "user" | "agent"; text: string; interim: string; }
```

### 7.3 `src/lib/api.ts` (EXACT)

```ts
import type { Appointment, DoctorsResponse } from "../types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  doctors: () => get<DoctorsResponse>("/api/doctors"),
  appointments: () => get<Appointment[]>("/api/appointments"),
  reset: () => fetch("/api/reset", { method: "POST" }),
};
```

### 7.4 `src/lib/sounds.ts` (EXACT, synthesized, no audio files, no licensing issues)

```ts
let ctx: AudioContext | null = null;
let ringTimer: number | undefined;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freqs: number[], start: number, duration: number, volume = 0.05) {
  const c = audio();
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + duration - 0.04);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  gain.connect(c.destination);
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export function startRing() {
  stopRing();
  const ring = () => {
    const t = audio().currentTime;
    tone([440, 480], t, 0.4);
    tone([440, 480], t + 0.6, 0.4);
  };
  ring();
  ringTimer = window.setInterval(ring, 2400);
}

export function stopRing() {
  if (ringTimer !== undefined) window.clearInterval(ringTimer);
  ringTimer = undefined;
}

export function playConnect() {
  const t = audio().currentTime;
  tone([880], t, 0.08, 0.04);
  tone([1320], t + 0.1, 0.12, 0.04);
}

export function playEnd() {
  const t = audio().currentTime;
  [620, 480, 360].forEach((f, i) => tone([f], t + i * 0.16, 0.13, 0.05));
}
```

### 7.5 `src/lib/format.ts` (EXACT)

```ts
const pad = (n: number) => String(n).padStart(2, "0");

export function dayChip(iso: string, today: string) {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = iso === today ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" });
  return { weekday, day: d.getDate() };
}

export function whenShort(startsAt: string) {
  const d = new Date(startsAt);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return { date, time };
}

export function clock(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export function hhmmss(at: string) {
  return at.slice(11, 16);
}
```

### 7.6 Hooks

**`src/main.tsx`** (REFERENCE, VERIFY constructor/connect options against `node_modules/@pipecat-ai/*/dist/*.d.ts`):
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { PipecatClient } from "@pipecat-ai/client-js";
import { PipecatClientAudio, PipecatClientProvider } from "@pipecat-ai/client-react";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import "@fontsource/instrument-serif";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles/tokens.css";
import "./styles/app.css";
import App from "./App";

// Created ONCE at module level. Never create the client inside a component (StrictMode would make two).
const client = new PipecatClient({
  transport: new SmallWebRTCTransport(),
  enableMic: true,
  enableCam: false,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PipecatClientProvider client={client}>
      <App />
      <PipecatClientAudio />
    </PipecatClientProvider>
  </React.StrictMode>,
);
```

**`src/hooks/useClinicData.ts`** (EXACT):
```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Appointment, ClinicEvent, DoctorsResponse } from "../types";

type Flash = "booked" | "cancelled";
type ToolEvent = Extract<ClinicEvent, { type: "tool" }>;
type ApptEvent = Extract<ClinicEvent, { type: "appointment.booked" | "appointment.cancelled" }>;

export function useClinicData() {
  const [doctors, setDoctors] = useState<DoctorsResponse | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activity, setActivity] = useState<ToolEvent[]>([]);
  const [flash, setFlash] = useState<Record<string, Flash>>({}); // keys: appointment id or `slot:<id>`
  const [lastChange, setLastChange] = useState<ApptEvent | null>(null);
  const [online, setOnline] = useState(false);
  const timers = useRef<number[]>([]);

  const refresh = useCallback(async () => {
    const [d, a] = await Promise.all([api.doctors(), api.appointments()]);
    setDoctors(d);
    setAppointments(a);
  }, []);

  const markFlash = useCallback((keys: string[], kind: Flash) => {
    setFlash((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, kind])) }));
    const t = window.setTimeout(() => {
      setFlash((f) => {
        const next = { ...f };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }, 2600);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    refresh().catch(() => setOnline(false));
    const es = new EventSource("/api/events");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as ClinicEvent;
      if (ev.type === "appointment.booked" || ev.type === "appointment.cancelled") {
        const kind: Flash = ev.type === "appointment.booked" ? "booked" : "cancelled";
        void refresh();
        markFlash([ev.appointment.id, `slot:${ev.appointment.slotId}`], kind);
        setLastChange(ev);
      } else if (ev.type === "tool") {
        setActivity((a) => [ev, ...a].slice(0, 40));
      } else if (ev.type === "data.reset") {
        void refresh();
        setActivity([]);
      }
    };
    return () => {
      es.close();
      timers.current.forEach(clearTimeout);
    };
  }, [refresh, markFlash]);

  return { doctors, appointments, activity, flash, lastChange, online, refresh };
}
```

**`src/hooks/useCall.ts`** (REFERENCE, VERIFY event names/`connect` options; logic is EXACT):
```ts
import { useCallback, useRef, useState } from "react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { usePipecatClient, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { playConnect, playEnd, startRing, stopRing } from "../lib/sounds";
import type { CallStatus, TranscriptLine } from "../types";

const MIN_RING_MS = 1600;

export function useCall() {
  const client = usePipecatClient();
  const [status, setStatusState] = useState<CallStatus>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [endedAfter, setEndedAfter] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<CallStatus>("idle");   // event callbacks must read the latest status
  const ringStartedAt = useRef(0);
  const connectedAtRef = useRef<number | null>(null);
  const nextId = useRef(1);

  const setStatus = (s: CallStatus) => { statusRef.current = s; setStatusState(s); };

  const finish = useCallback(() => {
    if (statusRef.current === "idle" || statusRef.current === "ended") return;
    stopRing();
    playEnd();
    setEndedAfter(connectedAtRef.current ? Math.round((Date.now() - connectedAtRef.current) / 1000) : 0);
    setStatus("ended");
    window.setTimeout(() => { if (statusRef.current === "ended") setStatus("idle"); }, 2200);
  }, []);

  useRTVIClientEvent(RTVIEvent.BotReady, useCallback(() => {
    const wait = Math.max(0, MIN_RING_MS - (Date.now() - ringStartedAt.current));
    window.setTimeout(() => {
      if (statusRef.current !== "ringing") return;
      stopRing();
      playConnect();
      connectedAtRef.current = Date.now();
      setConnectedAt(connectedAtRef.current);
      setStatus("connected");
    }, wait);
  }, []));

  useRTVIClientEvent(RTVIEvent.UserTranscript, useCallback((data: { text: string; final: boolean }) => {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "user") {
        const updated = data.final
          ? { ...last, text: `${last.text} ${data.text}`.trim(), interim: "" }
          : { ...last, interim: data.text };
        return [...prev.slice(0, -1), updated];
      }
      const line: TranscriptLine = data.final
        ? { id: nextId.current++, role: "user", text: data.text, interim: "" }
        : { id: nextId.current++, role: "user", text: "", interim: data.text };
      return [...prev, line];
    });
  }, []));

  useRTVIClientEvent(RTVIEvent.BotTranscript, useCallback((data: { text: string }) => {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "agent") {
        return [...prev.slice(0, -1), { ...last, text: `${last.text} ${data.text}`.trim() }];
      }
      return [...prev, { id: nextId.current++, role: "agent", text: data.text, interim: "" }];
    });
  }, []));

  useRTVIClientEvent(RTVIEvent.Disconnected, useCallback(() => finish(), [finish]));

  const start = useCallback(async () => {
    if (statusRef.current !== "idle" && statusRef.current !== "error") return;
    setLines([]); setError(null); setMuted(false);
    connectedAtRef.current = null; setConnectedAt(null);
    ringStartedAt.current = Date.now();
    setStatus("ringing");
    startRing(); // click = user gesture, so the AudioContext is allowed to start
    try {
      await client!.initDevices();
      await client!.connect({ webrtcRequestParams: { endpoint: "/api/offer" } }); // VERIFY option name
    } catch (e) {
      stopRing();
      setError(e instanceof Error && /permission|denied/i.test(e.message)
        ? "Microphone access is blocked."
        : "Could not reach the agent.");
      setStatus("error");
    }
  }, [client]);

  const end = useCallback(async () => {
    finish();
    try { await client?.disconnect(); } catch { /* already closed */ }
  }, [client, finish]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    client?.enableMic(!next);
    setMuted(next);
  }, [client, muted]);

  return { status, lines, connectedAt, endedAfter, muted, error, start, end, toggleMute };
}
```

Version notes for `useCall.ts`:
* The `connect` option for the endpoint differs by version. Look in `node_modules/@pipecat-ai/small-webrtc-transport/README.md` and `dist/index.d.ts`. Known variants: `connect({ webrtcRequestParams: { endpoint } })`, `connect({ webrtcUrl })`, `new SmallWebRTCTransport({ connectionUrl })`. Use whatever the installed version documents.
* If `useRTVIClientEvent` is not exported, look for `usePipecatClientEvent` (same signature).
* If `RTVIEvent.BotTranscript` never fires, use `RTVIEvent.BotTtsText` (word chunks: append with a space) instead. Check by `console.log` once.

**`src/hooks/useCallTimer.ts`** (EXACT):
```ts
import { useEffect, useState } from "react";

export function useCallTimer(connectedAt: number | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!connectedAt) { setSeconds(0); return; }
    const tick = () => setSeconds(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [connectedAt]);
  return seconds;
}
```

**`src/components/Waveform.tsx`** (EXACT logic):
```tsx
import { useEffect, useRef } from "react";
import { usePipecatClientMediaTrack } from "@pipecat-ai/client-react";

const BARS = 28;

export function Waveform({ active }: { active: boolean }) {
  const botTrack = usePipecatClientMediaTrack("audio", "bot");
  const micTrack = usePipecatClientMediaTrack("audio", "local");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ac = new AudioContext();
    const analysers = [botTrack, micTrack].filter(Boolean).map((track) => {
      const analyser = ac.createAnalyser();
      analyser.fftSize = 64;
      ac.createMediaStreamSource(new MediaStream([track as MediaStreamTrack])).connect(analyser);
      return analyser;
    });
    const g = canvas.getContext("2d")!;
    const data = new Uint8Array(32);
    let raf = 0;
    const draw = () => {
      const { width, height } = canvas;
      g.clearRect(0, 0, width, height);
      const levels = new Array(BARS).fill(0);
      for (const a of analysers) {
        a.getByteFrequencyData(data);
        for (let i = 0; i < BARS; i++) levels[i] = Math.max(levels[i], data[i % data.length] / 255);
      }
      const barW = width / BARS;
      g.fillStyle = getComputedStyle(canvas).color;
      levels.forEach((v, i) => {
        const h = Math.max(2, v * height * 0.9);
        g.fillRect(i * barW + barW * 0.3, (height - h) / 2, barW * 0.4, h);
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); void ac.close(); };
  }, [active, botTrack, micTrack]);

  return <canvas ref={canvasRef} className="waveform" width={280} height={48} aria-hidden />;
}
```

### 7.7 Design direction, make it look *made*, not generated

Concept: **"front desk ledger"**, a calm, editorial clinic front‑desk tool. Warm paper background, ink‑black type, one deep green accent, a serif display face for headings and numbers, mono for times/IDs. Density like a real ops tool (Linear/Stripe‑dashboard level of restraint), not a marketing page.

**`src/styles/tokens.css`** (EXACT):
```css
:root {
  --paper: #f5f3ee;
  --surface: #ffffff;
  --surface-2: #faf9f6;
  --ink: #15171b;
  --ink-2: #4a4f58;
  --ink-3: #8b909a;
  --line: #e5e1d8;
  --line-strong: #d4cfc3;
  --accent: #0e6b57;
  --accent-ink: #ffffff;
  --accent-soft: #e2f0eb;
  --danger: #b3432c;
  --danger-soft: #f6e5e0;
  --phone-bg: #0d0f12;
  --phone-ink: #f2f1ee;
  --phone-ink-2: #9aa0a8;

  --font-display: "Instrument Serif", Georgia, serif;
  --font-ui: "Geist Variable", system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, monospace;

  --r-sm: 6px;
  --r-md: 10px;
  --r-phone: 44px;
  --shadow-card: 0 1px 0 rgba(21, 23, 27, 0.04), 0 1px 2px rgba(21, 23, 27, 0.04);
  --shadow-phone: 0 30px 80px -20px rgba(13, 15, 18, 0.45), 0 0 0 1px rgba(13, 15, 18, 0.9);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Typography rules: body 14px/1.45 `--font-ui`, color `--ink`. Section titles: `--font-display`, 26px, weight 400, letter-spacing −0.01em. Labels: 11px, uppercase, letter-spacing 0.08em, `--ink-3`. Times, phone numbers, IDs, timer: `--font-mono` with `font-variant-numeric: tabular-nums`.

**Hard bans** (these make it look AI‑generated): purple/blue gradients, glassmorphism/blur cards, emoji, "AI‑powered"/"Seamless"/"Revolutionize" copy, sparkle icons, drop‑shadow-heavy cards, rounded‑2xl everything, a hero section, stock illustrations, centered marketing layout, more than one accent colour, lorem ipsum.

### 7.8 Layout and components (wording is final, keep it this short)

**Desktop (≥1100px)**, CSS grid, max-width 1360px, centred, 24px gutters:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Linden  Clinic desk            ● Agent online      Tue 24 Nov    [ Try call ] │  TopBar 60px, bottom border --line
├───────────────────────────────────────────────┬──────────────────────────────┤
│ Doctors                       [Today 24][Wed 25][Thu 26]… │ Appointments   12 upcoming │
│ ───────────────────────────────────────────── │ ──────────────────────────── │
│ Dr. Ananya Rao      Cardiology · Room 204      │ APT-7K3Q  Priya Shah          │
│  10:00 10:30 [11:00] 11:30 …  (pills)          │ Dr. Kavya Nair · Wed 25 Nov   │
│ Dr. Vikram Sethi    Orthopedics · Room 112     │ 10:30 AM        98765 43210   │
│  Not in today                                  │ ...                           │
│ ...                                            ├──────────────────────────────┤
│                                                │ Activity                      │
│                                                │ 14:02 check_doctor_availability│
│                                                │       speciality: skin  ✓     │
└───────────────────────────────────────────────┴──────────────────────────────┘
                                                        ┌────────────┐
                                                        │  phone     │  overlay, bottom-right
                                                        └────────────┘
```
Grid: `grid-template-columns: minmax(0, 1.65fr) minmax(340px, 1fr)`. Right column: Appointments (flex 1, scroll inside, max-height ~60vh) above Activity (max-height ~32vh, scroll).

**TopBar.tsx**, left: wordmark "Linden" in `--font-display` 24px + "Clinic desk" 12px `--ink-3`. Right: status dot (8px circle, `--accent` with a soft pulse when `online`, `--ink-3` and text "Offline" when not) + label "Agent online"; today's date in mono; **Try call** button (solid `--accent`, white text, 36px high, radius `--r-sm`, a 14px handset SVG). Button is disabled while a call is active.

**DoctorsPanel.tsx**, header row: title "Doctors" + day selector (7 chips; chip = weekday small caps over day number in display font; selected chip has ink background + paper text). State: `selectedDay` defaulting to `today`. Each doctor = a row (not a card) separated by `--line` hairlines: left column 220px with name (15px, 500) and "Speciality · Room" (`--ink-3`); right: wrap of slot pills for the selected day.
* Pill: mono 12px, 28px tall, padding 0 10px, radius 999px.
* `available`: `--surface`, border `--line-strong`, ink text.
* `booked`: `--surface-2`, text `--ink-3`, line‑through, no border.
* `past`: hidden.
* Flash (`flash["slot:"+id]`): `booked` → animate background `--accent` → settle to booked style (600ms); `cancelled` → animate `--danger-soft` then available style.
* Doctor not working that day: text "Not in" (`--ink-3`, italic display font).
* Count at end of row: "6 open" (mono, `--ink-3`).

**AppointmentsPanel.tsx**, title "Appointments", right side count "N upcoming". Toggle (two tiny text buttons): "Upcoming" (default: status booked) / "All". List rows (already newest‑first from API):
* line 1: patient name (500) + right: status (only when cancelled: small `--danger` text "Cancelled").
* line 2: `Dr. Name · Wed 25 Nov` (`--ink-2`) + right: time (mono).
* line 3: ID (mono, `--ink-3`) + right: `phoneDisplay` (mono, `--ink-3`).
* Cancelled rows: opacity .55, name line‑through.
* Flash: booked → left 3px bar `--accent` + background `--accent-soft` fading over 2.6s; cancelled → `--danger-soft`. When a flash appears, `scrollIntoView({ block: "nearest", behavior: "smooth" })` that row.
* New rows animate in with `motion` (`initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}}`, 240ms, `--ease-out`). Use `<AnimatePresence initial={false}>` and `layout` on rows.
* Empty: "No appointments yet."

**ActivityLog.tsx**, title "Activity". Mono 12px rows: `HH:MM` (`--ink-3`) · tool name (ink) · compact args (`speciality: skin`, `date: 2026-11-26`, phone shown as last 4 digits only `••3210`) · result mark (`ok` → small `--accent` dot; error → `--danger` text of the error code, e.g. `PHONE_NOT_CONFIRMED`). Empty: "Agent actions show up here."

**PhoneCall.tsx**, rendered when `status !== "idle"`. Fixed position bottom‑right (24px from edges), 340×700, radius `--r-phone`, background `--phone-bg`, `--shadow-phone`, 10px inner bezel. Enters with `motion`: from `y: 40, scale: .96, opacity: 0` to rest (320ms `--ease-out`); exits reverse. Inside, top to bottom:
1. Status bar: tiny mono time (current HH:MM) left, three small SVG bars right. Notch pill centred.
2. Avatar: 64px circle with serif "L" monogram on `--accent`; when `ringing`, two concentric rings expand & fade (CSS keyframes, 1.6s infinite).
3. Name: "Linden Clinic" (display font 28px, `--phone-ink`). Sub‑line (`--phone-ink-2`, 13px): `ringing` → "Calling…"; `connected` → timer `mm:ss` (mono); `ended` → "Call ended · mm:ss"; `error` → the error text.
4. `Waveform` (only `connected`), colour `--accent` lightened (`#5fc3a8`).
5. Transcript (flex 1, scroll, auto‑scroll to bottom on new text): agent lines left, `--phone-ink`; user lines right in a bubble `rgba(255,255,255,.08)`; interim text italic `--phone-ink-2`. Small label above first line of each turn: "Asha" / "You" (10px uppercase). Empty while ringing.
6. `ConfirmationCard` slides up from the bottom of the transcript area when `lastChange` arrives *during this call* (`lastChange.at` ≥ call start): white card, radius 16px; booked → green check SVG, "Booked", `Dr. Name`, `Wed 25 Nov · 10:30 AM`, mono ID; cancelled → `--danger` "Cancelled" + same details. Auto‑hides after 6s or on next change.
7. Controls row: **Mute** (56px circle, `rgba(255,255,255,.1)`, mic / mic‑off SVG, label "Mute"/"Unmute" under it, toggles white background when muted) and **End** (56px circle `#e5484d`, handset‑down SVG, label "End"). In `ended` and `error` states show a single "Close" text button (error state also "Retry").

**Transcript.tsx**, **ConfirmationCard.tsx**, presentational; props as described above.

**App.tsx**, composes: `const data = useClinicData(); const call = useCall();` Pass `call.start` to TopBar; render `PhoneCall` with `call` + `data.lastChange`; panels get `data`. While a call is active, add `aria-live="polite"` region in the phone for new agent lines.

**Footer** (one line, 12px, `--ink-3`): "Mock data · Gemini · ElevenLabs · Pipecat" and a text button "Reset data" → `api.reset()` with `confirm("Reset all demo data?")`.

**Mobile (<768px):** single column (Doctors, then Appointments, then Activity); TopBar wraps date under the wordmark; **phone overlay becomes full screen** (inset 0, radius 0, no bezel). Day chips scroll horizontally. Tap targets ≥44px.

**Motion & accessibility:** respect `@media (prefers-reduced-motion: reduce)` → disable ring pulse, flashes become instant colour changes, no slide‑ins. All icon buttons have `aria-label`. Visible focus ring: `outline: 2px solid var(--accent); outline-offset: 2px`. Colour contrast of text ≥ 4.5:1 (the tokens above satisfy this on paper/white).

### 7.9 Self‑review checklist for the UI (do it before saying "done")

- [ ] No word on screen that a real clinic tool wouldn't have. No taglines.
- [ ] Only one accent colour; danger only for cancel/error.
- [ ] All times/IDs/phones are mono and tabular.
- [ ] Booking during a call: appointment row appears at top with green flash, slot pill turns booked, phone shows confirmation card, activity shows the tool calls.
- [ ] Cancellation: row strikes through with red flash, slot pill becomes available again.
- [ ] Phone: ringing animation + ring sound → connect chime + timer → end tone + "Call ended · mm:ss" → closes.
- [ ] Mute actually stops the agent from hearing you.
- [ ] Mobile width 375px: no horizontal scroll, phone is full screen.
- [ ] Browser console has no errors or React key warnings.

---

## 8. Verification protocol (do this right after installing, before writing `bot.py`/`main.py`/`useCall.ts`)

Pipecat evolves quickly; class paths and option names move. **Never guess, read the installed code.**

```bash
cd server && source .venv/bin/activate
python -c "import pipecat, os; print(pipecat.__version__ if hasattr(pipecat,'__version__') else ''); print(os.path.dirname(pipecat.__file__))"
```
```bash
pip show pipecat-ai | head -3
```
Then, with `P` = the printed directory, check each symbol (run each grep; note results in `NOTES.md`):

| Symbol used in this plan | Command | If missing |
|---|---|---|
| `SmallWebRTCTransport` | `grep -rn "class SmallWebRTCTransport" $P/transports` | use the path grep finds |
| `SmallWebRTCConnection`, `IceServer` | `grep -rn "class SmallWebRTCConnection\|class IceServer" $P/transports` | use the path found |
| `SmallWebRTCRequestHandler` (PATCH support) | `grep -rn "class SmallWebRTCRequestHandler" $P` | if found, use it per official example |
| `LLMContext`, `LLMContextAggregatorPair` | `grep -rn "class LLMContext\b\|class LLMContextAggregatorPair" $P/processors` | use `OpenAILLMContext` fallback (6.14) |
| `LLMRunFrame` | `grep -n "class LLMRunFrame" $P/frames/frames.py` | use `get_context_frame()` fallback |
| `ElevenLabsSTTService` + its `InputParams` | `grep -n "class ElevenLabs.*STTService\|class InputParams\|def __init__" $P/services/elevenlabs/stt.py` | match constructor args exactly |
| `ElevenLabsTTSService` args | `grep -n "def __init__" -A 25 $P/services/elevenlabs/tts.py` | match `model` arg name |
| `GoogleLLMService` args | `grep -n "def __init__" -A 25 $P/services/google/llm.py` | match `model`/`system_instruction` |
| `FunctionSchema`, `ToolsSchema` | `grep -rn "class FunctionSchema\|class ToolsSchema" $P/adapters` | use found path |
| `FunctionCallParams.result_callback` | `grep -rn "class FunctionCallParams" -A 15 $P/services` | adapt handler |
| RTVI auto in `PipelineTask` | `grep -n "rtvi" $P/pipeline/task.py` | if built‑in, don't add a second processor |

**Best source of truth:** the official examples for the *same version tag* on GitHub (`pipecat-ai/pipecat`, folder `examples/foundational/`, especially the function‑calling example and any `*smallwebrtc*`/`p2p-webrtc` example; and the `pipecat-ai/pipecat-examples` repo's `p2p-webrtc/voice-agent`). Copy their wiring for transport/signalling/context, keep our logic.

Frontend: after `npm install`, open
`web/node_modules/@pipecat-ai/client-js/dist/index.d.ts` → confirm `RTVIEvent` members (`BotReady`, `UserTranscript`, `BotTranscript`, `Disconnected`), `initDevices`, `connect`, `disconnect`, `enableMic`;
`web/node_modules/@pipecat-ai/client-react/dist/index.d.ts` → confirm `PipecatClientProvider`, `PipecatClientAudio`, `usePipecatClient`, `useRTVIClientEvent`, `usePipecatClientMediaTrack`;
`web/node_modules/@pipecat-ai/small-webrtc-transport/README.md` → how to pass the `/api/offer` endpoint.

---

## 9. Build phases with checkpoints

Time budget (deadline tomorrow 23:00 IST): Phases 0–4 ≈ 2h, Phase 5 ≈ 2h, Phases 6–7 ≈ 4h, Phase 8 ≈ 2h, Phases 9–10 ≈ 1.5h. If behind schedule, skip Phase 8 items in reverse order of the list.

### Phase 0, Accounts & keys (the HUMAN does this; the AI must not create accounts)
1. Google AI Studio → create API key (free tier, no billing needed). Note the newest free "flash" model name.
2. ElevenLabs → free account → Profile → API keys → create a key with **Speech to Text** and **Text to Speech** permissions enabled. Copy a voice ID from Voices (a default/premade voice works on the free plan).
3. Put both into `server/.env` (created from `.env.example`). Never paste keys into chat or code.
4. Note: ElevenLabs free credits are limited (check the usage page). A 2‑minute test call costs roughly 1–2k TTS characters. Budget: ≤6 voice test calls before recording the video.

### Phase 1, Scaffold
1. In repo root: create `.gitignore` (6.3) **first**, then `git init`.
2. `cd server && python3.12 -m venv .venv && source .venv/bin/activate && pip install -U pip && pip install -r requirements.txt`
3. Create all `server/app/*.py` files from Section 6 (bot.py/main.py can wait until Phase 5).
4. Run Section 8 verification for backend; write findings in `NOTES.md`.
**Checkpoint:** `python -c "import app.config, app.db"` runs from `server/` without error.

### Phase 2, Data layer
1. `db.py`, `seed.py`, `repository.py`, `timeutil.py`, `phone.py`.
2. `python -m app.seed --reset` → prints "Seeded."
3. `sqlite3 data/clinic.db "select count(*) from slots; select count(*) from appointments;"` → slots ~200+, appointments ~25–45.
**Checkpoint:** `pytest tests/test_phone.py tests/test_timeutil.py tests/test_repository.py` all green.

### Phase 3, Tools + prompt
1. `tools.py`, `events.py`, `prompts.py`.
2. `python -c "from app.prompts import build_system_prompt; print(build_system_prompt())"` → shows correct today + 7 dates + 6 doctors.
**Checkpoint:** full `pytest` green.

### Phase 4, REST + SSE (without bot)
Temporarily comment out the `/api/offer` route and the bot/pipecat imports in `main.py`, or finish `bot.py` now with the verified imports, either is fine.
1. `uvicorn app.main:app --port 7860`
2. `curl -s localhost:7860/api/health` → `{"ok":true}`
3. `curl -s localhost:7860/api/doctors | python -m json.tool | head -40` → 7 `days`, 6 doctors with slots.
4. `curl -s localhost:7860/api/appointments | python -m json.tool | head -30` → newest first; contains phone `9876543210`.
5. In terminal A: `curl -N localhost:7860/api/events`; in terminal B: `curl -X POST localhost:7860/api/reset` → terminal A prints a `data.reset` event.
**Checkpoint:** all five pass.

### Phase 5, Voice bot
1. Write `bot.py` and the `/api/offer` route using verified imports.
2. Fastest test before the React app exists: if `pipecat-ai-small-webrtc-prebuilt` installed, mount its UI (check its README for the exact mount line; it is typically `from pipecat_ai_small_webrtc_prebuilt.frontend import SmallWebRTCPrebuiltUI` and `app.mount("/prebuilt", SmallWebRTCPrebuiltUI)`) and open `http://localhost:7860/prebuilt`. Otherwise, go straight to Phase 6 then come back.
3. Talk: "Is Doctor Rao free tomorrow?" → server log shows `tool check_doctor_availability args=...` and you hear options.
**Checkpoint:** one full booking by voice; `curl /api/appointments` shows it at the top; log shows the agent read the number back before `book_appointment`.

Troubleshooting:
* No audio from bot → check ElevenLabs key permissions & voice ID; look for 401/403 in logs.
* Bot never hears you → mic permission; VAD `stop_secs`; STT errors in logs (401 = key lacks STT permission).
* `429` from Gemini → free‑tier rate limit; wait a minute; keep test calls short.
* Bot talks over itself or never stops → make sure `transport.output()` comes **before** `aggregators.assistant()`.
* Agent books without reading the number back → tool returns `PHONE_NOT_CONFIRMED` (by design); tighten prompt wording only if it happens repeatedly.

### Phase 6, Frontend data views
1. Vite scaffold (7.1), tokens, types, api, format, `useClinicData`, `TopBar`, `DoctorsPanel`, `AppointmentsPanel`, `ActivityLog`, footer.
2. `cd web && npm run dev` with the server running.
**Checkpoint:** dashboard shows doctors/slots/appointments; clicking "Reset data" refreshes everything via SSE; `npx tsc --noEmit` has no errors.

### Phase 7, Call integration
1. Verify frontend client APIs (Section 8), then `main.tsx` provider, `sounds.ts`, `useCall`, `useCallTimer`, `PhoneCall`, `Transcript`, `Waveform`, `ConfirmationCard`.
**Checkpoint:** click Try call → ring → connected → speak → transcript appears in the phone → book → dashboard row flashes + card in phone → End → "Call ended" → overlay closes. Then do a cancellation with `9876543210`.

### Phase 8, Polish (bonus, in priority order)
1. Row/slot flash + scroll into view. 2. Confirmation card. 3. Waveform. 4. Mobile layout. 5. Reduced‑motion. 6. Optional: agent says "One moment" while a tool runs (only if Pipecat exposes `on_function_calls_started` on the LLM service; push a `TTSSpeakFrame("One moment.")`; skip if unsure).

### Phase 9, Docs & repo
1. `README.md` (template below), `PIPELINE.md` (draft below, the user must rewrite it in their own words), pin versions in `requirements.txt`, `NOTES.md` short.
2. `git status` → confirm **no `.env`, no `.db`, no `node_modules`**. `git grep -n "sk_\|AIza"` must return nothing.
3. Commit in logical steps (data layer, tools, bot, frontend, docs). Push to a new GitHub repo **only when the user says so**.

### Phase 10, Final QA (run these conversations; all must succeed)
* **Q1 Book:** "I'd like to see a skin doctor." → options → pick one → name → number → read‑back → "yes" → booked → visible on dashboard.
* **Q2 Wrong number correction:** give number, on read‑back say "No, the last digit is 5" → agent re-reads corrected number → books.
* **Q3 Cancel:** "Cancel my appointment" → 98765 43210 → read‑back → agent names the Dr. Malhotra appointment → "yes" → cancelled, row strikes through.
* **Q4 All three in one call:** check availability, book, then cancel that same booking, in one call.
* **Q5 Unknown doctor:** "Doctor Kumar" → agent says not found and lists who is available.
* **Q6 Interruption:** talk while the agent is speaking → it stops and listens.
* **Q7 Sunday / past date:** ask for a Sunday → agent offers next available.
* **Q8 Restart:** stop and start the server → data persists; `ensure_future_slots` added today's slots.

---

## 10. README.md template (fill in; keep it short)

````markdown
# Linden, Voice appointment desk

Voice agent that checks doctor availability, books and cancels appointments, identifying callers only by the phone number they say. Dashboard shows doctors, slots, appointments, live transcript and agent activity.

**LLM:** Google Gemini (`gemini-2.5-flash`, free tier) · **STT/TTS:** ElevenLabs (Scribe / Flash v2.5) · **Voice framework:** Pipecat (SmallWebRTC transport, Silero VAD) · **Data:** SQLite mock data

## Run locally
Requirements: Python 3.12, Node 20+, a Gemini API key, an ElevenLabs API key (STT + TTS permissions).

```bash
cd server
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn app.main:app --port 7860
```
```bash
cd web
npm install
npm run dev            # open http://localhost:5173
```
Reset demo data: `python -m app.seed --reset` (or "Reset data" in the footer). Demo number with an existing booking: 98765 43210.

## How it works
(2–4 lines + the pipeline diagram from PIPELINE.md)

## Project layout
(tree of server/app and web/src with one-line descriptions)

## Tests
`cd server && pytest`
````

## 11. Submission material

### 11.1 `PIPELINE.md` draft (user must rewrite in their own words, interviewers check this)

> The browser connects to a Python server over WebRTC using Pipecat's peer‑to‑peer transport. Incoming audio goes through Silero VAD, which decides when I've stopped talking; that segment goes to ElevenLabs Scribe for transcription. The text is added to the conversation context and sent to Gemini 2.5 Flash, which has three tools: check availability, book and cancel. Tools run against a SQLite database of mock doctors and 30‑minute slots. Booking and cancelling require the phone number plus a `phone_confirmed` flag, so the model has to read the number back and get a yes first; the code refuses otherwise. Gemini's reply goes to ElevenLabs TTS and streams back to the browser. Separately, every tool call publishes an event on a Server‑Sent Events stream, which is how the dashboard updates and highlights rows in real time.

### 11.2 Video script (≤3 minutes; record with screen + system audio)
1. 0:00–0:15 Dashboard overview: doctors/slots, appointments, activity (no talking needed beyond one line).
2. 0:15–0:25 Click **Try call** → ringing → connected.
3. 0:25–2:15 "Hi, I need a skin doctor this week." → agent offers times → "Thursday 11 AM please." → name → number → agent reads it back → "Yes." → agent confirms. Point out: tool calls in Activity, new row flashes at the top, slot pill becomes booked, confirmation card in the phone.
4. 2:15–2:40 (if time) "Actually, can you check when Doctor Rao is free?" to show a third interaction, or a quick cancellation.
5. 2:40–2:55 End call → ended state. Done.
Tip: do one dry run first; keep answers short to save ElevenLabs credits.

### 11.3 Submit (the USER does this)
GitHub link + video + pipeline description in the Google Form from the PDF, before **Wed 25 Nov, 11:00 PM IST**. Do not reply to the email.

---

## 12. Never do this (common mistakes)

1. Committing `.env` or keys; creating `.gitignore` after the first commit.
2. Renaming the three tools or changing their required params.
3. Putting SQL or business rules in `bot.py`, `main.py`, or React components.
4. Calling SQLite directly inside async code without `asyncio.to_thread` (blocks audio).
5. Using Daily, LiveKit, Twilio or any paid/sign‑up transport. SmallWebRTC only.
6. Letting the LLM pick slot times that didn't come from a tool result (prompt + `slot_id` prevent this).
7. Using `%-d` in `strftime`, hardcoding today's date, or doing date arithmetic in the LLM (the prompt gives the date table).
8. Markdown, emoji, bullet lists in agent replies (TTS reads them aloud).
9. Creating `PipecatClient` inside a component; opening multiple `EventSource`s.
10. Making voice calls to debug logic, use pytest.
11. Upgrading packages mid‑build; mixing versions of `@pipecat-ai/*` packages (keep them on matching major versions).
12. Adding login, OTP or caller‑ID identification (explicitly not allowed).
13. Generic AI look: gradients, glass, emoji, taglines, hero sections, icon packs.
14. Running `uvicorn --reload` while testing calls.
15. Claiming something works without running its checkpoint.

## 13. Interview prep (for the human, the AI should make sure the code makes these answers true)

* **Why SmallWebRTC?** Free, peer‑to‑peer, no third‑party room service; fine for a local demo. In production you'd use Daily/LiveKit/Twilio for NAT traversal, scaling and PSTN.
* **Why is double booking impossible?** `BEGIN IMMEDIATE` transaction + partial unique index on `appointments(slot_id) WHERE status='booked'`.
* **How is the phone confirmation enforced?** Prompt tells the model to read back and wait for yes; the tool also rejects calls without `phone_confirmed=true` and returns the exact read‑back sentence to use.
* **How does the dashboard update?** Tool wrapper publishes events to an in‑process pub/sub; `/api/events` streams them over SSE; React refetches and highlights.
* **Why VAD?** Detects end of speech so STT gets clean segments and the bot can be interrupted (barge‑in).
* **What would you do next?** Real telephony (Twilio + Pipecat), Postgres, auth for staff dashboard, reminders via SMS, multilingual (Hindi) STT/TTS, per‑call session isolation for events, observability (Pipecat metrics, latency per stage).
