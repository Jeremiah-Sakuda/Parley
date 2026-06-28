import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCents, formatCentsPrecise } from "../utils/money";
import { leverLabel } from "../utils/levers";

interface ReceiptCardProps {
  negotiationId: string;
}

export function ReceiptCard({ negotiationId }: ReceiptCardProps) {
  const receipt = useQuery(api.receipt.get, { negotiationId });

  if (receipt === undefined) {
    return (
      <section className="panel receipt-card">
        <header className="panel-header">
          <h2>Receipt</h2>
        </header>
        <p className="loading">Loading receipt…</p>
      </section>
    );
  }

  if (receipt === null) {
    return (
      <section className="panel receipt-card">
        <header className="panel-header">
          <h2>Receipt</h2>
        </header>
        <p className="empty">No receipt yet.</p>
      </section>
    );
  }

  const listTotalCents = receipt.netValueCents + receipt.concessionCostCents;

  return (
    <section className="panel receipt-card">
      <header className="panel-header">
        <h2>Receipt</h2>
        <span className="mono-label">Engine audit trail</span>
      </header>

      <div className="receipt-lines">
        <div className="receipt-section-label mono-label">Order</div>
        <div className="receipt-row">
          <span>Price held / unit</span>
          <span className="mono">{formatCentsPrecise(receipt.priceHeldCents)}</span>
        </div>
        <div className="receipt-row indent">
          <span>List total</span>
          <span className="mono">{formatCents(listTotalCents)}</span>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-section-label mono-label">Value traded</div>
        {receipt.valueTraded.length > 0 ? (
          receipt.valueTraded.map((item) => (
            <div key={item.leverId} className="receipt-row indent">
              <span>{leverLabel(item.leverId)}</span>
              <span className="mono concession">−{formatCents(item.costCents)}</span>
            </div>
          ))
        ) : (
          <div className="receipt-row indent muted">No value traded yet</div>
        )}

        <div className="receipt-divider" />

        <div className="receipt-section-label mono-label">Summary</div>
        <div className="receipt-row">
          <span>Concession cost</span>
          <span className="mono concession">−{formatCents(receipt.concessionCostCents)}</span>
        </div>
        <div className="receipt-row highlight">
          <span>Net value</span>
          <span className="mono">{formatCents(receipt.netValueCents)}</span>
        </div>
        <div className="receipt-row">
          <span>Floor</span>
          <span className="mono">{formatCents(receipt.floorCents)}</span>
        </div>
        <div className="receipt-row">
          <span>Margin over floor</span>
          <span
            className={`mono ${receipt.marginOverFloorCents >= 0 ? "positive" : "breached"}`}
          >
            {formatCents(receipt.marginOverFloorCents)}
          </span>
        </div>

        <div className="receipt-divider" />

        <div
          className={`receipt-row${receipt.manipulationBlocked > 0 ? " blocked" : ""}`}
        >
          <span>Manipulation blocked</span>
          <span className="mono">{receipt.manipulationBlocked}</span>
        </div>
      </div>
    </section>
  );
}
