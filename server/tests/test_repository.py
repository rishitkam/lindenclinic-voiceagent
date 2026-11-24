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
