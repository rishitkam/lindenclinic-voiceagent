import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { CallController } from "../hooks/useCall";
import { useCallTimer } from "../hooks/useCallTimer";
import { clock } from "../lib/format";
import type { Appointment } from "../types";
import { ConfirmationCard } from "./ConfirmationCard";
import { HangUpIcon, MicIcon, MicOffIcon } from "./Icons";
import { Transcript } from "./Transcript";
import { Waveform } from "./Waveform";

type Change = { kind: "booked" | "cancelled"; appointment: Appointment; seq: number } | null;

interface Props {
  call: CallController;
  change: Change;
}

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="phone-status mono">
      <span>{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
      <span className="notch" />
      <span className="signal" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function PhoneCall({ call, change }: Props) {
  const seconds = useCallTimer(call.status === "connected" ? call.connectedAt : null);
  const [card, setCard] = useState<Change>(null);

  // Show a confirmation card for bookings/cancellations that happen during this call.
  useEffect(() => {
    if (!change || call.status !== "connected") return;
    setCard(change);
    const id = window.setTimeout(() => setCard(null), 6000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change?.seq]);

  useEffect(() => {
    if (call.status === "idle") setCard(null);
  }, [call.status]);

  const sub =
    call.status === "ringing"
      ? "Calling…"
      : call.status === "connected"
        ? clock(seconds)
        : call.status === "ended"
          ? `Call ended · ${clock(call.endedAfter)}`
          : (call.error ?? "");

  return (
    <AnimatePresence>
      {call.status !== "idle" && (
        <motion.div
          className="phone-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`phone is-${call.status}`}
            role="dialog"
            aria-label="Call with Linden Clinic"
            initial={{ y: 60, scale: 0.92, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 60, scale: 0.92, opacity: 0, filter: "blur(8px)" }}
            transition={{ type: "spring", bounce: 0, duration: 0.45 }}
          >
            <div className="phone-screen">
              <StatusBar />

              <div className={`caller ${call.status === "connected" ? "is-compact" : ""}`}>
                <div className="avatar">
                  <span>L</span>
                  {call.status === "ringing" && (
                    <>
                      <i className="ripple" />
                      <i className="ripple r2" />
                    </>
                  )}
                </div>
                <div className="caller-text">
                  <span className="caller-name">Linden Clinic</span>
                  <span className={`caller-sub ${call.status === "connected" ? "mono" : ""}`}>{sub}</span>
                </div>
              </div>

              {call.status === "connected" && <Waveform active />}

              <Transcript lines={call.lines} />

              <div className="card-slot">
                <AnimatePresence>
                  {card && <ConfirmationCard key={card.seq} kind={card.kind} appointment={card.appointment} />}
                </AnimatePresence>
              </div>

              <div className="controls">
                {call.status === "ringing" || call.status === "connected" ? (
                  <>
                    <button
                      className={`round mute ${call.muted ? "is-on" : ""}`}
                      onClick={call.toggleMute}
                      disabled={call.status !== "connected"}
                      aria-label={call.muted ? "Unmute" : "Mute"}
                    >
                      {call.muted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
                      <span>{call.muted ? "Unmute" : "Mute"}</span>
                    </button>
                    <button className="round end" onClick={call.end} aria-label="End call">
                      <HangUpIcon size={24} />
                      <span>End</span>
                    </button>
                  </>
                ) : (
                  <div className="after-call">
                    {call.status === "error" && (
                      <button className="text-btn" onClick={call.start}>
                        Retry
                      </button>
                    )}
                    <button className="text-btn" onClick={call.close}>
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
