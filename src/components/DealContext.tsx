import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCents, formatCentsPrecise } from "../utils/money";

interface DealContextProps {
  scenarioId: string;
}

export function DealContext({ scenarioId }: DealContextProps) {
  const deal = useQuery(api.deals.activeCard, { scenarioId });

  if (deal === undefined) {
    return (
      <section className="panel deal-context">
        <p className="loading">Loading scenario…</p>
      </section>
    );
  }

  return (
    <section className="panel deal-context">
      <header className="panel-header">
        <h2>{deal.label}</h2>
        <span className="mono-label">{deal.scenarioId}</span>
      </header>

      <p className="deal-context-lede">
        Seller-side negotiation demo. Edit deal economics in the control panel. The
        engine reads them on the next turn.
      </p>

      <dl className="deal-context-stats">
        <div>
          <dt>List price</dt>
          <dd className="mono">{formatCentsPrecise(deal.listPriceCents)}/unit</dd>
        </div>
        <div>
          <dt>Units</dt>
          <dd className="mono">{deal.units.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Floor</dt>
          <dd className="mono">{formatCents(deal.floorCents)}</dd>
        </div>
        <div>
          <dt>Competitor</dt>
          <dd className="mono">
            {formatCentsPrecise(deal.competitor.pricePerUnitCents)}/unit ·{" "}
            {deal.competitor.shipDays}d ship
          </dd>
        </div>
        <div>
          <dt>Buyer deadline</dt>
          <dd className="mono">
            {deal.buyerDeadlineDays === null
              ? "Withheld (Deal B)"
              : `${deal.buyerDeadlineDays} days`}
          </dd>
        </div>
      </dl>

      <div className="deal-context-levers">
        <span className="mono-label">Available levers</span>
        <ul>
          {deal.levers.map((lever) => (
            <li key={lever.id} className={lever.locked ? "locked" : undefined}>
              <span>{lever.label}</span>
              <span className="mono">−{formatCents(lever.costCents)}</span>
              {lever.locked && <span className="lock-tag">locked</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
