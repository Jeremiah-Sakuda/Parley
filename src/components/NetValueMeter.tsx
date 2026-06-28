import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCents } from "../utils/money";

interface NetValueMeterProps {
  negotiationId: string;
}

export function NetValueMeter({ negotiationId }: NetValueMeterProps) {
  const live = useQuery(api.negotiate.liveState, { negotiationId });
  const prevNet = useRef<number | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (live === undefined) return;
    if (prevNet.current !== null && prevNet.current !== live.netValueCents) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 450);
      return () => clearTimeout(t);
    }
    prevNet.current = live.netValueCents;
  }, [live]);

  if (live === undefined) {
    return (
      <section className="panel net-value-meter">
        <p className="loading">Loading net value…</p>
      </section>
    );
  }

  const listTotalCents = live.pricePerUnitCents * live.units;
  const range = listTotalCents - live.floorCents;
  const headroom = live.netValueCents - live.floorCents;
  const fillRatio = range > 0 ? Math.max(0, Math.min(1, headroom / range)) : 0;
  const floorPct =
    listTotalCents > 0 ? (live.floorCents / listTotalCents) * 100 : 80;
  const breached = headroom < 0;

  const statusClass =
    live.status === "refusing"
      ? "status-refused"
      : live.status === "closing"
        ? "status-accepted"
        : breached
          ? "status-counter"
          : live.status === "proposing"
            ? "status-proposing"
            : "status-discovering";

  return (
    <section
      className={`panel net-value-meter${breached ? " net-value-meter-breached" : ""}`}
    >
      <header className="panel-header">
        <h2>Net value</h2>
        <span className={`status-badge ${statusClass}`}>
          {breached ? "counter" : live.status}
        </span>
      </header>

      <div className={`net-hero ${animating ? "animating" : ""}`}>
        <span className={`net-figure${breached ? " breached" : ""}`}>
          {formatCents(live.netValueCents)}
        </span>
        <span className={`net-delta${breached ? " breached" : ""}`}>
          {headroom >= 0
            ? `▲ ${formatCents(headroom)} above floor`
            : `▼ ${formatCents(Math.abs(headroom))} below floor`}
        </span>
      </div>

      <div className="floor-bar-wrap">
        <div className="floor-bar">
          <div
            className={`floor-fill${breached ? " breached" : ""}`}
            style={{ width: `${fillRatio * 100}%` }}
          />
          <div className="floor-line" style={{ left: `${floorPct}%` }} />
        </div>
        <span className="floor-label" style={{ left: `${floorPct}%` }}>
          Floor · {formatCents(live.floorCents)}
        </span>
      </div>

      <div className="meter-footer">
        <span>
          Margin over floor:{" "}
          <strong className={breached ? "breached" : "positive"}>
            {formatCents(live.marginOverFloorCents)}
          </strong>
        </span>
        <span className="mono-label">Engine · live</span>
      </div>
    </section>
  );
}
