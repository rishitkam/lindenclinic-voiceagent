"""HTTP API: dashboard data, SSE events, and WebRTC signalling for the voice call."""
import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pipecat.transports.smallwebrtc.connection import IceServer
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from . import events
from . import repository as repo
from .config import missing_keys
from .bot import run_bot
from .db import init_schema
from .seed import ensure_future_slots, has_doctors, seed_all

webrtc = SmallWebRTCRequestHandler(ice_servers=[IceServer(urls="stun:stun.l.google.com:19302")])


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_schema()
    if not has_doctors():
        seed_all()
    ensure_future_slots()
    yield
    await webrtc.close()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"ok": True, "missingKeys": missing_keys()}


@app.get("/api/doctors")
async def get_doctors():
    return await asyncio.to_thread(repo.doctors_with_slots)


@app.get("/api/appointments")
async def get_appointments():
    return await asyncio.to_thread(repo.list_appointments)


@app.post("/api/reset")
async def reset():
    await asyncio.to_thread(seed_all, True)
    events.publish({"type": "data.reset"})
    return {"ok": True}


@app.get("/api/events")
async def stream_events(request: Request):
    queue = events.subscribe()

    async def generate():
        try:
            yield "retry: 2000\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            events.unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/offer")
async def offer(body: dict, background_tasks: BackgroundTasks):
    """Browser sends an SDP offer; we answer and start a bot for the new connection."""
    if missing := missing_keys():
        raise HTTPException(503, f"Missing in server/.env: {', '.join(missing)}")

    async def start_bot(connection):
        background_tasks.add_task(run_bot, connection)

    return await webrtc.handle_web_request(SmallWebRTCRequest.from_dict(body), start_bot)


@app.patch("/api/offer")
async def ice_candidates(body: dict):
    """Trickle ICE: the browser sends extra network candidates after the offer."""
    candidates = [IceCandidate(**c) for c in body.get("candidates", [])]
    await webrtc.handle_patch_request(SmallWebRTCPatchRequest(pc_id=body["pc_id"], candidates=candidates))
    return {"ok": True}
