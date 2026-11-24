import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { dayChip } from "../lib/format";
import type { DoctorsResponse } from "../types";

interface Props {
  data: DoctorsResponse | null;
  flash: Record<string, "booked" | "cancelled">;
}

const TINT: Record<string, string> = {
  Cardiology: "var(--t-cardio)",
  Orthopedics: "var(--t-ortho)",
  Dermatology: "var(--t-derm)",
  "General Medicine": "var(--t-general)",
  Pediatrics: "var(--t-peds)",
  ENT: "var(--t-ent)",
};

const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

export function DoctorsPanel({ data, flash }: Props) {
  const [day, setDay] = useState<string | null>(null);
  // Default to the first day that still has an open slot (late evening, "today" is all past).
  const firstOpen = data?.days.find((d) =>
    data.doctors.some((doc) => doc.slots.some((s) => s.date === d && s.status === "available")),
  );
  const selected = day ?? firstOpen ?? data?.today ?? null;
  const isSunday = selected ? new Date(`${selected}T00:00:00`).getDay() === 0 : false;

  // When the agent books/cancels a slot on another day, jump to that day so the change is visible.
  useEffect(() => {
    if (!data) return;
    const flashedSlot = Object.keys(flash).find((k) => k.startsWith("slot:"));
    if (!flashedSlot) return;
    const id = Number(flashedSlot.slice(5));
    const slot = data.doctors.flatMap((d) => d.slots).find((s) => s.id === id);
    if (slot) setDay(slot.date);
  }, [flash, data]);

  return (
    <section className="section doctors">
      <div className="section-head">
        <div>
          <h2>Doctors</h2>
          <p className="section-sub">Live availability, updated as Asha books.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Day">
          {data?.days.map((iso) => {
            const chip = dayChip(iso, data.today);
            const on = iso === selected;
            return (
              <button key={iso} role="tab" aria-selected={on} className={`seg ${on ? "is-on" : ""}`} onClick={() => setDay(iso)}>
                {on && <motion.span layoutId="seg-thumb" className="seg-thumb" transition={{ type: "spring", bounce: 0, duration: 0.35 }} />}
                <span className="seg-name">{chip.weekday}</span>
                <span className="seg-num">{chip.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="doctor-grid">
        {data?.doctors.map((doc) => {
          const daySlots = doc.slots.filter((s) => s.date === selected);
          const slots = daySlots.filter((s) => s.status !== "past");
          const open = slots.filter((s) => s.status === "available").length;
          const emptyText = isSunday ? "Closed on Sundays" : daySlots.length ? "Done for the day" : "Not in this day";
          const tint = TINT[doc.speciality] ?? "var(--blue)";
          return (
            <article key={doc.id} className="doctor-card" style={{ ["--tint" as string]: tint }}>
              <header className="doctor-head">
                <span className="doctor-avatar">{initials(doc.name)}</span>
                <div className="doctor-meta">
                  <span className="doctor-name">{doc.name}</span>
                  <span className="doctor-sub">
                    {doc.speciality} · {doc.room}
                  </span>
                </div>
                {slots.length > 0 && (
                  <span className="open-badge">
                    <b>{open}</b> open
                  </span>
                )}
              </header>
              <div className="slots">
                {slots.length === 0 ? (
                  <span className="not-in">{emptyText}</span>
                ) : (
                  slots.map((s) => {
                    const f = flash[`slot:${s.id}`];
                    return (
                      <span key={s.id} className={`pill is-${s.status} ${f ? `flash-${f}` : ""}`} title={s.status === "booked" ? "Booked" : "Open"}>
                        {s.label}
                      </span>
                    );
                  })
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
