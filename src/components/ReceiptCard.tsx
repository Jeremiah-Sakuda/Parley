import { useQuery } from "convex/react";
import { contractApi } from "../lib/contractApi";
import type { Receipt } from "../lib/contractApi";
import { formatCents, formatCentsPrecise } from "../utils/money";

interface ReceiptCardProps {
  negotiationId: string;
}

const LEVER_LABELS: Record<string, string> = {
  freight_72h: "72h freight",
  net_60: "net-60",
  defect_guarantee: "defect guarantee",
  account_pricing: "account pricing",
};

export function ReceiptCard({ negotiationId }: ReceiptCardProps) {
  const receipt = useQuery(contractApi.receipt.get, { negotiationId }) as Receipt | null | undefined;

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

  return (
    <section className="panel receipt-card">
      <header className="panel-header">
        <h2>Receipt</h2>
        <span className="mono-label">Engine audit trail</span>
      </header>

      <div className="receipt-lines">
        <div className="receipt-row">
          <span>Price held / unit</span>
          <span className="mono">{formatCentsPrecise(receipt.priceHeldCents)}</span>
        </div>

        {receipt.valueTraded.map((item) => (
          <div key={item.leverId} className="receipt-row indent">
            <span>{LEVER_LABELS[item.leverId] ?? item.leverId}</span>
            <span className="mono">−{formatCents(item.costCents)}</span>
          </div>
        ))}

        <div className="receipt-divider" />

        <div className="receipt-row">
          <span>Concession cost</span>
          <span className="mono">−{formatCents(receipt.concessionCostCents)}</span>
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
          <span className="mono positive">{formatCents(receipt.marginOverFloorCents)}</span>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-row">
          <span>Manipulation blocked</span>
          <span className="mono">{receipt.manipulationBlocked}</span>
        </div>
      </div>
    </section>
  );
}
