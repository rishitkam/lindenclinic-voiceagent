import { useMemo } from "react";
import { ActivityLog } from "./components/ActivityLog";
import { AppointmentsPanel } from "./components/AppointmentsPanel";
import { DoctorsPanel } from "./components/DoctorsPanel";
import { PhoneCall } from "./components/PhoneCall";
import { TopBar } from "./components/TopBar";
import { useCall } from "./hooks/useCall";
import { useClinicData } from "./hooks/useClinicData";
import { api } from "./lib/api";

export default function App() {
  const data = useClinicData();
  const call = useCall();
  const callActive = call.status !== "idle";

  const change = useMemo(
    () =>
      data.lastChange
        ? {
            kind: data.lastChange.type === "appointment.booked" ? ("booked" as const) : ("cancelled" as const),
            appointment: data.lastChange.appointment,
            seq: data.changeSeq,
          }
        : null,
    [data.lastChange, data.changeSeq],
  );

  const reset = async () => {
    if (window.confirm("Reset all demo data?")) await api.reset();
  };

  return (
    <div className="app">
      <TopBar online={data.online} today={data.doctors?.today ?? null} callActive={callActive} onCall={call.start} />
      <main className="grid">
        <DoctorsPanel data={data.doctors} flash={data.flash} />
        <div className="side">
          <AppointmentsPanel appointments={data.appointments} flash={data.flash} />
          <ActivityLog items={data.activity} />
        </div>
      </main>
      <footer className="footer">
        <span>Mock data · Gemini · ElevenLabs · Pipecat</span>
        <button className="text-link" onClick={reset}>
          Reset data
        </button>
      </footer>
      <PhoneCall call={call} change={change} />
    </div>
  );
}
