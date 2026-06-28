import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { DealCard } from "../lib/contractApi";
import { centsToDollars, dollarsToCents } from "../utils/money";
import { patchField } from "../utils/patchField";

interface ControlPanelProps {
  scenarioId: string;
}

export function ControlPanel({ scenarioId }: ControlPanelProps) {
  const serverDeal = useQuery(api.deals.activeCard, { scenarioId });
  const update = useMutation(api.dealCard.update);
  const [localDeal, setLocalDeal] = useState<DealCard | null>(null);
  const [lastWrite, setLastWrite] = useState<number | null>(null);

  useEffect(() => {
    if (serverDeal) setLocalDeal(serverDeal as DealCard);
  }, [serverDeal]);

  useEffect(() => {
    if (lastWrite === null) return;
    const t = setTimeout(() => setLastWrite(null), 1200);
    return () => clearTimeout(t);
  }, [lastWrite]);

  const deal = localDeal;

  if (serverDeal === undefined || deal === null) {
    return (
      <section className="panel control-panel">
        <header className="panel-header">
          <h2>Deal controls</h2>
        </header>
        <p className="loading">Loading deal card…</p>
      </section>
    );
  }

  function write(field: string, value: unknown) {
    setLocalDeal((prev) => (prev ? patchField(prev, field, value) : prev));
    setLastWrite(Date.now());
    void update({ scenarioId, field, value });
  }

  return (
    <section className="panel control-panel">
      <header className="panel-header">
        <h2>Deal controls</h2>
        <div className="panel-header-actions">
          {lastWrite !== null && (
            <span className="write-flash mono-label">Writing…</span>
          )}
          <span className="mono-label">Live · no apply button</span>
        </div>
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
            min={1}
            value={deal.units}
            onChange={(e) => write("units", Number(e.target.value))}
          />
        </label>

        <label className="control-field">
          <span>List price ($/unit)</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={centsToDollars(deal.listPriceCents)}
            onChange={(e) =>
              write("listPriceCents", dollarsToCents(Number(e.target.value)))
            }
          />
        </label>

        <label className="control-field control-field-highlight">
          <span>Floor ($ total)</span>
          <input
            type="number"
            step="1"
            min={0}
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
            min={0}
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
              min={0}
              value={centsToDollars(deal.competitor.pricePerUnitCents)}
              onChange={(e) =>
                write(
                  "competitor.pricePerUnitCents",
                  dollarsToCents(Number(e.target.value))
                )
              }
            />
          </label>
          <label className="control-field">
            <span>Ship days</span>
            <input
              type="number"
              min={0}
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
            <div
              key={lever.id}
              className={`lever-control${lever.locked ? " locked" : ""}`}
            >
              <span className="lever-name">
                {lever.label}
                {lever.locked && <span className="lock-tag">locked</span>}
              </span>
              <label className="control-field inline">
                <span>Cost ($)</span>
                <input
                  type="number"
                  step="1"
                  min={0}
                  disabled={lever.locked}
                  value={centsToDollars(lever.costCents)}
                  onChange={(e) =>
                    write(
                      `levers.${i}.costCents`,
                      dollarsToCents(Number(e.target.value))
                    )
                  }
                />
              </label>
              <label className="control-field inline">
                <span>Max uses</span>
                <input
                  type="number"
                  min={0}
                  disabled={lever.locked}
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
