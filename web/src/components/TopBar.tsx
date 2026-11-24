import { PhoneIcon } from "./Icons";

interface Props {
  online: boolean;
  today: string | null;
  callActive: boolean;
  onCall: () => void;
}

export function TopBar({ online, today, callActive, onCall }: Props) {
  const date = today
    ? new Date(`${today}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
    : "";
  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">Linden</span>
        <span className="brand-sub">Clinic desk</span>
      </div>
      <div className="topbar-right">
        <span className={`status ${online ? "is-online" : ""}`}>
          <span className="status-dot" />
          {online ? "Agent online" : "Offline"}
        </span>
        <span className="topbar-date mono">{date}</span>
        <button className="btn-primary" onClick={onCall} disabled={callActive || !online}>
          <PhoneIcon size={15} />
          Try call
        </button>
      </div>
    </header>
  );
}
