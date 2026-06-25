import { createContext, useContext, useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'lb_token';

const AuthContext = createContext(null);

// ── Helpers exported for use anywhere ────────────────────────────────────────

export const getToken = () => localStorage.getItem(TOKEN_KEY);

/** Drop-in fetch replacement that attaches the Bearer token automatically */
export const authFetch = (url, options = {}) => {
  const token = getToken();
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

// ── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage token on page load
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${API}/api/auth/me`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.user) setUser(data.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Call after successful login/register — stores token + sets user */
  const login = (userData, token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
