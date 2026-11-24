/**
 * Animated field of hexagonally packed dots with drifting colour underneath.
 *
 * Adapted from "Gradient Dots" by efferd on 21st.dev
 * (https://21st.dev/@efferd/components/gradient-dots).
 * Changes: uses the `motion` package already in this app, plain CSS instead of Tailwind,
 * and sits still when the user prefers reduced motion.
 *
 * How it works: two offset grids of radial gradients paint the page colour everywhere
 * except small holes (the dots). Behind them, four big soft colour blobs slide around and
 * the whole layer slowly hue-rotates, so the colour seen through each hole keeps shifting.
 */
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

interface Props {
  dotSize?: number; // size of the solid area around each hole
  spacing?: number; // distance between dots
  duration?: number; // seconds for the colour blobs to drift a full cycle
  colorCycleDuration?: number; // seconds for one full hue rotation
  backgroundColor?: string;
  className?: string;
  style?: CSSProperties;
}

export function GradientDots({
  dotSize = 8,
  spacing = 10,
  duration = 30,
  colorCycleDuration = 6,
  backgroundColor = "var(--bg)",
  className,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();
  const hexSpacing = spacing * 1.732; // row height for hexagonal packing

  return (
    <motion.div
      className={className}
      aria-hidden
      style={{
        backgroundColor,
        backgroundImage: `
          radial-gradient(circle at 50% 50%, transparent 1.5px, ${backgroundColor} 0 ${dotSize}px, transparent ${dotSize}px),
          radial-gradient(circle at 50% 50%, transparent 1.5px, ${backgroundColor} 0 ${dotSize}px, transparent ${dotSize}px),
          radial-gradient(circle at 50% 50%, #f00, transparent 60%),
          radial-gradient(circle at 50% 50%, #ff0, transparent 60%),
          radial-gradient(circle at 50% 50%, #0f0, transparent 60%),
          radial-gradient(ellipse at 50% 50%, #00f, transparent 60%)
        `,
        backgroundSize: `
          ${spacing}px ${hexSpacing}px,
          ${spacing}px ${hexSpacing}px,
          200% 200%,
          200% 200%,
          200% 200%,
          200% ${hexSpacing}px
        `,
        backgroundPosition: `0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 0% 0%, 0% 0%, 0% 0%, 0% 0px`,
        ...style,
      }}
      animate={
        reduceMotion
          ? undefined
          : {
              backgroundPosition: [
                `0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 800% 400%, 1000% -400%, -1200% -600%, 400% ${hexSpacing}px`,
                `0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 0% 0%, 0% 0%, 0% 0%, 0% 0%`,
              ],
              filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"],
            }
      }
      transition={{
        backgroundPosition: { duration, ease: "linear", repeat: Infinity },
        filter: { duration: colorCycleDuration, ease: "linear", repeat: Infinity },
      }}
    />
  );
}
