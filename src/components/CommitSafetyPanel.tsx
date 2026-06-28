import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCents } from "../utils/money";

interface CommitSafetyPanelProps {
  negotiationId: string;
}

type RaceResult = {
  mode: "naive" | "guarded";
  finalNetCents: number;
  floorCents: number;
  breached: boolean;
  conflicts: number;
  attempts: number;
};

export function CommitSafetyPanel({ negotiationId }: CommitSafetyPanelProps) {
  const runRace = useAction(api.harness.runRace);
  const [naive, setNaive] = useState<RaceResult | null>(null);
  const [guarded, setGuarded] = useState<RaceResult | null>(null);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const [naiveResult, guardedResult] = await Promise.all([
        runRace({ negotiationId, mode: "naive" }),
        runRace({ negotiationId, mode: "guarded" }),
      ]);
      setNaive(naiveResult as RaceResult);
      setGuarded(guardedResult as RaceResult);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel commit-safety-panel">
      <header className="panel-header">
        <h2>Commit-safety A/B</h2>
        <button type="button" onClick={handleRun} disabled={running}>
          {running ? "Running…" : "Run race"}
        </button>
      </header>
      <p className="panel-caption">
        Two commit strategies of our own engine, not vs a competitor.
      </p>

      <div className="race-grid">
        <RacePanel label="Naive" result={naive} />
        <RacePanel label="Guarded" result={guarded} />
      </div>
    </section>
  );
}

function RacePanel({ label, result }: { label: string; result: RaceResult | null }) {
  if (!result) {
    return (
      <div className="race-panel empty">
        <h3>{label}</h3>
        <p>Run race to see result.</p>
      </div>
    );
  }

  const breachAmount = result.floorCents - result.finalNetCents;

  return (
    <div className={`race-panel ${result.breached ? "breached" : "held"}`}>
      <h3>{label}</h3>
      {result.breached ? (
        <p className="race-verdict bad">
          Floor breached by {formatCents(breachAmount)}
        </p>
      ) : (
        <p className="race-verdict good">Floor held</p>
      )}
      <div className="race-stats">
        <span>Final net: {formatCents(result.finalNetCents)}</span>
        <span>Floor: {formatCents(result.floorCents)}</span>
        <span>Conflicts: {result.conflicts}</span>
        <span>Attempts: {result.attempts}</span>
      </div>
      {result.mode === "guarded" && (
        <p className="race-caption">
          Convex serialized the concurrent commits: the loser aborts and auto-retries
          against the fresh head, where the clamp re-checks the floor. A concession that
          no longer fits is rejected as a counter, so the floor is never breached.
        </p>
      )}
    </div>
  );
}
