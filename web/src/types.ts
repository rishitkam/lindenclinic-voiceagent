export type SlotStatus = "available" | "booked" | "past";
export interface Slot { id: number; startsAt: string; date: string; time: string; label: string; status: SlotStatus; }
export interface Doctor { id: string; name: string; speciality: string; room: string; experienceYears: number; slots: Slot[]; }
export interface DoctorsResponse { today: string; days: string[]; doctors: Doctor[]; }
export interface Appointment {
  id: string; status: "booked" | "cancelled"; patientName: string; phone: string; phoneDisplay: string;
  slotId: number; doctorId: string; doctorName: string; speciality: string; room: string;
  startsAt: string; spoken: string; createdAt: string; cancelledAt: string | null;
}
export type ClinicEvent =
  | { type: "appointment.booked"; appointment: Appointment; at: string }
  | { type: "appointment.cancelled"; appointment: Appointment; at: string }
  | { type: "tool"; name: string; args: Record<string, unknown>; ok: boolean; error: string | null; at: string }
  | { type: "call.started" | "call.ended" | "data.reset"; at: string };
export type CallStatus = "idle" | "ringing" | "connected" | "ended" | "error";
export interface TranscriptLine {
  id: number;
  role: "user" | "agent";
  text: string;
  interim: string;
  /** agent only: sentence text keyed by segment id, so repeated updates replace instead of duplicating */
  segments?: Record<number, string>;
}
