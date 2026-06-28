import { useState } from "react";
import { BuyerChat } from "./components/BuyerChat";
import { OfferCard } from "./components/OfferCard";
import { ControlPanel } from "./components/ControlPanel";
import { NetValueMeter } from "./components/NetValueMeter";
import { ReceiptCard } from "./components/ReceiptCard";
import { MouthGuardBadge } from "./components/MouthGuardBadge";
import { DemoResetButton } from "./components/DemoResetButton";
import { CommitSafetyPanel } from "./components/CommitSafetyPanel";
import { DealPipelinePanel } from "./components/DealPipelinePanel";
import {
  DEFAULT_SCENARIO_ID,
  NEGOTIATION_ID,
  PIPELINE_SCENARIO_ID,
  SCENARIOS,
} from "./constants";
import { isScriptedMode } from "./utils/demoMode";
import "./App.css";

type AppView = "pipeline" | "negotiate";

export default function App() {
  const [view, setView] = useState<AppView>("pipeline");
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const scripted = isScriptedMode();
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);

  function handleOpenLead({ claimedScale }: { company: string; claimedScale: string }) {
    setScenarioId("deal-a");
    setView("negotiate");
    setAutoMessage(`I'm ${claimedScale}, we do huge volume`);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" aria-hidden />
          <div>
            <span className="brand-name">Parley</span>
            <span className="brand-tagline">Win the deal. Keep the margin.</span>
          </div>
        </div>
        <div className="header-meta">
          <nav className="view-tabs" aria-label="App views">
            <button
              type="button"
              className={`view-tab${view === "pipeline" ? " active" : ""}`}
              onClick={() => setView("pipeline")}
            >
              Pipeline
            </button>
            <button
              type="button"
              className={`view-tab${view === "negotiate" ? " active" : ""}`}
              onClick={() => setView("negotiate")}
            >
              Negotiate
            </button>
          </nav>
          {scripted && (
            <span className="scripted-mode-badge" title="Deterministic turns — no OpenAI calls">
              Scripted mode
            </span>
          )}
          <MouthGuardBadge negotiationId={NEGOTIATION_ID} />
          {view === "negotiate" && (
            <>
              <DemoResetButton scenarioId={scenarioId} />
              <label className="scenario-select">
                <span className="sr-only">Scenario</span>
                <select
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                >
                  {SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="scenario-tag">{scenario?.id} · {NEGOTIATION_ID}</span>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        {view === "pipeline" ? (
          <div className="pipeline-view">
            <DealPipelinePanel
              scenarioId={PIPELINE_SCENARIO_ID}
              negotiationId={NEGOTIATION_ID}
              onOpenLead={handleOpenLead}
            />
          </div>
        ) : (
          <>
            <div className="column column-left">
              <BuyerChat
                negotiationId={NEGOTIATION_ID}
                scenarioId={scenarioId}
                scripted={scripted}
                autoMessage={autoMessage}
                onAutoMessageSent={() => setAutoMessage(null)}
              />
              <OfferCard negotiationId={NEGOTIATION_ID} />
            </div>

            <div className="column column-right">
              <NetValueMeter negotiationId={NEGOTIATION_ID} />
              <ControlPanel scenarioId={scenarioId} />
              <ReceiptCard negotiationId={NEGOTIATION_ID} />
              <CommitSafetyPanel negotiationId={NEGOTIATION_ID} />
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          The LLM can talk, but it cannot commit — only the economics engine can
          commit an offer.
        </p>
      </footer>
    </div>
  );
}
