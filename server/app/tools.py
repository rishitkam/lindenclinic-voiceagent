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


# ---------------- Pipecat glue (REFERENCE — VERIFY imports, see Section 8) ----------------
from pipecat.adapters.llm.schemas.function_schema import FunctionSchema  # noqa: E402
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema  # noqa: E402

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
