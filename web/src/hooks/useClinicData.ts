import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Appointment, ClinicEvent, DoctorsResponse } from "../types";

type Flash = "booked" | "cancelled";
type ToolEvent = Extract<ClinicEvent, { type: "tool" }>;
type ApptEvent = Extract<ClinicEvent, { type: "appointment.booked" | "appointment.cancelled" }>;

export function useClinicData() {
  const [doctors, setDoctors] = useState<DoctorsResponse | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activity, setActivity] = useState<ToolEvent[]>([]);
  const [flash, setFlash] = useState<Record<string, Flash>>({}); // keys: appointment id or `slot:<id>`
  const [lastChange, setLastChange] = useState<ApptEvent | null>(null);
  const [changeSeq, setChangeSeq] = useState(0);
  const [online, setOnline] = useState(false);
  const timers = useRef<number[]>([]);

  const refresh = useCallback(async () => {
    const [d, a] = await Promise.all([api.doctors(), api.appointments()]);
    setDoctors(d);
    setAppointments(a);
  }, []);

  const markFlash = useCallback((keys: string[], kind: Flash) => {
    setFlash((f) => ({ ...f, ...Object.fromEntries(keys.map((k) => [k, kind])) }));
    const t = window.setTimeout(() => {
      setFlash((f) => {
        const next = { ...f };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }, 2600);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    refresh().catch(() => setOnline(false));
    const es = new EventSource("/api/events");
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as ClinicEvent;
      if (ev.type === "appointment.booked" || ev.type === "appointment.cancelled") {
        const kind: Flash = ev.type === "appointment.booked" ? "booked" : "cancelled";
        void refresh();
        markFlash([ev.appointment.id, `slot:${ev.appointment.slotId}`], kind);
        setLastChange(ev);
        setChangeSeq((n) => n + 1);
      } else if (ev.type === "tool") {
        setActivity((a) => [ev, ...a].slice(0, 40));
      } else if (ev.type === "data.reset") {
        void refresh();
        setActivity([]);
      }
    };
    return () => {
      es.close();
      timers.current.forEach(clearTimeout);
    };
  }, [refresh, markFlash]);

  return { doctors, appointments, activity, flash, lastChange, changeSeq, online, refresh };
}
