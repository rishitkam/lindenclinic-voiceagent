import { hhmmss } from "../lib/format";
import type { ClinicEvent } from "../types";

type ToolEvent = Extract<ClinicEvent, { type: "tool" }>;

const SHORT: Record<string, string> = {
  check_doctor_availability: "availability",
  book_appointment: "book",
  cancel_appointment: "cancel",
};

function describeArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([k, v]) => v !== undefined && v !== "" && k !== "phone_confirmed")
    .map(([k, v]) => {
      if (k === "phone") return `phone ••${String(v).replace(/\D/g, "").slice(-4)}`;
      return `${k.replace(/_/g, " ")} ${String(v)}`;
    })
    .join(" · ");
}

export function ActivityLog({ items }: { items: ToolEvent[] }) {
  return (
    <section className="section card activity">
      <div className="section-head">
        <h2>Activity</h2>
      </div>
      <ul className="log mono">
        {items.map((e, i) => (
          <li key={`${e.at}-${i}-${items.length}`}>
            <span className="log-time">{hhmmss(e.at)}</span>
            <span className="log-name">{SHORT[e.name] ?? e.name}</span>
            <span className="log-args">{describeArgs(e.args)}</span>
            {e.ok ? <span className="log-ok" aria-label="ok" /> : <span className="log-err">{e.error}</span>}
          </li>
        ))}
        {items.length === 0 ? <li className="empty">Agent actions show up here.</li> : null}
      </ul>
    </section>
  );
}
