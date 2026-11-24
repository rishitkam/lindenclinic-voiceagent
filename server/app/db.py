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
