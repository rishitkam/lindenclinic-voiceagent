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
