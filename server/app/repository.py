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
