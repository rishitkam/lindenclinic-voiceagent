import { useEffect, useRef } from "react";
import { usePipecatClientMediaTrack } from "@pipecat-ai/client-react";

const BARS = 28;

export function Waveform({ active }: { active: boolean }) {
  const botTrack = usePipecatClientMediaTrack("audio", "bot");
  const micTrack = usePipecatClientMediaTrack("audio", "local");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ac = new AudioContext();
    const analysers = [botTrack, micTrack].filter(Boolean).map((track) => {
      const analyser = ac.createAnalyser();
      analyser.fftSize = 64;
      ac.createMediaStreamSource(new MediaStream([track as MediaStreamTrack])).connect(analyser);
      return analyser;
    });
    const g = canvas.getContext("2d")!;
    const data = new Uint8Array(32);
    let raf = 0;
    const draw = () => {
      const { width, height } = canvas;
      g.clearRect(0, 0, width, height);
      const levels = new Array(BARS).fill(0);
      for (const a of analysers) {
        a.getByteFrequencyData(data);
        for (let i = 0; i < BARS; i++) levels[i] = Math.max(levels[i], data[i % data.length] / 255);
      }
      const barW = width / BARS;
      g.fillStyle = getComputedStyle(canvas).color;
      levels.forEach((v, i) => {
        const h = Math.max(2, v * height * 0.9);
        g.fillRect(i * barW + barW * 0.3, (height - h) / 2, barW * 0.4, h);
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); void ac.close(); };
  }, [active, botTrack, micTrack]);

  return <canvas ref={canvasRef} className="waveform" width={280} height={48} aria-hidden />;
}
