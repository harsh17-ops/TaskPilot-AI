import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import api from './api/client.js';
import Shell from './components/layout/Shell.jsx';
import Auth from './pages/Auth.jsx';

/**
 * Root Application Component
 * 
 * - Checks active session on mount via /api/auth/me using HTTP-only cookie.
 * - Manages global light/dark theme preference and updates documentElement dataset.
 * - Renders loading screen during initial session verification.
 * - Displays authenticated Shell with BrowserRouter or Auth landing page.
 */
export function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  // Check for an existing valid JWT session cookie or token on application start
  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('taskpilot_token');
      })
      .finally(() => setLoading(false));
  }, []);

  // Sync theme with DOM document attribute
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand-mark">✦</div>
        <p>Preparing your workspace…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user ? (
        <Shell user={user} setUser={setUser} dark={dark} setDark={setDark} />
      ) : (
        <Auth setUser={setUser} />
      )}
    </BrowserRouter>
  );
}

export default App;
