import { useEffect, useRef } from "react";
import type { TranscriptLine } from "../types";

export function Transcript({ lines }: { lines: TranscriptLine[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div className="transcript" ref={ref} aria-live="polite">
      {lines.map((line) => (
        <div key={line.id} className={`turn is-${line.role}`}>
          <span className="turn-who">{line.role === "agent" ? "Asha" : "You"}</span>
          <p>
            {line.text}
            {line.interim ? <span className="interim"> {line.interim}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}
