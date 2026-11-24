const pad = (n: number) => String(n).padStart(2, "0");

export function dayChip(iso: string, today: string) {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = iso === today ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" });
  return { weekday, day: d.getDate() };
}

export function whenShort(startsAt: string) {
  const d = new Date(startsAt);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  return { date, time };
}

export function clock(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export function hhmmss(at: string) {
  return at.slice(11, 16);
}
