import { useQuery } from "convex/react";
import { contractApi } from "../lib/contractApi";
import type { Offer } from "../lib/contractApi";
import { formatCentsPrecise, formatCents } from "../utils/money";

interface OfferCardProps {
  negotiationId: string;
}

const LEVER_LABELS: Record<string, string> = {
  freight_72h: "72h freight",
  net_60: "net-60",
  defect_guarantee: "defect guarantee",
  account_pricing: "account pricing",
};

export function OfferCard({ negotiationId }: OfferCardProps) {
  const offer = useQuery(contractApi.offers.current, { negotiationId }) as Offer | null | undefined;

  if (offer === undefined) {
    return (
      <section className="panel offer-card">
        <header className="panel-header">
          <h2>Engine offer</h2>
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
        </header>
        <p className="empty">No offer yet — engine has not committed.</p>
      </section>
    );
  }

  const leverChips = offer.appliedLevers.map(
    (id: string) => LEVER_LABELS[id] ?? id.replace(/_/g, " ")
  );

  return (
    <section className="panel offer-card">
      <header className="panel-header">
        <h2>Engine offer</h2>
        <span className={`status-badge status-${offer.status}`}>{offer.status}</span>
      </header>

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
            {leverChips.length > 0 ? (
              leverChips.map((label: string) => (
                <span key={label} className="chip">
                  {label}
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
        Numbers from engine only — never parsed from chat.
      </p>
    </section>
  );
}
