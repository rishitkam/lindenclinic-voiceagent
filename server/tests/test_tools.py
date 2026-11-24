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
