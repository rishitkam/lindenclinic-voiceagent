import { useMemo } from "react";
import { ActivityLog } from "./components/ActivityLog";
import { CrowdCanvas } from "./components/CrowdCanvas";
import { GradientDots } from "./components/GradientDots";
import { AppointmentsPanel } from "./components/AppointmentsPanel";
import { DoctorsPanel } from "./components/DoctorsPanel";
import { Hero } from "./components/Hero";
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
      {/* Full-page animated dot background, behind everything. */}
      <div className="page-bg" aria-hidden>
        <GradientDots className="page-bg-dots" duration={40} colorCycleDuration={30} />
      </div>
      {/* Walking crowds in the empty side margins on wide screens (hidden when there's no room). */}
      <div className="gutter-crowd is-left" aria-hidden>
        <CrowdCanvas className="crowd-canvas" count={9} />
      </div>
      <div className="gutter-crowd is-right" aria-hidden>
        <CrowdCanvas className="crowd-canvas" count={9} />
      </div>
      <TopBar online={data.online} callActive={callActive} onCall={call.start} />
      <Hero
        doctors={data.doctors}
        appointments={data.appointments}
        online={data.online}
        callActive={callActive}
        onCall={call.start}
      />
      <main className="grid">
        <DoctorsPanel data={data.doctors} flash={data.flash} />
        <div className="side">
          <AppointmentsPanel appointments={data.appointments} flash={data.flash} />
          <ActivityLog items={data.activity} />
        </div>
      </main>
      <footer className="footer">
        <span>
          Mock data · Gemini · ElevenLabs · Pipecat · Illustrations by{" "}
          <a href="https://www.openpeeps.com/" target="_blank" rel="noreferrer">
            Open Peeps
          </a>
          , crowd by{" "}
          <a href="https://skiper-ui.com" target="_blank" rel="noreferrer">
            Skiper UI
          </a>
        </span>
        <button className="text-link" onClick={reset}>
          Reset data
        </button>
      </footer>
      <PhoneCall call={call} change={change} />
    </div>
  );
}
