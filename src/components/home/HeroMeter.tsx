import { useEffect, useRef } from "react";
import { getStoredTheme, type Theme } from "../../utils/theme";

const PALETTE = {
  dark: {
    em: "#10B981",
    emDim: "#0d8761",
    red: "#EF4444",
    redRGB: "239,68,68",
    muted: "#71717A",
    line: "161,161,170",
    text: "#FAFAFA",
  },
  light: {
    em: "#059669",
    emDim: "#10B981",
    red: "#DC2626",
    redRGB: "220,38,38",
    muted: "#71717A",
    line: "113,113,122",
    text: "#18181B",
  },
} as const;

const MAX = 14000;
const FLOOR = 8000;
const PEAK = 11200;
const INTRO_UP = 1800;
const INTRO_HOLD = 1100;
const INTRO_END = INTRO_UP + INTRO_HOLD;
const B_HOLD0 = 900;
const B_DROP = 950;
const B_LOCK = 800;
const B_CLIMB = 1000;
const B_HOLD1 = 1500;
const M0 = B_HOLD0;
const M1 = M0 + B_DROP;
const M2 = M1 + B_LOCK;
const M3 = M2 + B_CLIMB;
const LOOP = M3 + B_HOLD1;

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function fmt(v: number) {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** Animated hero net-value meter from the v2 design handoff. */
export function HeroMeter() {
  const figRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const deltaRef = useRef<HTMLSpanElement>(null);
  const floorLineRef = useRef<HTMLDivElement>(null);
  const floorLabelRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const themeRef = useRef<Theme>(getStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      themeRef.current = root.dataset.theme === "dark" ? "dark" : "light";
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fig = figRef.current;
    const fill = fillRef.current;
    const delta = deltaRef.current;
    const floorLine = floorLineRef.current;
    const floorLabel = floorLabelRef.current;
    const chip = chipRef.current;
    const status = statusRef.current;
    if (!fig || !fill) return;

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = now - start;
      const p = PALETTE[themeRef.current as keyof typeof PALETTE];
      let v: number;
      let red = 0;
      let chipOn = 0;
      let breached = false;

      if (t < INTRO_UP) {
        v = PEAK * easeOut(t / INTRO_UP);
      } else if (t < INTRO_END) {
        v = PEAK;
      } else {
        const u = (t - INTRO_END) % LOOP;
        if (u < M0) v = PEAK;
        else if (u < M1) v = PEAK + (FLOOR - PEAK) * easeInOut((u - M0) / B_DROP);
        else if (u < M2) {
          v = FLOOR;
          breached = true;
          red = 1;
          chipOn = 1;
        } else if (u < M3) {
          const q = (u - M2) / B_CLIMB;
          v = FLOOR + (PEAK - FLOOR) * easeInOut(q);
          red = Math.max(0, 1 - q * 3);
          chipOn = Math.max(0, 1 - q * 2);
        } else v = PEAK;
      }

      fig.textContent = fmt(v);
      fill.style.width = `${((v / MAX) * 100).toFixed(2)}%`;
      fill.style.background = `linear-gradient(90deg, ${p.emDim}, ${p.em})`;
      fill.style.boxShadow = breached
        ? `0 0 16px rgba(${p.redRGB}, 0.4)`
        : "0 0 14px rgba(16, 185, 129, 0.25)";

      if (floorLine) {
        floorLine.style.background =
          red > 0
            ? `rgba(${p.redRGB}, ${(0.45 + 0.55 * red).toFixed(3)})`
            : `rgba(${p.line}, 0.5)`;
        floorLine.style.boxShadow =
          red > 0 ? `0 0 ${(9 * red).toFixed(1)}px rgba(${p.redRGB}, ${(0.7 * red).toFixed(3)})` : "none";
      }
      if (floorLabel) {
        floorLabel.style.color =
          red > 0
            ? `rgba(${p.redRGB}, ${(0.55 + 0.45 * red).toFixed(3)})`
            : p.muted;
      }

      const d = Math.round(v - FLOOR);
      if (delta) {
        if (d > 1) {
          delta.textContent = `▲ +${fmt(d).slice(1)} above floor`;
          delta.style.color = p.em;
          fig.style.color = p.em;
        } else {
          delta.textContent = "◆ at floor · locked";
          delta.style.color = red > 0.4 ? p.red : p.muted;
          fig.style.color = red > 0.4 ? p.text : p.em;
        }
      }

      if (chip) {
        chip.style.opacity = chipOn.toFixed(2);
        chip.style.transform = `translateY(${(1 - chipOn) * 4}px)`;
      }

      if (status) {
        if (red > 0.5) {
          status.textContent = "Buyer pushed below floor — refused";
          status.style.color = p.red;
        } else {
          status.textContent = "Holding net-value floor";
          status.style.color = p.muted;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="home-meter panel">
      <div className="home-meter-head">
        <span className="mono-label home-meter-label">Net value · this deal</span>
        <div ref={chipRef} className="home-meter-chip">
          <span className="home-meter-chip-dot" aria-hidden />
          <span className="mono">ENGINE · rejected</span>
        </div>
      </div>
      <div className="home-meter-value-row">
        <span ref={figRef} className="home-meter-fig mono">
          $0
        </span>
        <span ref={deltaRef} className="home-meter-delta mono">
          ▲ above floor
        </span>
      </div>
      <div className="home-meter-bar-wrap">
        <div className="home-meter-bar">
          <div ref={fillRef} className="home-meter-fill" />
        </div>
        <div ref={floorLineRef} className="home-meter-floor-line" />
        <div ref={floorLabelRef} className="home-meter-floor-label mono">
          FLOOR · $8,000
        </div>
      </div>
      <div className="home-meter-foot">
        <span ref={statusRef} className="mono home-meter-status">
          Holding net-value floor
        </span>
        <span className="mono-label">ENGINE · LIVE</span>
      </div>
    </div>
  );
}
