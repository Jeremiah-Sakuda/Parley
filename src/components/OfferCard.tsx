import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCents, formatCentsPrecise } from "../utils/money";
import { leverLabel } from "../utils/levers";

interface OfferCardProps {
  negotiationId: string;
}

export function OfferCard({ negotiationId }: OfferCardProps) {
  const offer = useQuery(api.offers.current, { negotiationId });
  const live = useQuery(api.negotiate.liveState, { negotiationId });
  const prevNet = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (offer === undefined || offer === null) return;
    if (prevNet.current !== null && prevNet.current !== offer.netValueCents) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 500);
      return () => clearTimeout(t);
    }
    prevNet.current = offer.netValueCents;
  }, [offer]);

  if (offer === undefined) {
    return (
      <section className="panel offer-card">
        <header className="panel-header">
          <h2>Engine offer</h2>
          <span className="mono-label">Deterministic commit</span>
        </header>
        <p className="loading">Loading offer…</p>
      </section>
    );
  }

  if (offer === null) {
    return (
      <section className="panel offer-card">
        <header className="panel-header">
          <h2>Engine offer</h2>
          <span className="mono-label">Deterministic commit</span>
        </header>
        <p className="empty">Waiting for the engine to commit an offer…</p>
        <p className="offer-caption">
          Only numbers written by the engine appear here — never parsed from chat.
        </p>
      </section>
    );
  }

  const verifyStatus = live?.verifyStatus;
  const isVerified = verifyStatus?.startsWith("verified:");

  return (
    <section className={`panel offer-card${flash ? " offer-card-flash" : ""}`}>
      <header className="panel-header">
        <h2>Engine offer</h2>
        <span className={`status-badge status-${offer.status}`}>{offer.status}</span>
      </header>

      {verifyStatus && (
        <div
          className={`verify-chip${isVerified ? " verified" : " checked"}`}
          title="Buyer identity verification result"
        >
          {verifyStatus}
        </div>
      )}

      <div className="offer-grid">
        <div className="offer-row">
          <span className="label">Price / unit</span>
          <span className="value mono">{formatCentsPrecise(offer.pricePerUnitCents)}</span>
        </div>
        <div className="offer-row">
          <span className="label">Units</span>
          <span className="value mono">{offer.units.toLocaleString()}</span>
        </div>
        <div className="offer-row">
          <span className="label">Applied levers</span>
          <div className="lever-chips">
            {offer.appliedLevers.length > 0 ? (
              offer.appliedLevers.map((id) => (
                <span
                  key={id}
                  className={`chip${id === "account_pricing" ? " chip-unlocked" : ""}`}
                >
                  {leverLabel(id)}
                </span>
              ))
            ) : (
              <span className="muted">None</span>
            )}
          </div>
        </div>
        <div className="offer-row highlight">
          <span className="label">Net value</span>
          <span className="value mono hero-sm">{formatCents(offer.netValueCents)}</span>
        </div>
        <div className="offer-row">
          <span className="label">Floor</span>
          <span className="value mono">{formatCents(offer.floorCents)}</span>
        </div>
      </div>

      <p className="offer-caption">
        Engine commit · updates reactively when the seller turn lands.
      </p>
    </section>
  );
}
