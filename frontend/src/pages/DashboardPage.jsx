import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api/client";
import { LeadList } from "../components/LeadList";
import { ChatWindow } from "../components/ChatWindow";
import { TestPanel } from "../components/TestPanel";

export function DashboardPage({ session, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  async function refreshLeads(query = "") { const result = await api.leads(query ? { q: query } : {}); setLeads(result.leads); setSelectedId((current) => current || result.leads[0]?.id || null); }
  async function refreshMessages() { if (!selectedId) return setMessages([]); const result = await api.messages(selectedId); setMessages(result.messages); }
  async function refreshStats() { const result = await api.stats(); setStats(result); }
  useEffect(() => { refreshLeads().catch(() => {}); refreshStats().catch(() => {}); const timer = setInterval(() => { refreshLeads().catch(() => {}); refreshStats().catch(() => {}); }, 3000); return () => clearInterval(timer); }, []);
  useEffect(() => { refreshMessages().catch(() => {}); const timer = setInterval(() => refreshMessages().catch(() => {}), 3000); return () => clearInterval(timer); }, [selectedId]);
  useEffect(() => { const socket = io({ withCredentials: true }); socket.on("message:new", () => { refreshLeads().catch(() => {}); refreshMessages().catch(() => {}); refreshStats().catch(() => {}); }); return () => socket.close(); }, [selectedId]);
  const selectedLead = leads.find((lead) => lead.id === selectedId) || null;
  async function toggleTakeover(enabled) { if (!selectedLead) return; await api.takeover(selectedLead.id, enabled); await refreshLeads(); await refreshMessages(); }
  async function sendHuman(text) { if (!selectedLead) return; await api.humanMessage(selectedLead.id, text); await refreshMessages(); await refreshLeads(); }
  async function sendTest(payload) { setBusy(true); try { await api.simulateMessage(payload); await refreshLeads(); } finally { setBusy(false); } }

  return (
    <main className="app-shell">
      <header className="topbar"><div><span className="eyebrow">Business workspace</span><h1>{session.user.businessName}</h1></div><div className="account"><span>{session.user.email}</span><button className="ghost-button" onClick={onLogout}>Logout</button></div></header>
      <section className="stats-strip">
        <div><span>Leads</span><strong>{stats?.leads ?? "—"}</strong></div><div><span>AI replies</span><strong>{stats?.aiMessages ?? "—"}</strong></div><div><span>Human replies</span><strong>{stats?.humanMessages ?? "—"}</strong></div><div><span>Avg AI latency</span><strong>{stats ? stats.avgAiLatencyMs + "ms" : "—"}</strong></div><div><span>Tokens</span><strong>{stats?.tokens?.total ?? "—"}</strong></div>
      </section>
      <div className="workspace"><LeadList leads={leads} selectedId={selectedId} onSelect={setSelectedId} onSearch={(q) => refreshLeads(q)} /><ChatWindow lead={selectedLead} messages={messages} onToggleTakeover={toggleTakeover} onHumanSend={sendHuman} /></div>
      <TestPanel onSend={sendTest} disabled={busy} />
    </main>
  );
}
