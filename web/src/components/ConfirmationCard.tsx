import { motion } from "motion/react";
import { whenShort } from "../lib/format";
import type { Appointment } from "../types";
import { CheckIcon, CrossIcon } from "./Icons";

interface Props {
  kind: "booked" | "cancelled";
  appointment: Appointment;
}

export function ConfirmationCard({ kind, appointment }: Props) {
  const when = whenShort(appointment.startsAt);
  return (
    <motion.div
      className={`confirm is-${kind}`}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 16, opacity: 0 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
    >
      <span className="confirm-icon">{kind === "booked" ? <CheckIcon size={16} /> : <CrossIcon size={16} />}</span>
      <div className="confirm-body">
        <span className="confirm-title">{kind === "booked" ? "Booked" : "Cancelled"}</span>
        <span>{appointment.doctorName}</span>
        <span className="confirm-when">
          {when.date} · {when.time}
        </span>
      </div>
      <span className="confirm-id mono">{appointment.id}</span>
    </motion.div>
  );
}
