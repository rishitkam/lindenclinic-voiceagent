import { useEffect, useState } from "react";
import { dayChip } from "../lib/format";
import type { DoctorsResponse } from "../types";

interface Props {
  data: DoctorsResponse | null;
  flash: Record<string, "booked" | "cancelled">;
}

export function DoctorsPanel({ data, flash }: Props) {
  const [day, setDay] = useState<string | null>(null);
  // Default to the first day that still has an open slot (late evening, "today" is all past).
  const firstOpen = data?.days.find((d) => data.doctors.some((doc) => doc.slots.some((s) => s.date === d && s.status === "available")));
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
    <section className="panel doctors">
      <div className="panel-head">
        <h2>Doctors</h2>
        <div className="days" role="tablist" aria-label="Day">
          {data?.days.map((iso) => {
            const chip = dayChip(iso, data.today);
            return (
              <button
                key={iso}
                role="tab"
                aria-selected={iso === selected}
                className={`day ${iso === selected ? "is-selected" : ""}`}
                onClick={() => setDay(iso)}
              >
                <span className="day-name">{chip.weekday}</span>
                <span className="day-num">{chip.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="doctor-list">
        {data?.doctors.map((doc) => {
          const daySlots = doc.slots.filter((s) => s.date === selected);
          const slots = daySlots.filter((s) => s.status !== "past");
          const emptyText = isSunday ? "Closed" : daySlots.length ? "Done for the day" : "Not in";
          const open = slots.filter((s) => s.status === "available").length;
          return (
            <li key={doc.id} className="doctor">
              <div className="doctor-meta">
                <span className="doctor-name">{doc.name}</span>
                <span className="doctor-sub">
                  {doc.speciality} · {doc.room}
                </span>
              </div>
              <div className="slots">
                {slots.length === 0 ? (
                  <span className="not-in">{emptyText}</span>
                ) : (
                  slots.map((s) => (
                    <span
                      key={s.id}
                      className={`pill mono is-${s.status} ${flash[`slot:${s.id}`] ? `flash-${flash[`slot:${s.id}`]}` : ""}`}
                      title={s.status === "booked" ? "Booked" : "Open"}
                    >
                      {s.label}
                    </span>
                  ))
                )}
              </div>
              <span className="open-count mono">{slots.length ? `${open} open` : ""}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
