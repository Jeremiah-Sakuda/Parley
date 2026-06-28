import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ChatMessage {
  role: string;
  text: string;
  isProbe: boolean;
  confidence: number;
}

interface BuyerChatProps {
  negotiationId: string;
}

export function BuyerChat({ negotiationId }: BuyerChatProps) {
  const serverMessages = useQuery(api.messages.list, { negotiationId });
  const sendBuyer = useMutation(api.messages.sendBuyer);
  const [text, setText] = useState("");
  const [optimistic, setOptimistic] = useState<ChatMessage[] | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (serverMessages !== undefined) setOptimistic(null);
  }, [serverMessages]);

  const messages = optimistic ?? serverMessages;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const buyerLine: ChatMessage = {
      role: "buyer",
      text: trimmed,
      isProbe: false,
      confidence: 0,
    };

    setOptimistic([...(serverMessages ?? []), buyerLine]);
    setText("");
    setSending(true);

    try {
      await sendBuyer({ negotiationId, text: trimmed });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel buyer-chat">
      <header className="panel-header">
        <h2>Buyer chat</h2>
        <span className="mono-label">LLM · cannot commit</span>
      </header>

      <div className="chat-messages">
        {messages === undefined ? (
          <p className="loading">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="empty">Send a buyer message to start the negotiation.</p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={`${i}-${msg.text.slice(0, 24)}`}
              className={`chat-bubble ${msg.role === "buyer" ? "buyer" : "seller"}`}
            >
              <div className="bubble-text">{msg.text}</div>
              {msg.role === "seller" && msg.isProbe && (
                <span className="probe-tag">(probe)</span>
              )}
              {msg.role === "seller" && (
                <div
                  className="confidence-strip"
                  aria-label={`Confidence ${Math.round(msg.confidence * 100)}%`}
                >
                  <div
                    className="confidence-fill"
                    style={{ width: `${Math.round(msg.confidence * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
