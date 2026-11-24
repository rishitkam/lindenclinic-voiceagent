// Hand-drawn 24px line icons (no icon pack).
type P = { size?: number };
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const PhoneIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 4h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.7 1.6A15.6 15.6 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4z" />
  </svg>
);

export const HangUpIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M3.2 13.6c4.9-4.3 12.7-4.3 17.6 0l-1.9 2.6-3.4-1.1v-2.4a12 12 0 0 0-7 0v2.4l-3.4 1.1z" />
  </svg>
);

export const MicIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);

export const MicOffIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M15 10V6a3 3 0 0 0-5.8-1.1M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .9-.2 1.8-.5 2.6M12 17.5V21M4 4l16 16" />
  </svg>
);

export const CheckIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

export const CrossIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
