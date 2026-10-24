import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import api from '../api/client.js';
import Heading from '../components/common/Heading.jsx';

/**
 * Settings Page Component
 * Allows users to update their profile display name and active timezone.
 * Demonstrates security architecture with HTTP-only cookies and user-scoped data.
 */
export function SettingsPage({ user, setUser }) {
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone || 'UTC');
  const [message, setMessage] = useState('');

  const supportedTimezones = [
    'UTC',
    'Asia/Kolkata',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      const response = await api.patch('/users/me', { name, timezone });
      setUser(response.data.user);
      setMessage('Your settings have been saved.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not save settings.');
    }
  }

  return (
    <>
      <Heading
        eyebrow="YOUR ACCOUNT"
        title="Settings"
        sub="Manage your profile and daily preferences."
      />

      <div className="settings-layout">
        {/* Profile Settings Form */}
        <form className="panel settings-panel" onSubmit={handleSaveSettings}>
          <div className="panel-head">
            <div>
              <h3>Profile details</h3>
              <p>Update how TaskPilot knows you.</p>
            </div>
          </div>

          <label>
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label>
            Email address
            <input value={user.email} disabled />
            <small>Email address cannot be changed yet.</small>
          </label>

          <label>
            Timezone
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {supportedTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          {message && <div className="success-note">{message}</div>}

          <button type="submit" className="primary-btn">
            Save changes <ArrowUpRight size={15} />
          </button>
        </form>

        {/* Security & Architectural Highlights */}
        <div className="panel settings-security">
          <div className="security-icon">🔒</div>
          <h3>Your privacy matters</h3>
          <p>
            Your password is securely hashed. Your tasks and routine history are
            scoped to your account.
          </p>
          <span className="security-pill">HTTP-only session cookie</span>
        </div>
      </div>
    </>
  );
}

export default SettingsPage;
