import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { BuyerChat } from "./components/BuyerChat";
import { PortfolioImpact } from "./components/PortfolioImpact";
import { OfferCard } from "./components/OfferCard";
import { ControlPanel } from "./components/ControlPanel";
import { NetValueMeter } from "./components/NetValueMeter";
import { ReceiptCard } from "./components/ReceiptCard";
import { MouthGuardBadge } from "./components/MouthGuardBadge";
import { DemoResetButton } from "./components/DemoResetButton";
import { CommitSafetyPanel } from "./components/CommitSafetyPanel";
import { DealPipelinePanel } from "./components/DealPipelinePanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { HomePage } from "./components/home/HomePage";
import {
  DEFAULT_SCENARIO_ID,
  NEGOTIATION_ID,
  PIPELINE_SCENARIO_ID,
  SCENARIOS,
} from "./constants";
import { isScriptedMode } from "./utils/demoMode";
import "./App.css";

type ShellView = "home" | "demo";
type DemoView = "pipeline" | "negotiate";

// Land straight in the product (not the marketing page) when the URL signals a demo:
// the scripted recording flag, or an explicit ?demo / ?app. A plain visit still gets home.
function deepLinkedToDemo(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "scripted" || params.has("demo") || params.has("app");
}

export default function App() {
  const deepLinked = deepLinkedToDemo();
  const [shell, setShell] = useState<ShellView>(deepLinked ? "demo" : "home");
  const [demoView, setDemoView] = useState<DemoView>(deepLinked ? "negotiate" : "pipeline");
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const scripted = isScriptedMode();
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);

  // Seed-on-load so a cold URL shows the real deal (offer + receipt consistent), not an
  // empty shell. seed.run is idempotent: it creates the baseline only if it's missing.
  // Scripted deep links also reset to Deal B so the UI scenario matches the backend
  // (seed.run creates n1 as deal-a; the recording demo expects deal-b discovery).
  const ensureSeeded = useMutation(api.seed.run);
  const resetDemo = useMutation(api.seed.reset);
  useEffect(() => {
    void (async () => {
      try {
        await ensureSeeded({});
        if (deepLinked && scripted) {
          await resetDemo({
            negotiationId: NEGOTIATION_ID,
            scenarioId: DEFAULT_SCENARIO_ID,
          });
        }
      } catch {
        /* prod may be unreachable during local dev */
      }
    })();
  }, [ensureSeeded, resetDemo, deepLinked, scripted]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [shell, demoView]);

  function openDemo(view: DemoView = "negotiate") {
    setShell("demo");
    setDemoView(view);
  }

  function handleOpenLead({ claimedScale }: { company: string; claimedScale: string }) {
    setScenarioId("deal-a");
    setDemoView("negotiate");
    setAutoMessage(`I'm ${claimedScale}, we do huge volume`);
  }

  if (shell === "home") {
    return <HomePage onOpenDemo={() => openDemo("negotiate")} />;
  }

  return (
    <div className="app app-demo">
      <header className="app-header">
        <button type="button" className="home-brand app-home-link" onClick={() => setShell("home")}>
          <span className="brand-dot" aria-hidden />
          <div>
            <span className="brand-name">Parley</span>
            <span className="brand-tagline">Live demo</span>
          </div>
        </button>
        <div className="header-meta">
          <nav className="view-tabs" aria-label="Demo views">
            <button
              type="button"
              className={`view-tab${demoView === "pipeline" ? " active" : ""}`}
              onClick={() => setDemoView("pipeline")}
            >
              Pipeline
            </button>
            <button
              type="button"
              className={`view-tab${demoView === "negotiate" ? " active" : ""}`}
              onClick={() => setDemoView("negotiate")}
            >
              Negotiate
            </button>
          </nav>
          <span
            className="agent-ready-badge"
            title="A buyer AI agent can negotiate over MCP (mcp/ + convex/http.ts) and still cannot be talked below the floor"
          >
            Agent-ready · MCP
          </span>
          {scripted && (
            <span className="scripted-mode-badge" title="Deterministic turns with no OpenAI calls">
              Scripted mode
            </span>
          )}
          <ThemeToggle />
          <MouthGuardBadge negotiationId={NEGOTIATION_ID} />
          {demoView === "negotiate" && (
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
        {demoView === "pipeline" ? (
          <div className="pipeline-view">
            <DealPipelinePanel
              scenarioId={PIPELINE_SCENARIO_ID}
              negotiationId={NEGOTIATION_ID}
              onOpenLead={handleOpenLead}
            />
            <PortfolioImpact scenarioId={PIPELINE_SCENARIO_ID} />
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
          The LLM can talk, but it cannot commit. Only the economics engine can
          commit an offer.
        </p>
      </footer>
    </div>
  );
}
