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
