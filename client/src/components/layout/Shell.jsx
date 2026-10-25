import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Repeat2,
  Sparkles,
  ChartNoAxesCombined,
  Settings,
  Plus,
  Search,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  Flame,
  Sun,
  Moon,
  Inbox,
} from 'lucide-react';
import api from '../../api/client.js';
import TaskModal from '../tasks/TaskModal.jsx';
import Overview from '../../pages/Overview.jsx';
import Tasks from '../../pages/Tasks.jsx';
import Calendar from '../../pages/Calendar.jsx';
import Routine from '../../pages/Routine.jsx';
import Assistant from '../../pages/Assistant.jsx';
import Insights from '../../pages/Insights.jsx';
import SettingsPage from '../../pages/Settings.jsx';

export const navigationLinks = [
  ['Overview', '/', LayoutDashboard],
  ['My Tasks', '/tasks', CheckSquare],
  ['Daily To-Do', '/today', Inbox],
  ['Calendar', '/calendar', CalendarDays],
  ['Daily Routine', '/routine', Repeat2],
  ['AI Assistant', '/assistant', Sparkles],
  ['Insights', '/insights', ChartNoAxesCombined],
  ['Settings', '/settings', Settings],
];

/**
 * Shell Layout Component
 * 
 * Provides the persistent workspace frame:
 * - Responsive Collapsible Sidebar with navigation items, quick new task trigger, mini streak indicator, and user profile
 * - Sticky Topbar with mobile drawer trigger, breadcrumb navigation, global task search event dispatcher, and theme toggle
 * - Main content container rendering child routes
 * - Global Task creation modal
 */
export function Shell({ user, setUser, dark, setDark }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [modalState, setModalState] = useState(false);
  const location = useLocation();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('taskpilot_token');
    setUser(null);
  }

  const currentNav = navigationLinks.find(([_, path]) => path === location.pathname);
  const currentPageTitle = currentNav ? currentNav[0] : 'TaskPilot AI';

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span>
            TaskPilot<span className="brand-ai"> AI</span>
          </span>
          <button
            type="button"
            className="icon-btn mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {navigationLinks.map(([label, path, Icon]) => (
            <NavLink
              onClick={() => setSidebarOpen(false)}
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {label === 'AI Assistant' && <span className="nav-spark">✦</span>}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="new-task-side"
          onClick={() => setModalState(true)}
        >
          <Plus size={17} /> New task <span>⌘ K</span>
        </button>

        <div className="sidebar-bottom">
          <div className="mini-streak">
            <div className="flame">
              <Flame size={18} />
            </div>
            <div>
              <b>Routine streak</b>
              <small>Keep your rhythm going</small>
            </div>
            <ArrowUpRight size={15} />
          </div>

          <div className="profile-row">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="profile-copy">
              <b>{user.name}</b>
              <small>Personal workspace</small>
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Log out"
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop scrim on mobile when sidebar is open */}
      {sidebarOpen && (
        <div className="scrim" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <main className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn mobile-menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={19} />
          </button>

          <div className="crumb">
            <span>Workspace</span>
            <b>/</b>
            <strong>{currentPageTitle}</strong>
          </div>

          <div className="top-actions">
            <label className="searchbox">
              <Search size={15} />
              <input
                placeholder="Search tasks…"
                onChange={(e) =>
                  window.dispatchEvent(
                    new CustomEvent('search', { detail: e.target.value })
                  )
                }
              />
              <kbd>⌘ K</kbd>
            </label>

            <button
              type="button"
              className="icon-btn theme-toggle"
              title="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="avatar small">{user.name.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <section className="page-content">
          <Routes>
            <Route
              path="/"
              element={
                <Overview
                  user={user}
                  refresh={refreshTrigger}
                  onAdd={() => setModalState(true)}
                />
              }
            />
            <Route
              path="/tasks"
              element={
                <Tasks
                  refresh={refreshTrigger}
                  onAdd={() => setModalState(true)}
                />
              }
            />
            <Route
              path="/today"
              element={
                <Tasks
                  refresh={refreshTrigger}
                  onAdd={() => setModalState(true)}
                  today
                />
              }
            />
            <Route
              path="/calendar"
              element={
                <Calendar
                  refresh={refreshTrigger}
                  onAdd={(date) => setModalState(date || true)}
                />
              }
            />
            <Route path="/routine" element={<Routine />} />
            <Route
              path="/assistant"
              element={
                <Assistant
                  refresh={() => setRefreshTrigger((prev) => prev + 1)}
                />
              }
            />
            <Route path="/insights" element={<Insights />} />
            <Route
              path="/settings"
              element={<SettingsPage user={user} setUser={setUser} />}
            />
          </Routes>
        </section>
      </main>

      {/* Global Task Creation Modal */}
      {modalState && (
        <TaskModal
          initialDate={typeof modalState === 'string' ? modalState : ''}
          onClose={() => setModalState(false)}
          onSaved={() => {
            setModalState(false);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

export default Shell;
