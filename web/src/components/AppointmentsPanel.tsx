import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { whenShort } from "../lib/format";
import type { Appointment } from "../types";

interface Props {
  appointments: Appointment[];
  flash: Record<string, "booked" | "cancelled">;
}

export function AppointmentsPanel({ appointments, flash }: Props) {
  const [view, setView] = useState<"upcoming" | "all">("upcoming");
  const listRef = useRef<HTMLUListElement>(null);
  const upcoming = appointments.filter((a) => a.status === "booked");
  // Keep a just-cancelled row visible during its flash, even in the "Upcoming" view.
  const rows = view === "all" ? appointments : appointments.filter((a) => a.status === "booked" || flash[a.id]);

  useEffect(() => {
    const id = Object.keys(flash).find((k) => !k.startsWith("slot:"));
    if (!id) return;
    listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flash]);

  return (
    <section className="panel appointments">
      <div className="panel-head">
        <h2>Appointments</h2>
        <div className="toggle">
          <button className={view === "upcoming" ? "is-on" : ""} onClick={() => setView("upcoming")}>
            Upcoming <span className="mono">{upcoming.length}</span>
          </button>
          <button className={view === "all" ? "is-on" : ""} onClick={() => setView("all")}>
            All
          </button>
        </div>
      </div>
      <ul className="appt-list" ref={listRef}>
        <AnimatePresence initial={false}>
          {rows.map((a) => {
            const when = whenShort(a.startsAt);
            return (
              <motion.li
                key={a.id}
                data-id={a.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className={`appt is-${a.status} ${flash[a.id] ? `flash-${flash[a.id]}` : ""}`}
              >
                <div className="appt-row">
                  <span className="appt-name">{a.patientName}</span>
                  {a.status === "cancelled" ? <span className="appt-cancelled">Cancelled</span> : null}
                </div>
                <div className="appt-row">
                  <span className="appt-doc">
                    {a.doctorName} · {when.date}
                  </span>
                  <span className="mono">{when.time}</span>
                </div>
                <div className="appt-row faint mono">
                  <span>{a.id}</span>
                  <span>{a.phoneDisplay}</span>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {rows.length === 0 ? <li className="empty">No appointments yet.</li> : null}
      </ul>
    </section>
  );
}
