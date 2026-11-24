import { motion } from "motion/react";
import type { Appointment, DoctorsResponse } from "../types";
import { PhoneIcon } from "./Icons";

interface Props {
  doctors: DoctorsResponse | null;
  appointments: Appointment[];
  online: boolean;
  callActive: boolean;
  onCall: () => void;
}

const spring = { type: "spring" as const, bounce: 0, duration: 0.5 };

export function Hero({ doctors, appointments, online, callActive, onCall }: Props) {
  const today = doctors?.today;
  const allSlots = doctors?.doctors.flatMap((d) => d.slots) ?? [];
  const open = allSlots.filter((s) => s.status === "available").length;
  const upcoming = appointments.filter((a) => a.status === "booked").length;
  // "In today" — or the next day with open slots once today's clinic is over.
  const focusDay =
    doctors?.days.find((d) => allSlots.some((s) => s.date === d && s.status === "available")) ?? today;
  const inFocus = doctors?.doctors.filter((d) => d.slots.some((s) => s.date === focusDay && s.status !== "past")).length ?? 0;
  const focusDayName =
    focusDay === today ? "Today" : new Date(`${focusDay}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
  const dateLabel = today
    ? new Date(`${today}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
    : "";

  const stats = [
    { value: open, label: "Open slots", sub: "Next 7 days" },
    { value: upcoming, label: "Upcoming", sub: "Appointments" },
    { value: inFocus, label: "Doctors in", sub: `${focusDayName} · of ${doctors?.doctors.length ?? 0}` },
  ];

  return (
    <section className="hero">
      <motion.div
        className="hero-intro"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <span className="eyebrow">{dateLabel}</span>
        <h1>
          The front desk,
          <br />
          <span className="h1-soft">answered by voice.</span>
        </h1>
        <p className="lede">Asha checks availability, books and cancels — identifying callers by the number they say.</p>
      </motion.div>

      <div className="hero-grid">
        <motion.button
          className="call-card"
          onClick={onCall}
          disabled={callActive || !online}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="call-card-top">
            <span className={`live ${online ? "is-on" : ""}`}>
              <span className="live-dot" />
              {online ? "Agent online" : "Agent offline"}
            </span>
          </span>
          <span className="call-card-title">Try a call</span>
          <span className="call-card-sub">Talk to Asha from your browser.</span>
          <span className="call-card-btn" aria-hidden>
            <PhoneIcon size={22} />
          </span>
        </motion.button>

        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="stat"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.08 + i * 0.04 }}
          >
            <span className="stat-label">{s.label}</span>
            <span className="stat-value">{s.value}</span>
            <span className="stat-sub">{s.sub}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
