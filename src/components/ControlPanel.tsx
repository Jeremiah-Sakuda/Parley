import { useMutation, useQuery } from "convex/react";
import { contractApi } from "../lib/contractApi";
import type { DealCard } from "../lib/contractApi";
import { centsToDollars, dollarsToCents } from "../utils/money";

const SCENARIO_ID = "deal-a";

export function ControlPanel() {
  const deal = useQuery(contractApi.deals.activeCard, { scenarioId: SCENARIO_ID }) as DealCard | null | undefined;
  const update = useMutation(contractApi.dealCard.update);

  if (deal === undefined) {
    return (
      <section className="panel control-panel">
        <header className="panel-header">
          <h2>Deal controls</h2>
        </header>
        <p className="loading">Loading deal card…</p>
      </section>
    );
  }

  if (deal === null) {
    return (
      <section className="panel control-panel">
        <header className="panel-header">
          <h2>Deal controls</h2>
        </header>
        <p className="empty">Deal card not found.</p>
      </section>
    );
  }

  function write(field: string, value: unknown) {
    void update({ scenarioId: SCENARIO_ID, field, value });
  }

  return (
    <section className="panel control-panel">
      <header className="panel-header">
        <h2>Deal controls</h2>
        <span className="mono-label">Live · no apply button</span>
      </header>

      <div className="control-grid">
        <label className="control-field">
          <span>Label</span>
          <input
            type="text"
            value={deal.label}
            onChange={(e) => write("label", e.target.value)}
          />
        </label>

        <label className="control-field">
          <span>Units</span>
          <input
            type="number"
            value={deal.units}
            onChange={(e) => write("units", Number(e.target.value))}
          />
        </label>

        <label className="control-field">
          <span>List price ($/unit)</span>
          <input
            type="number"
            step="0.01"
            value={centsToDollars(deal.listPriceCents)}
            onChange={(e) =>
              write("listPriceCents", dollarsToCents(Number(e.target.value)))
            }
          />
        </label>

        <label className="control-field">
          <span>Floor ($ total)</span>
          <input
            type="number"
            step="1"
            value={centsToDollars(deal.floorCents)}
            onChange={(e) =>
              write("floorCents", dollarsToCents(Number(e.target.value)))
            }
          />
        </label>

        <label className="control-field">
          <span>Buyer deadline (days)</span>
          <input
            type="number"
            value={deal.buyerDeadlineDays ?? ""}
            placeholder="Withheld"
            onChange={(e) => {
              const v = e.target.value;
              write("buyerDeadlineDays", v === "" ? null : Number(v));
            }}
          />
        </label>

        <label className="control-field">
          <span>Whale min employees</span>
          <input
            type="number"
            value={deal.whaleMinEmployees}
            onChange={(e) =>
              write("whaleMinEmployees", Number(e.target.value))
            }
          />
        </label>

        <fieldset className="control-fieldset">
          <legend>Competitor</legend>
          <label className="control-field">
            <span>Price ($/unit)</span>
            <input
              type="number"
              step="0.01"
              value={centsToDollars(deal.competitor.pricePerUnitCents)}
              onChange={(e) =>
                write("competitor.pricePerUnitCents", dollarsToCents(Number(e.target.value)))
              }
            />
          </label>
          <label className="control-field">
            <span>Ship days</span>
            <input
              type="number"
              value={deal.competitor.shipDays}
              onChange={(e) =>
                write("competitor.shipDays", Number(e.target.value))
              }
            />
          </label>
        </fieldset>

        <fieldset className="control-fieldset">
          <legend>Levers</legend>
          {deal.levers.map((lever, i) => (
            <div key={lever.id} className="lever-control">
              <span className="lever-name">{lever.label}</span>
              <label className="control-field inline">
                <span>Cost ($)</span>
                <input
                  type="number"
                  step="1"
                  value={centsToDollars(lever.costCents)}
                  onChange={(e) =>
                    write(`levers.${i}.costCents`, dollarsToCents(Number(e.target.value)))
                  }
                />
              </label>
              <label className="control-field inline">
                <span>Max uses</span>
                <input
                  type="number"
                  value={lever.maxUses}
                  onChange={(e) =>
                    write(`levers.${i}.maxUses`, Number(e.target.value))
                  }
                />
              </label>
            </div>
          ))}
        </fieldset>

        <label className="control-field">
          <span>Forbidden commitments (comma-separated)</span>
          <input
            type="text"
            value={deal.forbiddenCommitments?.join(", ") ?? ""}
            onChange={(e) =>
              write(
                "forbiddenCommitments",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>
      </div>
    </section>
  );
}
