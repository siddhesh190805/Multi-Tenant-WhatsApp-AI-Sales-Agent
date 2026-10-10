import { useState, useEffect, useRef } from "react";

function formatMessageTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatWindow({
  lead,
  messages,
  onToggleTakeover,
  onHumanSend,
  onSimulateLead,
}) {
  const [text, setText] = useState("");
  const [simulating, setSimulating] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!lead) {
    return (
      <section className="wa-chat-panel">
        <div className="wa-chat-empty">
          <svg className="wa-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <h2>WhatsApp Business Web</h2>
          <p>
            Select a conversation from the left to monitor automated sales interactions or take over messaging.
          </p>
        </div>
      </section>
    );
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!text.trim()) return;
    await onHumanSend(text.trim());
    setText("");
  }

  async function handleQuickInbound(queryText) {
    if (!onSimulateLead || simulating) return;
    setSimulating(true);
    try {
      await onSimulateLead(queryText);
    } finally {
      setTimeout(() => setSimulating(false), 800);
    }
  }

  return (
    <section className="wa-chat-panel">
      {/* Header */}
      <header className="wa-chat-header">
        <div className="wa-chat-header-left">
          <div className="wa-avatar" style={{ backgroundColor: "#00a884", width: 40, height: 40, fontSize: 14 }}>
            {(lead.name || lead.phone || "C").charAt(0).toUpperCase()}
          </div>
          <div className="wa-chat-header-title">
            <span className="wa-chat-header-name">{lead.name || lead.phone || "Customer"}</span>
            <span className="wa-chat-header-meta" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{lead.phone}</span>
              {lead.status && lead.status !== "new" && (
                <span style={{ textTransform: "capitalize", padding: "1px 7px", borderRadius: 4, background: "rgba(0,168,132,0.15)", color: "var(--wa-teal)", fontSize: 11, fontWeight: 600, border: "1px solid var(--wa-teal)" }}>
                  {lead.status.replace(/_/g, " ")}
                </span>
              )}
              <span>•</span>
              <span>{lead.humanTakeover ? "Human Mode Active" : "AI Agent Responding"}</span>
            </span>
          </div>
        </div>

        <div className="wa-chat-header-right">
          <button
            type="button"
            className={`wa-mode-toggle ${lead.humanTakeover ? "human-mode" : "ai-mode"}`}
            onClick={() => onToggleTakeover(!lead.humanTakeover)}
            title="Toggle between autonomous AI responses and manual agent takeover"
          >
            <span className="wa-toggle-circle" />
            <span>{lead.humanTakeover ? "Human Takeover (AI Paused)" : "AI Agent Active"}</span>
          </button>
        </div>
      </header>

      {/* Messages Stream */}
      <div className="wa-messages-viewport">
        <div className="wa-date-divider">Today</div>

        {messages.map((msg, index) => {
          // Identify inbound vs outbound properly from DB schema
          const isInbound =
            msg.direction === "in" ||
            msg.direction === "inbound" ||
            msg.sender === "lead";

          const isHuman =
            msg.sender === "human" ||
            msg.direction === "outbound_human";

          const isFallback = msg.sender === "fallback";

          const isAi =
            msg.sender === "ai" ||
            isFallback ||
            (!isInbound && !isHuman);

          return (
            <div
              key={msg.id || msg._id || index}
              className={`wa-bubble-wrap ${isInbound ? "inbound" : "outbound"}`}
            >
              <div
                className={`wa-bubble ${
                  isInbound
                    ? "inbound"
                    : isHuman
                    ? "outbound-human"
                    : "outbound-ai"
                }`}
              >
                {/* Outbound Author Headers */}
                {!isInbound && (
                  <div className={`wa-bubble-author ${isHuman ? "human" : isFallback ? "fallback" : "ai"}`} style={{ color: isFallback ? "var(--wa-warning)" : undefined }}>
                    {isHuman ? "Agent (Manual)" : isFallback ? "AI Fallback (Safety Net)" : "AI Sales Assistant"}
                  </div>
                )}

                {/* Inbound Customer Header if needed */}
                {isInbound && (
                  <div className="wa-bubble-author" style={{ color: "#53bdeb" }}>
                    {lead.name || lead.phone || "Customer"}
                  </div>
                )}

                <div className="wa-bubble-text">{msg.text}</div>

                <div className="wa-bubble-footer">
                  {msg.latencyMs > 0 && isAi && (
                    <span className="wa-latency-badge" title="Response generation latency">
                      ⚡ {(msg.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  <span>{formatMessageTime(msg.timestamp || msg.createdAt)}</span>
                  {!isInbound && (
                    <span className="wa-ticks" title="Delivered and read">✓✓</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Customer Test Prompts */}
      <div className="wa-templates-strip">
        <span>Simulate Customer Question:</span>
        <button
          type="button"
          className="wa-template-chip"
          disabled={simulating}
          onClick={() => handleQuickInbound("Hi, what is the price of 2BHK flats?")}
        >
          2BHK Price?
        </button>
        <button
          type="button"
          className="wa-template-chip"
          disabled={simulating}
          onClick={() => handleQuickInbound("Where is the project located?")}
        >
          Location?
        </button>
        <button
          type="button"
          className="wa-template-chip"
          disabled={simulating}
          onClick={() => handleQuickInbound("Is a home loan available?")}
        >
          Home Loan?
        </button>
        <button
          type="button"
          className="wa-template-chip"
          disabled={simulating}
          onClick={() => handleQuickInbound("Can I book a site visit tomorrow at 11 AM?")}
        >
          Site Visit?
        </button>
        <button
          type="button"
          className="wa-template-chip"
          disabled={simulating}
          onClick={() => handleQuickInbound("Can I please speak with a human sales executive?")}
        >
          Talk to Human
        </button>
      </div>

      {/* Manual Agent Composer */}
      <form className="wa-composer" onSubmit={handleSend}>
        <input
          className="wa-composer-input"
          type="text"
          placeholder={
            lead.humanTakeover
              ? "Reply to customer as human agent..."
              : "Type manual agent message (or click AI toggle above)..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="wa-send-btn"
          disabled={!text.trim()}
          title="Send manual agent message to lead"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </section>
  );
}
