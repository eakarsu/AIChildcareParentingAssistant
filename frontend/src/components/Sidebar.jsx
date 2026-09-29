import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SIDEBAR_SECTIONS } from '../config/features';
import GlobalSearch from './GlobalSearch';

const COLLAPSE_KEY = 'childcare:sidebar:collapsed';

/**
 * Persistent left sidebar navigation.
 *
 * Every feature is reachable from one of the grouped sections; the active route
 * is highlighted. The collapsed state and the mobile drawer are stored locally
 * so the layout survives reloads.
 */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname === item.path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className={`sidebar-mobile-bar ${user ? '' : 'sidebar-hidden'}`}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
        >
          ☰ Menu
        </button>
        <span className="sidebar-mobile-title">AI Childcare Assistant</span>
      </div>

      <aside
        className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <span className="sidebar-logo">🍼</span>
            {!collapsed && <span className="sidebar-brand-title">Childcare Assistant</span>}
          </Link>
          <button
            className="sidebar-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {user && !collapsed && <GlobalSearch />}

        <nav className="sidebar-nav">
          {SIDEBAR_SECTIONS.map((section) => (
            <div className="sidebar-section" key={section.title}>
              {!collapsed && <p className="sidebar-section-title">{section.title}</p>}
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive(item) ? 'sidebar-link-active' : ''}`}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive(item) ? 'page' : undefined}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                  {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {user && (
          <div className="sidebar-footer">
            <Link to="/profile" className="sidebar-user" title="Profile & Settings">
              <span className="sidebar-user-icon" aria-hidden="true">👤</span>
              {!collapsed && (
                <span className="sidebar-user-meta">
                  <span className="sidebar-user-name">{user.name || user.email}</span>
                  <span className="sidebar-user-role">{user.role || 'Parent'}</span>
                </span>
              )}
            </Link>
            <button className="btn btn-ghost btn-sm sidebar-logout" onClick={handleLogout}>
              {collapsed ? '⎋' : 'Logout'}
            </button>
          </div>
        )}
      </aside>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
    </>
  );
}
