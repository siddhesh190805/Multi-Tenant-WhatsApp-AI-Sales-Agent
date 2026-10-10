import { useState, useMemo } from "react";

function getAvatarColor(name = "") {
  const colors = [
    "#00a884",
    "#008069",
    "#128c7e",
    "#1da1f2",
    "#7158e2",
    "#3b5998",
    "#e67e22",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function LeadList({ leads, selectedId, onSelect, onSearch }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'ai' | 'human'

  function handleSearchSubmit(event) {
    event.preventDefault();
    onSearch(query);
  }

  function handleQueryChange(e) {
    const val = e.target.value;
    setQuery(val);
    if (!val) onSearch("");
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filter === "human") return lead.humanTakeover === true;
      if (filter === "ai") return lead.humanTakeover !== true;
      return true;
    });
  }, [leads, filter]);

  return (
    <aside className="wa-inbox-panel">
      {/* Search & Filter Header */}
      <div className="wa-inbox-header">
        <form className="wa-search-container" onSubmit={handleSearchSubmit}>
          <svg className="wa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="12" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="wa-search-input"
            type="text"
            placeholder="Search or start new chat"
            value={query}
            onChange={handleQueryChange}
          />
          {query && (
            <button
              type="button"
              className="wa-search-clear"
              onClick={() => {
                setQuery("");
                onSearch("");
              }}
            >
              ✕
            </button>
          )}
        </form>

        <div className="wa-filter-tabs">
          <button
            type="button"
            className={`wa-filter-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({leads.length})
          </button>
          <button
            type="button"
            className={`wa-filter-tab ${filter === "ai" ? "active" : ""}`}
            onClick={() => setFilter("ai")}
          >
            AI Active
          </button>
          <button
            type="button"
            className={`wa-filter-tab ${filter === "human" ? "active" : ""}`}
            onClick={() => setFilter("human")}
          >
            Human
          </button>
        </div>
      </div>

      {/* Chat List Items */}
      <div className="wa-chat-list">
        {filteredLeads.length === 0 ? (
          <div className="wa-inbox-empty">
            <p>No chats found matching your filter</p>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const isSelected = lead.id === selectedId;
            const displayName = lead.name || lead.phone || "Customer";
            const initial = displayName.charAt(0).toUpperCase();

            return (
              <div
                key={lead.id}
                className={`wa-chat-item ${isSelected ? "active" : ""}`}
                onClick={() => onSelect(lead.id)}
              >
                <div
                  className="wa-avatar"
                  style={{ backgroundColor: getAvatarColor(displayName) }}
                >
                  {initial}
                </div>

                <div className="wa-chat-content">
                  <div className="wa-chat-row-top">
                    <span className="wa-chat-name">{displayName}</span>
                    <span className="wa-chat-time">
                      {formatRelativeTime(lead.lastMessageAt || lead.updatedAt || lead.createdAt)}
                    </span>
                  </div>

                  <div className="wa-chat-row-bottom">
                    <span className="wa-chat-preview">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--wa-blue-tick)", flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {lead.lastMessageText || lead.phone}
                    </span>

                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {lead.status && lead.status !== "new" && (
                        <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(0,168,132,0.15)", color: "var(--wa-teal)", border: "1px solid var(--wa-teal)", textTransform: "capitalize" }}>
                          {lead.status.replace(/_/g, " ")}
                        </span>
                      )}
                      {lead.humanTakeover ? (
                        <span className="wa-chat-tag wa-tag-human">Human</span>
                      ) : (
                        <span className="wa-chat-tag wa-tag-ai">AI</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
