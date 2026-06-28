import { BuyerChat } from "./components/BuyerChat";
import { OfferCard } from "./components/OfferCard";
import { ControlPanel } from "./components/ControlPanel";
import { NetValueMeter } from "./components/NetValueMeter";
import { ReceiptCard } from "./components/ReceiptCard";
import { MouthGuardBadge } from "./components/MouthGuardBadge";
import { CommitSafetyPanel } from "./components/CommitSafetyPanel";
import "./App.css";

const NEGOTIATION_ID = "n1";
const SHOW_COMMIT_SAFETY = import.meta.env.VITE_SHOW_COMMIT_SAFETY === "true";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" aria-hidden />
          <span className="brand-name">Parley</span>
        </div>
        <div className="header-meta">
          <MouthGuardBadge negotiationId={NEGOTIATION_ID} />
          <span className="scenario-tag">Deal A · n1</span>
        </div>
      </header>

      <main className="app-main">
        <div className="column column-left">
          <BuyerChat negotiationId={NEGOTIATION_ID} />
          <OfferCard negotiationId={NEGOTIATION_ID} />
        </div>

        <div className="column column-right">
          <ControlPanel />
          <NetValueMeter negotiationId={NEGOTIATION_ID} />
          <ReceiptCard negotiationId={NEGOTIATION_ID} />
          {SHOW_COMMIT_SAFETY && (
            <CommitSafetyPanel negotiationId={NEGOTIATION_ID} />
          )}
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
