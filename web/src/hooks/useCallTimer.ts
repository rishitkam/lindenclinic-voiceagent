import { useEffect, useState } from "react";

export function useCallTimer(connectedAt: number | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!connectedAt) { setSeconds(0); return; }
    const tick = () => setSeconds(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [connectedAt]);
  return seconds;
}
