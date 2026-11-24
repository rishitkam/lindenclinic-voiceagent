import { PhoneIcon } from "./Icons";

interface Props {
  online: boolean;
  callActive: boolean;
  onCall: () => void;
}

/** Translucent sticky toolbar: content scrolls underneath it. */
export function TopBar({ online, callActive, onCall }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            L
          </span>
          <span className="wordmark">Linden</span>
          <span className="brand-sub">Clinic desk</span>
        </div>
        <div className="topbar-right">
          <span className={`status ${online ? "is-online" : ""}`}>
            <span className="status-dot" />
            {online ? "Online" : "Offline"}
          </span>
          <button className="btn-primary" onClick={onCall} disabled={callActive || !online}>
            <PhoneIcon size={14} />
            Try call
          </button>
        </div>
      </div>
    </header>
  );
}
