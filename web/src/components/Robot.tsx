/**
 * A small robot hanging from a string. Pure SVG + CSS animation (see `.robot-*` in app.css):
 * - the track moves it back and forth across its parent,
 * - the swing rotates it from the top of the string like a pendulum,
 * - eyes blink, the antenna light pulses, and the right arm waves every few seconds.
 */
export function Robot() {
  return (
    <span className="robot-track" aria-hidden>
      <span className="robot-mover">
        <span className="robot-swing">
          <svg className="robot" viewBox="0 0 64 96" width="68" height="102">
            {/* string from the top edge of the card */}
            <line x1="32" y1="0" x2="32" y2="20" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
            {/* antenna */}
            <line x1="32" y1="20" x2="32" y2="28" stroke="#dfe9ff" strokeWidth="2.5" strokeLinecap="round" />
            <circle className="robot-light" cx="32" cy="20" r="3.2" fill="#7dffa1" />
            {/* head */}
            <rect x="12" y="27" width="40" height="30" rx="12" fill="#ffffff" />
            <rect x="17" y="33" width="30" height="17" rx="8" fill="#122056" />
            {/* eyes */}
            <g className="robot-eyes">
              <ellipse cx="26" cy="41.5" rx="3" ry="3.6" fill="#b8bdff" />
              <ellipse cx="38" cy="41.5" rx="3" ry="3.6" fill="#b8bdff" />
            </g>
            {/* cheeks + ears */}
            <circle cx="20.5" cy="47.5" r="1.8" fill="#ff8fb1" opacity="0.8" />
            <circle cx="43.5" cy="47.5" r="1.8" fill="#ff8fb1" opacity="0.8" />
            <rect x="8" y="36" width="5" height="11" rx="2.5" fill="#dfe9ff" />
            <rect x="51" y="36" width="5" height="11" rx="2.5" fill="#dfe9ff" />
            {/* body */}
            <rect x="19" y="58" width="26" height="22" rx="9" fill="#ffffff" />
            <circle cx="32" cy="68" r="4" fill="#5b65dc" />
            <circle cx="32" cy="68" r="1.6" fill="#ffffff" />
            {/* left arm (resting) */}
            <path d="M19 63 q-7 4 -7 11" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
            {/* right arm (waves) */}
            <g className="robot-arm">
              <path d="M45 63 q7 -3 9 -11" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
              <circle cx="54" cy="51" r="3" fill="#ffffff" />
            </g>
            {/* feet */}
            <rect x="22" y="80" width="7" height="5" rx="2.5" fill="#dfe9ff" />
            <rect x="35" y="80" width="7" height="5" rx="2.5" fill="#dfe9ff" />
          </svg>
        </span>
      </span>
    </span>
  );
}
