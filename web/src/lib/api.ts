import type { Appointment, DoctorsResponse } from "../types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  doctors: () => get<DoctorsResponse>("/api/doctors"),
  appointments: () => get<Appointment[]>("/api/appointments"),
  reset: () => fetch("/api/reset", { method: "POST" }),
};
