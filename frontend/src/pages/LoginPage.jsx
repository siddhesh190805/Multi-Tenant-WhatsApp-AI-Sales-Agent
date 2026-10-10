import { useState } from "react";

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch {
      setError("Invalid email or password. Please verify credentials.");
    } finally {
      setBusy(false);
    }
  }

  function setDemoCredentials(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
  }

  return (
    <main className="auth-shell">
      <div className="auth-header-strip">
        <div className="auth-brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
          </svg>
          <span>WhatsApp Business</span>
        </div>
      </div>

      <div className="auth-card-container">
        <div className="auth-card">
          <h2 className="auth-card-title">Sign in to Business Workspace</h2>
          <p className="auth-card-desc">
            Access your multi-tenant automated WhatsApp sales agent and real-time customer conversations.
          </p>

          <form className="auth-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="auth-email">Business Email</label>
              <div className="input-wrap">
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@business.test"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <div className="input-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-pwd-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Signing in..." : "Continue to WhatsApp Web"}
            </button>
          </form>

          <div className="demo-selector">
            <div className="demo-selector-title">Select Demo Tenant Workspace</div>
            <div className="demo-buttons">
              <button
                type="button"
                className="demo-btn"
                onClick={() => setDemoCredentials("owner@sunrise.test", "Sunrise@123")}
              >
                <strong>Sunrise Realty</strong>
                <span>Real Estate • acc_A</span>
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => setDemoCredentials("owner@fitzone.test", "FitZone@123")}
              >
                <strong>FitZone Gym</strong>
                <span>Fitness Club • acc_B</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
