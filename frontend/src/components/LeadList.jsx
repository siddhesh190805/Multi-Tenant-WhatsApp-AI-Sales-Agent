import { useState } from "react";

export function LeadList({ leads, selectedId, onSelect, onSearch }) {
  const [query, setQuery] = useState("");
  function submit(event) { event.preventDefault(); onSearch(query); }
  return (
    <aside className="leads-panel">
      <div className="panel-heading"><span className="eyebrow">Inbox</span><h2>Leads <span className="count">{leads.length}</span></h2></div>
      <form className="search-row" onSubmit={submit}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or phone" aria-label="Search leads" /><button type="submit" className="ghost-button">Search</button></form>
      <div className="lead-list">
        {leads.map((lead) => (
          <button key={lead.id} className={"lead-row " + (selectedId === lead.id ? "selected" : "")} onClick={() => onSelect(lead.id)}>
            <span className="lead-avatar">{lead.name.slice(0, 1).toUpperCase()}</span>
            <span className="lead-copy"><strong>{lead.name}</strong><span>{lead.lastMessageText || "No messages yet"}</span></span>
            <span className="lead-time">{lead.humanTakeover ? "Human" : lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
          </button>
        ))}
        {!leads.length && <div className="empty-state">No leads found.</div>}
      </div>
    </aside>
  );
}
