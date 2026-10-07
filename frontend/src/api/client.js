async function request(path, options = {}) {
  const response = await fetch(path, { credentials: "include", headers: { "content-type": "application/json", ...(options.headers || {}) }, ...options });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error || "Request failed"); error.status = response.status; throw error; }
  return body;
}
export const api = {
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  leads: (params = {}) => request("/api/leads?" + new URLSearchParams(params)),
  messages: (leadId) => request("/api/leads/" + leadId + "/messages"),
  takeover: (leadId, enabled) => request("/api/leads/" + leadId + "/takeover", { method: "PATCH", body: JSON.stringify({ enabled }) }),
  humanMessage: (leadId, text) => request("/api/leads/" + leadId + "/messages", { method: "POST", body: JSON.stringify({ text }) }),
  stats: () => request("/api/stats"),
  simulateMessage: (payload) => request("/api/dev/simulate-message", { method: "POST", body: JSON.stringify(payload) }),
};
