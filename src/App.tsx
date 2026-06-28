import { useState } from "react";
import { BuyerChat } from "./components/BuyerChat";
import { OfferCard } from "./components/OfferCard";
import { ControlPanel } from "./components/ControlPanel";
import { NetValueMeter } from "./components/NetValueMeter";
import { ReceiptCard } from "./components/ReceiptCard";
import { MouthGuardBadge } from "./components/MouthGuardBadge";
import { DEFAULT_SCENARIO_ID, NEGOTIATION_ID, SCENARIOS } from "./constants";
import "./App.css";

export default function App() {
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);

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
          <MouthGuardBadge negotiationId={NEGOTIATION_ID} />
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
        </div>
      </header>

      <main className="app-main">
        <div className="column column-left">
          <BuyerChat negotiationId={NEGOTIATION_ID} />
          <OfferCard negotiationId={NEGOTIATION_ID} />
        </div>

        <div className="column column-right">
          <ControlPanel scenarioId={scenarioId} />
          <NetValueMeter negotiationId={NEGOTIATION_ID} />
          <ReceiptCard negotiationId={NEGOTIATION_ID} />
        </div>
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
