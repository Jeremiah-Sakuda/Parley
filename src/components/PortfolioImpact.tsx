import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCents } from "../utils/money";

interface PortfolioImpactProps {
  scenarioId: string;
}

// The aggregate ROI number: the close run forward across the whole funnel, totalling the
// margin Parley holds vs a discounter that matches the competitor's price to win. Reactive,
// so a control-panel floor/price edit re-solves it live.
export function PortfolioImpact({ scenarioId }: PortfolioImpactProps) {
  const p = useQuery(api.pipeline.portfolio, { scenarioId });

  return (
    <section className="panel portfolio-impact-panel">
      <header className="panel-header">
        <div>
          <h2>Margin held vs a discounter</h2>
          <p className="panel-caption inline-caption">
            The close, run across the whole funnel. Every point held is a point of CAC.
          </p>
        </div>
        <span className="mono-label">Engine, run forward</span>
      </header>

      {p === undefined ? (
        <p className="loading">Totalling the portfolio…</p>
      ) : (
        <div className="portfolio-grid">
          <div className="portfolio-hero">
            <span className="portfolio-hero-value">{formatCents(p.marginHeldCents)}</span>
            <span className="portfolio-hero-label">
              held across {p.dealsPursued} deals vs matching the competitor's{" "}
              {formatCents(p.discounterPricePerUnitCents)}/unit
            </span>
          </div>
          <ul className="portfolio-stats mono-label">
            <li>
              <span>Closed</span>
              <strong>
                {p.dealsPursued} of {p.dealsConsidered}
              </strong>
            </li>
            <li>
              <span>Walked from</span>
              <strong>{p.dealsSkipped}</strong>
            </li>
            <li>
              <span>Units</span>
              <strong>{p.unitsPursued.toLocaleString()}</strong>
            </li>
            <li>
              <span>Parley net</span>
              <strong>{formatCents(p.parleyNetCents)}</strong>
            </li>
            <li>
              <span>Discounter net</span>
              <strong>{formatCents(p.discounterNetCents)}</strong>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
