/**
 * Walking crowd drawn on a canvas from a sprite sheet of illustrated people.
 *
 * Adapted from Skiper UI "Skiper 39" by @gurvinder-singh02 (https://gxuri.me), itself inspired by
 * https://codepen.io/zadvorsky/pen/xxwbBQV. Illustrations by Open Peeps (https://www.openpeeps.com/).
 * Attribution to Skiper UI is required by its free licence (see the footer credit).
 *
 * Changes from the original: plain CSS instead of Tailwind, sizes to its container (ResizeObserver),
 * typed peeps, and it stays still when the user prefers reduced motion.
 */
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

const SPRITE_SRC =
  "https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png";

interface Props {
  src?: string;
  rows?: number; // sprites per row in the sheet
  cols?: number; // sprites per column in the sheet
  count?: number; // how many people walk at once
  className?: string;
}

interface Peep {
  rect: [number, number, number, number];
  width: number;
  height: number;
  x: number;
  y: number;
  anchorY: number;
  scaleX: number;
  walk: gsap.core.Timeline | null;
}

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

export function CrowdCanvas({ src = SPRITE_SRC, rows = 15, cols = 7, count = 18, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const stage = { width: 0, height: 0, scale: 1 };
    const allPeeps: Peep[] = [];
    let available: Peep[] = [];
    let crowd: Peep[] = [];

    const createPeeps = () => {
      const w = img.naturalWidth / rows;
      const h = img.naturalHeight / cols;
      for (let i = 0; i < rows * cols; i++) {
        allPeeps.push({
          rect: [(i % rows) * w, ((i / rows) | 0) * h, w, h],
          width: w,
          height: h,
          x: 0,
          y: 0,
          anchorY: 0,
          scaleX: 1,
          walk: null,
        });
      }
    };

    // Place a peep off one edge, facing the way it will walk.
    const resetPeep = (peep: Peep) => {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const height = peep.height * stage.scale;
      const offsetY = 100 - 250 * gsap.parseEase("power2.in")(Math.random());
      const startY = stage.height - height + offsetY * stage.scale;
      const width = peep.width * stage.scale;
      const startX = direction === 1 ? -width : stage.width + width;
      const endX = direction === 1 ? stage.width : 0;
      peep.scaleX = direction;
      peep.x = startX;
      peep.y = startY;
      peep.anchorY = startY;
      return { startY, endX };
    };

    const walk = (peep: Peep) => {
      const { startY, endX } = resetPeep(peep);
      const xDuration = 10;
      const yDuration = 0.25;
      const tl = gsap.timeline();
      tl.timeScale(randomRange(0.5, 1.5));
      tl.to(peep, { duration: xDuration, x: endX, ease: "none" }, 0);
      tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 10 * stage.scale }, 0);
      return tl;
    };

    const addPeep = (): Peep => {
      const peep = available.splice((Math.random() * available.length) | 0, 1)[0];
      peep.walk = walk(peep).eventCallback("onComplete", () => {
        crowd = crowd.filter((p) => p !== peep);
        const offStage = allPeeps.filter((p) => p !== peep && !crowd.includes(p) && !available.includes(p));
        available.push(offStage.length ? offStage[(Math.random() * offStage.length) | 0] : peep);
        addPeep();
      });
      crowd.push(peep);
      crowd.sort((a, b) => a.anchorY - b.anchorY); // people further back are drawn first
      return peep;
    };

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (const p of crowd) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.scaleX, 1);
        ctx.drawImage(img, ...p.rect, 0, 0, p.width * stage.scale, p.height * stage.scale);
        ctx.restore();
      }
      ctx.restore();
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      stage.width = canvas.clientWidth;
      stage.height = canvas.clientHeight;
      if (!stage.width || !stage.height || !allPeeps.length) return;
      // The sprites are drawn for a ~90vh stage; scale them to this container's height.
      stage.scale = Math.min(1, stage.height / (allPeeps[0].height * 2.1));
      canvas.width = stage.width * dpr;
      canvas.height = stage.height * dpr;
      crowd.forEach((p) => p.walk?.kill());
      crowd = [];
      // A random subset keeps the crowd airy; the rest wait off-stage and rotate in.
      const pool = [...allPeeps].sort(() => Math.random() - 0.5);
      available = pool.slice(0, count);
      while (available.length) addPeep().walk?.progress(Math.random());
      if (reduceMotion) {
        crowd.forEach((p) => p.walk?.pause());
        render();
      }
    };

    const observer = new ResizeObserver(resize);
    let started = false;
    img.onload = () => {
      createPeeps();
      resize();
      observer.observe(canvas);
      if (!reduceMotion) gsap.ticker.add(render);
      started = true;
    };
    img.src = src;

    return () => {
      img.onload = null;
      observer.disconnect();
      if (started) gsap.ticker.remove(render);
      crowd.forEach((p) => p.walk?.kill());
    };
  }, [src, rows, cols, count]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
