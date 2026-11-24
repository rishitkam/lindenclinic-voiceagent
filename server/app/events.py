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
