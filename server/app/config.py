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


def missing_keys() -> list[str]:
    """Env vars a voice call needs but that are empty, so the UI can say exactly what to fill in."""
    llm_key = "OPENAI_API_KEY" if env("LLM_PROVIDER", "gemini").lower() == "openai" else "GOOGLE_API_KEY"
    needed = [llm_key, "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]
    return [name for name in needed if not os.getenv(name, "").strip()]
