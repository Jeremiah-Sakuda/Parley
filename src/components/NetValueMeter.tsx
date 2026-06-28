import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { contractApi } from "../lib/contractApi";
import type { LiveState } from "../lib/contractApi";
import { formatCents } from "../utils/money";

interface NetValueMeterProps {
  negotiationId: string;
}

export function NetValueMeter({ negotiationId }: NetValueMeterProps) {
  const live = useQuery(contractApi.negotiate.liveState, { negotiationId }) as LiveState | null | undefined;
  const prevNet = useRef<number | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (live === undefined || live === null) return;
    if (prevNet.current !== null && prevNet.current !== live.netValueCents) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 400);
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

  if (live === null) {
    return (
      <section className="panel net-value-meter">
        <p className="empty">No live state.</p>
      </section>
    );
  }

  const listTotalCents = live.pricePerUnitCents * live.units;
  const range = listTotalCents - live.floorCents;
  const headroom = live.netValueCents - live.floorCents;
  const fillRatio = range > 0 ? Math.max(0, Math.min(1, headroom / range)) : 0;
  const floorPct = range > 0 ? (live.floorCents / listTotalCents) * 100 : 57.14;

  const statusClass =
    live.status === "refusing"
      ? "status-refused"
      : live.status === "closing"
        ? "status-accepted"
        : live.status === "proposing"
          ? "status-proposing"
          : "status-discovering";

  return (
    <section className="panel net-value-meter">
      <header className="panel-header">
        <h2>Net value</h2>
        <span className={`status-badge ${statusClass}`}>{live.status}</span>
      </header>

      <div className={`net-hero ${animating ? "animating" : ""}`}>
        <span className="net-figure">{formatCents(live.netValueCents)}</span>
        <span className="net-delta">
          {headroom >= 0
            ? `▲ ${formatCents(headroom)} above floor`
            : `▼ ${formatCents(Math.abs(headroom))} below floor`}
        </span>
      </div>

      <div className="floor-bar-wrap">
        <div className="floor-bar">
          <div className="floor-fill" style={{ width: `${fillRatio * 100}%` }} />
          <div className="floor-line" style={{ left: `${floorPct}%` }} />
        </div>
        <span className="floor-label" style={{ left: `${floorPct}%` }}>
          Floor · {formatCents(live.floorCents)}
        </span>
      </div>

      <div className="meter-footer">
        <span>Margin over floor: {formatCents(live.marginOverFloorCents)}</span>
        <span className="mono-label">Engine · live</span>
      </div>
    </section>
  );
}
