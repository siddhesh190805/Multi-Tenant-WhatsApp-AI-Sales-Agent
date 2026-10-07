import { useEffect, useState } from "react";
import { api } from "../api/client";
import { LeadList } from "../components/LeadList";
import { ChatWindow } from "../components/ChatWindow";
import { TestPanel } from "../components/TestPanel";

export function DashboardPage({ session, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  async function refreshLeads() {
    const result = await api.leads();
    setLeads(result.leads);
    setSelectedId((current) => current || result.leads[0]?.id || null);
  }

  async function refreshMessages() {
    if (!selectedId) return setMessages([]);
    const result = await api.messages(selectedId);
    setMessages(result.messages);
  }

  useEffect(() => {
    refreshLeads().catch(() => {});
    const timer = setInterval(() => refreshLeads().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refreshMessages().catch(() => {});
    const timer = setInterval(() => refreshMessages().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [selectedId]);

  const selectedLead = leads.find((lead) => lead.id === selectedId) || null;

  async function toggleTakeover(enabled) {
    if (!selectedLead) return;
    await api.takeover(selectedLead.id, enabled);
    await refreshLeads();
    await refreshMessages();
  }

  async function sendTest(payload) {
    setBusy(true);
    try { await api.simulateMessage(payload); await refreshLeads(); }
    finally { setBusy(false); }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">Business workspace</span><h1>{session.user.businessName}</h1></div>
        <div className="account"><span>{session.user.email}</span><button className="ghost-button" onClick={onLogout}>Logout</button></div>
      </header>
      <div className="workspace">
        <LeadList leads={leads} selectedId={selectedId} onSelect={setSelectedId} />
        <ChatWindow lead={selectedLead} messages={messages} onToggleTakeover={toggleTakeover} />
      </div>
      <TestPanel onSend={sendTest} disabled={busy} />
    </main>
  );
}
