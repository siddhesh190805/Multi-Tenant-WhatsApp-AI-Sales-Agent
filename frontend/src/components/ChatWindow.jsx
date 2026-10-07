export function ChatWindow({ lead, messages, onToggleTakeover }) {
  if (!lead) return <section className="chat-panel empty-chat">Select a lead to inspect the conversation.</section>;

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div><strong>{lead.name}</strong><span className="muted">{lead.phone}</span></div>
        <button className={`toggle ${lead.humanTakeover ? "off" : "on"}`} onClick={() => onToggleTakeover(!lead.humanTakeover)}>AI: {lead.humanTakeover ? "OFF" : "ON"}</button>
      </header>
      {lead.humanTakeover && <div className="takeover-banner">AI paused: human is handling this chat</div>}
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message-line ${message.direction === "in" ? "incoming" : "outgoing"}`}>
            <div className="message-bubble">
              <div>{message.text}</div>
              {message.direction === "out" && <small>{message.sender === "fallback" ? "Fallback" : message.sender === "human" ? "Human" : "AI"}{message.latencyMs != null && message.sender === "ai" ? ` · replied in ${(message.latencyMs / 1000).toFixed(1)}s` : ""}</small>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
