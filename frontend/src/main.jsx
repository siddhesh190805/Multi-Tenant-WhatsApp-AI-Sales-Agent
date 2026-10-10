import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import "./styles.css";

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.me().then(setSession).catch(() => {}).finally(() => setChecking(false));
  }, []);

  async function login(email, password) {
    const result = await api.login(email, password);
    setSession(result);
  }

  async function logout() {
    await api.logout();
    setSession(null);
  }

  if (checking) {
    return (
      <main className="loading-screen">
        <div className="spinner" />
        <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 500 }}>Initializing workspace…</p>
      </main>
    );
  }
  if (!session) return <LoginPage onLogin={login} />;
  return <DashboardPage session={session} onLogout={logout} />;
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
