import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { formatCents } from "../utils/money";

const PRIORITY_LABELS: Record<string, string> = {
  speed: "Speed",
  cash_flow: "Cash flow",
  risk: "Risk",
  volume: "Volume",
};

interface DealPipelinePanelProps {
  scenarioId: string;
  negotiationId: string;
  onOpenLead: (payload: { company: string; claimedScale: string }) => void;
}

type Decision = "PURSUE" | "WATCH" | "SKIP";

export function DealPipelinePanel({
  scenarioId,
  negotiationId,
  onOpenLead,
}: DealPipelinePanelProps) {
  const leads = useQuery(api.pipeline.qualifyLeads, { scenarioId });
  const loadLead = useAction(api.pipeline.loadLead);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleOpen(leadId: string) {
    setLoadingId(leadId);
    try {
      const result = await loadLead({ leadId, negotiationId });
      if (result) onOpenLead(result);
    } finally {
      setLoadingId(null);
    }
  }

  const sorted =
    leads === undefined
      ? undefined
      : [...leads].sort((a, b) => {
          const rank = (d: string) =>
            d === "SKIP" ? 0 : d === "PURSUE" ? 1 : 2;
          return rank(a.decision) - rank(b.decision);
        });

  return (
    <section className="panel deal-pipeline-panel">
      <header className="panel-header">
        <div>
          <h2>Deal pipeline</h2>
          <p className="panel-caption inline-caption">
            Same engine, one step up the funnel — only open deals that clear your floor.
          </p>
        </div>
        <span className="mono-label">Engine qualifies · model estimates</span>
      </header>

      {sorted === undefined ? (
        <p className="loading">Scoring leads…</p>
      ) : (
        <ul className="pipeline-list">
          {sorted.map((lead) => {
            const decision = lead.decision as Decision;
            const isSkipHero = decision === "SKIP";
            const isPursue = decision === "PURSUE";

            return (
              <li
                key={lead.id}
                className={`pipeline-row decision-${decision.toLowerCase()}${isSkipHero ? " skip-hero" : ""}`}
              >
                <div className="pipeline-row-main">
                  <div className="pipeline-row-head">
                    <span className="pipeline-company">{lead.company}</span>
                    <span className={`verdict-chip verdict-${decision.toLowerCase()}`}>
                      {decision}
                    </span>
                  </div>
                  <div className="pipeline-meta mono-label">
                    ~{lead.estUnits.toLocaleString()} units ·{" "}
                    {PRIORITY_LABELS[lead.likelyPriority] ?? lead.likelyPriority}
                    {lead.headroomCents > 0 && (
                      <> · {formatCents(lead.headroomCents)} headroom</>
                    )}
                  </div>
                  <p className={`pipeline-reason${isSkipHero ? " skip-reason" : ""}`}>
                    {isSkipHero && (
                      <span className="skip-hero-label">Engine says no · </span>
                    )}
                    {lead.reason}
                  </p>
                </div>
                {isPursue && (
                  <button
                    type="button"
                    className="pipeline-open-btn"
                    disabled={loadingId !== null}
                    onClick={() => handleOpen(lead.id)}
                  >
                    {loadingId === lead.id ? "Opening…" : "Open in console"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
