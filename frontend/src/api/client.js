const TOKEN_KEY = "wa_auth_token";

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...authHeader,
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return body;
}

export const api = {
  login: async (email, password) => {
    const res = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res?.token) {
      localStorage.setItem(TOKEN_KEY, res.token);
    }
    return res;
  },
  me: () => request("/api/auth/me"),
  logout: async () => {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
  getToken: () => localStorage.getItem(TOKEN_KEY),
  leads: (params = {}) => request("/api/leads?" + new URLSearchParams(params)),
  messages: (leadId) => request("/api/leads/" + leadId + "/messages"),
  takeover: (leadId, enabled) => request("/api/leads/" + leadId + "/takeover", { method: "PATCH", body: JSON.stringify({ enabled }) }),
  humanMessage: (leadId, text) => request("/api/leads/" + leadId + "/messages", { method: "POST", body: JSON.stringify({ text }) }),
  stats: () => request("/api/stats"),
  simulateMessage: (payload) => request("/api/dev/simulate-message", { method: "POST", body: JSON.stringify(payload) }),
};
