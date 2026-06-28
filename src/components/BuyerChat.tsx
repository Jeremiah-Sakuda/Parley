import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  DEAL_B_PROMPTS,
  DISCOVERY_CONFIDENCE_THRESHOLD,
} from "../constants";

interface ChatMessage {
  role: string;
  text: string;
  isProbe: boolean;
  confidence: number;
}

interface BuyerChatProps {
  negotiationId: string;
  scenarioId: string;
  scripted?: boolean;
  autoMessage?: string | null;
  onAutoMessageSent?: () => void;
}

function messageKey(msg: ChatMessage, i: number): string {
  return `${i}-${msg.role}-${msg.text.slice(0, 32)}`;
}

export function BuyerChat({
  negotiationId,
  scenarioId,
  scripted = false,
  autoMessage = null,
  onAutoMessageSent,
}: BuyerChatProps) {
  const serverMessages = useQuery(api.messages.list, { negotiationId });
  const live = useQuery(api.negotiate.liveState, { negotiationId });
  const sendBuyer = useMutation(api.messages.sendBuyer);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [awaitingSeller, setAwaitingSeller] = useState(false);
  const [optimisticBuyer, setOptimisticBuyer] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const autoSentRef = useRef<string | null>(null);

  const peakConfidence = useMemo(() => {
    if (!serverMessages?.length) return 0;
    return serverMessages.reduce(
      (max, m) => (m.role === "seller" ? Math.max(max, m.confidence) : max),
      0
    );
  }, [serverMessages]);

  const discoveryReady = peakConfidence >= DISCOVERY_CONFIDENCE_THRESHOLD;

  useEffect(() => {
    if (serverMessages === undefined) return;

    const count = serverMessages.length + (optimisticBuyer ? 1 : 0) + (awaitingSeller ? 1 : 0);
    if (count > prevCount.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    prevCount.current = count;

    if (!awaitingSeller) return;
    const last = serverMessages[serverMessages.length - 1];
    if (last?.role === "seller") {
      setAwaitingSeller(false);
      setOptimisticBuyer(null);
    }
  }, [serverMessages, awaitingSeller, optimisticBuyer]);

  useEffect(() => {
    if (!awaitingSeller || sending) return;
    const t = setTimeout(() => setAwaitingSeller(false), 15000);
    return () => clearTimeout(t);
  }, [awaitingSeller, sending]);

  useEffect(() => {
    if (!optimisticBuyer || serverMessages === undefined) return;
    if (serverMessages.some((m) => m.role === "buyer" && m.text === optimisticBuyer)) {
      setOptimisticBuyer(null);
    }
  }, [serverMessages, optimisticBuyer]);

  async function submitMessage(trimmed: string) {
    if (!trimmed || sending) return;
    setOptimisticBuyer(trimmed);
    setText("");
    setSending(true);
    setAwaitingSeller(true);
    try {
      await sendBuyer({
        negotiationId,
        text: trimmed,
        ...(scripted ? { scripted: true } : {}),
      });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!autoMessage || autoSentRef.current === autoMessage) return;
    autoSentRef.current = autoMessage;
    void submitMessage(autoMessage).then(() => onAutoMessageSent?.());
  }, [autoMessage]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submitMessage(text.trim());
  }

  const messages = serverMessages;
  const showOptimistic =
    optimisticBuyer !== null &&
    !messages?.some((m) => m.role === "buyer" && m.text === optimisticBuyer);

  const statusLabel = live?.status ?? "…";
  const showPrompts = scenarioId === "deal-b";

  return (
    <section className="panel buyer-chat">
      <header className="panel-header">
        <div>
          <h2>Buyer chat</h2>
          <div className="chat-meta">
            <span className={`status-badge status-${statusLabel}`}>{statusLabel}</span>
            {peakConfidence > 0 && (
              <span
                className={`discovery-peak mono-label${discoveryReady ? " discovery-ready" : ""}`}
              >
                Constraint {Math.round(peakConfidence * 100)}%
                {discoveryReady ? " · ready to close" : ""}
              </span>
            )}
          </div>
        </div>
        <span className="mono-label">
          {scripted ? "Scripted · zero network" : "LLM · cannot commit"}
        </span>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        {messages === undefined ? (
          <p className="loading">Loading messages…</p>
        ) : messages.length === 0 && !showOptimistic && !awaitingSeller ? (
          <p className="empty">
            {showPrompts
              ? "Try “Your price is too high” — Parley should probe before closing."
              : "Send a buyer message to start the negotiation."}
          </p>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatBubble key={messageKey(msg, i)} msg={msg} index={i} />
            ))}
            {showOptimistic && (
              <div className="chat-bubble buyer">
                <div className="bubble-text">{optimisticBuyer}</div>
              </div>
            )}
          </>
        )}

        {awaitingSeller && (
          <div className="chat-bubble seller seller-pending" aria-live="polite">
            <span className="thinking-dots">Engine responding</span>
          </div>
        )}
      </div>

      {showPrompts && (
        <div className="quick-prompts">
          <span className="mono-label">Try it</span>
          <div className="quick-prompt-chips">
            {DEAL_B_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="quick-prompt-chip"
                disabled={sending}
                onClick={() => submitMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="chat-composer" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type as the buyer…"
          aria-label="Buyer message"
          disabled={sending}
        />
        <button type="submit" disabled={!text.trim() || sending}>
          {sending ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}

function ChatBubble({ msg, index }: { msg: ChatMessage; index: number }) {
  const isSeller = msg.role === "seller";
  const confidencePct = Math.round(msg.confidence * 100);
  const showConfidence = isSeller && (msg.isProbe || msg.confidence > 0);

  return (
    <div
      className={`chat-bubble ${isSeller ? "seller" : "buyer"}${msg.isProbe ? " probe-bubble" : ""}`}
      style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
    >
      <div className="bubble-text">{msg.text}</div>
      {isSeller && msg.isProbe && (
        <span className="probe-tag">Discovery probe</span>
      )}
      {showConfidence && (
        <div className="confidence-wrap">
          <div
            className="confidence-strip"
            aria-label={`Constraint confidence ${confidencePct}%`}
          >
            <div
              className="confidence-fill"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="confidence-label mono">
            {confidencePct}% constraint confidence
            {confidencePct >= DISCOVERY_CONFIDENCE_THRESHOLD * 100 && (
              <span className="confidence-threshold"> · above threshold</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
