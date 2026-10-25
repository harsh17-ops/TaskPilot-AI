import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import api from '../api/client.js';

/**
 * Auth Page Component
 * Handles user sign in and account registration.
 * Communicates with /api/auth/login and /api/auth/signup endpoints.
 */
export function Auth({ setUser }) {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const response = await api.post(endpoint, form);
      if (response.data.token) {
        localStorage.setItem('taskpilot_token', response.data.token);
      }
      setUser(response.data.user);
    } catch (err) {
      setError(
        err.response?.data?.error || 'Could not connect to TaskPilot. Is the API running?'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Brand Hero Left Column */}
      <div className="auth-left">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span>
            TaskPilot<span className="brand-ai"> AI</span>
          </span>
        </div>

        <div className="auth-copy">
          <div className="eyebrow">
            <span /> YOUR PERSONAL COMMAND CENTER
          </div>
          <h1>
            Make space for
            <br />
            <em>meaningful work.</em>
          </h1>
          <p>
            Bring your tasks, routines, and plans together. Stay focused on what matters, one day at a time.
          </p>

          <div className="auth-quote">
            <div className="quote-stars">✦ ✦ ✦ ✦ ✦</div>
            <p>“The secret of getting ahead is getting started.”</p>
            <small>— Mark Twain</small>
          </div>
        </div>

        <div className="auth-foot">
          A calmer way to get things done <span>© 2026 TaskPilot</span>
        </div>
      </div>

      {/* Authentication Form Right Column */}
      <div className="auth-right">
        <form className="auth-form" onSubmit={submit}>
          <div className="form-icon">✦</div>
          <div className="eyebrow">WELCOME {isSignup ? 'ABOARD' : 'BACK'}</div>
          <h2>{isSignup ? 'Create your account' : 'Sign in to TaskPilot'}</h2>
          <p className="muted">
            {isSignup
              ? 'Start building a more intentional day.'
              : 'Your next great day starts here.'}
          </p>

          {isSignup && (
            <label>
              Full name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Alex Morgan"
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              minLength="8"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-btn wide" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            <ArrowUpRight size={16} />
          </button>

          <div className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to TaskPilot?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </div>

          <div className="privacy-note">🔒 Your data stays private and secure.</div>
        </form>
      </div>
    </div>
  );
}

export default Auth;
