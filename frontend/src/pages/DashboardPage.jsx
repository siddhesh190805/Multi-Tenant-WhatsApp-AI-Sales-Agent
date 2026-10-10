import { useEffect, useState, useRef, useCallback } from "react";
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
  const [socketConnected, setSocketConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const refreshLeads = useCallback(async (query = "") => {
    try {
      const result = await api.leads(query ? { q: query } : {});
      setLeads(result.leads || []);
      setSelectedId((current) => current || result.leads[0]?.id || null);
    } catch (err) {
      console.error("Failed to refresh leads:", err);
    }
  }, []);

  const refreshMessages = useCallback(async (id = selectedIdRef.current) => {
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const result = await api.messages(id);
      setMessages(result.messages || []);
    } catch (err) {
      console.error("Failed to refresh messages:", err);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const result = await api.stats();
      setStats(result);
    } catch (err) {
      console.error("Failed to refresh stats:", err);
    }
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshLeads(), refreshMessages(), refreshStats()]);
    setTimeout(() => setRefreshing(false), 400);
  };

  useEffect(() => {
    refreshLeads();
    refreshStats();
    const timer = setInterval(() => {
      refreshLeads();
      refreshStats();
    }, 4000);
    return () => clearInterval(timer);
  }, [refreshLeads, refreshStats]);

  useEffect(() => {
    refreshMessages(selectedId);
  }, [selectedId, refreshMessages]);

  useEffect(() => {
    const token = api.getToken();
    const socket = io({
      withCredentials: true,
      auth: token ? { token } : undefined,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("message:new", () => {
      refreshLeads();
      refreshMessages(selectedIdRef.current);
      refreshStats();
    });

    socket.on("lead:updated", () => {
      refreshLeads();
      refreshMessages(selectedIdRef.current);
      refreshStats();
    });

    return () => {
      socket.close();
    };
  }, [refreshLeads, refreshMessages, refreshStats]);

  const selectedLead = leads.find((lead) => lead.id === selectedId) || null;

  async function toggleTakeover(enabled) {
    if (!selectedLead) return;
    await api.takeover(selectedLead.id, enabled);
    await Promise.all([refreshLeads(), refreshMessages(selectedLead.id)]);
  }

  async function sendHuman(text) {
    if (!selectedLead) return;
    await api.humanMessage(selectedLead.id, text);
    await Promise.all([refreshMessages(selectedLead.id), refreshLeads()]);
  }

  async function sendTest(payload) {
    setBusy(true);
    try {
      await api.simulateMessage(payload);
      await Promise.all([refreshLeads(), refreshStats()]);
      if (selectedIdRef.current) {
        await refreshMessages(selectedIdRef.current);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wa-app-layout">
      {/* Top Bar */}
      <header className="wa-top-bar">
        <div className="wa-top-left">
          <div className="wa-brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
            </svg>
          </div>
          <div className="wa-brand-details">
            <h1>{session.user.businessName || "WhatsApp Business"}</h1>
            <div className="wa-account-tag">
              <span>Tenant:</span>
              <span className="wa-pill">{session.user.accountId || "acc"}</span>
            </div>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="wa-telemetry-strip">
          <div className="wa-telemetry-item" title="Total Customer Contacts">
            <span>Leads:</span>
            <strong>{stats?.leads ?? (leads.length || "0")}</strong>
          </div>
          <div className="wa-telemetry-item" title="AI Replies Today">
            <span>AI Today:</span>
            <strong>{stats?.aiRepliesToday ?? (stats?.aiMessages ?? "0")}</strong>
          </div>
          <div className="wa-telemetry-item" title="Human Agent Interventions">
            <span>Human:</span>
            <strong>{stats?.humanMessages ?? "0"}</strong>
          </div>
          <div className="wa-telemetry-item" title="Reliability Fallback Rate">
            <span>Fallbacks:</span>
            <strong style={{ color: (stats?.fallbackCount || 0) > 0 ? "var(--wa-warning)" : "inherit" }}>
              {stats?.fallbackCount ?? "0"}
            </strong>
          </div>
          <div className="wa-telemetry-item" title="Average Response Latency">
            <span>Latency:</span>
            <strong>{stats ? `${stats.avgAiLatencyMs}ms` : "—"}</strong>
          </div>
          <div className="wa-telemetry-item" title="Total LLM Tokens Used & Estimated Cost">
            <span>Tokens:</span>
            <strong style={{ fontSize: 11 }}>
              {stats?.tokens?.total ? `${stats.tokens.total.toLocaleString()} ($${stats.estimatedCostUsd || "0.00"})` : "0 ($0)"}
            </strong>
          </div>
        </div>

        {/* Actions */}
        <div className="wa-top-right">
          <div className="wa-status-pill">
            <span
              className="wa-status-dot"
              style={{
                backgroundColor: socketConnected ? "var(--wa-teal)" : "var(--wa-warning)",
              }}
            />
            <span>{socketConnected ? "Live Connected" : "Connecting..."}</span>
          </div>

          <button
            type="button"
            className="wa-btn-secondary wa-btn-test-trigger"
            onClick={() => setSimulatorOpen(true)}
            title="Open Inbound Webhook Simulator"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Simulate Message</span>
          </button>

          <button
            type="button"
            className="wa-btn-secondary"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Sync inbox & metrics"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: refreshing ? "wa-spin 0.6s linear infinite" : "none" }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>

          <button
            type="button"
            className="wa-btn-secondary"
            onClick={onLogout}
            title="Log out"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main WhatsApp 2-Column Canvas */}
      <main className="wa-main-canvas">
        <LeadList
          leads={leads}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSearch={(q) => refreshLeads(q)}
        />

        <ChatWindow
          lead={selectedLead}
          messages={messages}
          onToggleTakeover={toggleTakeover}
          onHumanSend={sendHuman}
          onSimulateLead={(text) => {
            if (!selectedLead) return;
            return sendTest({
              leadPhone: selectedLead.phone,
              leadName: selectedLead.name || "Customer",
              text,
            });
          }}
        />
      </main>

      {/* Developer Webhook Simulator Drawer */}
      <TestPanel
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        onSend={sendTest}
        disabled={busy}
      />
    </div>
  );
}
