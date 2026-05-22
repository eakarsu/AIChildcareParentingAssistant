import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/children', label: 'Children', icon: '👶' },
  { path: '/appointments', label: 'Appointments', icon: '📅' },
  { path: '/ai-advisor', label: 'AI Advisor', icon: '🤖' },
  { path: '/ai-tools', label: 'AI Tools', icon: '🧠' },
  { path: '/ai-results', label: 'AI History', icon: '📜' },
  { path: '/expenses', label: 'Expenses', icon: '💰' },
  { path: '/shopping_lists', label: 'Shopping', icon: '🛒' },
  { path: '/custom-views', label: 'Parent Views', icon: '👨‍👩‍👧' },
  { path: '/screen-time-balance', label: 'Screen Time', icon: '📱' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="navbar-logo">🍼</span>
          <span className="navbar-title">AI Childcare Assistant</span>
        </Link>

        {user && (
          <div className="navbar-links">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`navbar-link ${location.pathname === link.path ? 'navbar-link-active' : ''}`}
              >
                <span className="navbar-link-icon">{link.icon}</span>
                <span className="navbar-link-label">{link.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="navbar-right">
          {user && (
            <>
              <Link to="/profile" className="navbar-user" title="Profile & Settings">
                <span className="navbar-user-icon">👤</span>
                <span className="navbar-user-name">{user.name || user.email}</span>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
