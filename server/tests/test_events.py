"""The Pipecat tool wrapper must publish dashboard events (this is how the UI updates live)."""
import asyncio

from app import events
from app import repository as repo
from app.tools import _make_handler, book_appointment, cancel_appointment


class FakeParams:
    """Stands in for pipecat's FunctionCallParams: arguments in, result_callback out."""

    def __init__(self, arguments):
        self.arguments = arguments
        self.result = None

    async def result_callback(self, result):
        self.result = result


def drain(queue):
    out = []
    while not queue.empty():
        out.append(queue.get_nowait())
    return out


def test_booking_and_cancelling_publish_events():
    async def scenario():
        queue = events.subscribe()
        try:
            slot_id = repo.available_slots("dr-rohan-desai")[0]["id"]
            book = FakeParams({"slot_id": slot_id, "phone": "9000000009", "phone_confirmed": True, "patient_name": "T"})
            await _make_handler("book_appointment", book_appointment)(book)
            assert book.result["ok"] and "_events" not in book.result  # private key never reaches the LLM
            booked = drain(queue)
            assert [e["type"] for e in booked] == ["tool", "appointment.booked"]
            assert booked[1]["appointment"]["slotId"] == slot_id

            appt_id = book.result["appointment"]["appointment_id"]
            cancel = FakeParams({"phone": "9000000009", "phone_confirmed": True, "appointment_id": appt_id})
            await _make_handler("cancel_appointment", cancel_appointment)(cancel)
            assert [e["type"] for e in drain(queue)] == ["tool", "appointment.cancelled"]
        finally:
            events.unsubscribe(queue)

    asyncio.run(scenario())


def test_failed_tool_publishes_error_event_only():
    async def scenario():
        queue = events.subscribe()
        try:
            params = FakeParams({"slot_id": 1, "phone": "9000000009", "phone_confirmed": False})
            await _make_handler("book_appointment", book_appointment)(params)
            published = drain(queue)
            assert len(published) == 1 and published[0]["error"] == "PHONE_NOT_CONFIRMED"
        finally:
            events.unsubscribe(queue)

    asyncio.run(scenario())
