import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import features from '../config/features';
import { fetchItems } from '../api';

const QUICK_ACTIONS = [
  { label: 'Add Child', icon: '👶', path: '/children', action: 'new' },
  { label: 'Log Feeding', icon: '🍼', path: '/feeding_records', action: 'new' },
  { label: 'Log Sleep', icon: '😴', path: '/sleep_records', action: 'new' },
  { label: 'Add Appointment', icon: '📅', path: '/appointments', action: 'new' },
  { label: 'Log Diaper', icon: '🧷', path: '/diaper_records', action: 'new' },
  { label: 'Add Expense', icon: '💰', path: '/expenses', action: 'new' },
  { label: 'Add Memory', icon: '📸', path: '/photo_memories', action: 'new' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [childCount, setChildCount] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState(0);
  const [todayActivities, setTodayActivities] = useState(0);
  const [pendingChores, setPendingChores] = useState(0);

  useEffect(() => {
    const loadCounts = async () => {
      const countPromises = features
        .filter((f) => !f.isSpecial)
        .map(async (feature) => {
          try {
            const data = await fetchItems(feature.apiEndpoint);
            const items = Array.isArray(data) ? data : data.data || data.items || [];
            return { key: feature.key, count: items.length, items };
          } catch {
            return { key: feature.key, count: '-', items: [] };
          }
        });

      const results = await Promise.all(countPromises);
      const newCounts = {};
      results.forEach((r) => {
        newCounts[r.key] = r.count;

        if (r.key === 'children') {
          setChildCount(typeof r.count === 'number' ? r.count : 0);
        }

        if (r.key === 'appointments' && Array.isArray(r.items)) {
          const upcoming = r.items.filter((a) => {
            const d = new Date(a.appointment_date);
            return d >= new Date() && a.status !== 'Cancelled' && a.status !== 'Completed';
          });
          setUpcomingAppointments(upcoming.length);
        }

        if (r.key === 'activities' && Array.isArray(r.items)) {
          const today = new Date().toISOString().split('T')[0];
          const todayItems = r.items.filter((a) => {
            const d = a.scheduled_date ? a.scheduled_date.split('T')[0] : '';
            return d === today;
          });
          setTodayActivities(todayItems.length);
        }

        if (r.key === 'chores' && Array.isArray(r.items)) {
          const pending = r.items.filter((c) => c.status === 'Pending' || c.status === 'In Progress');
          setPendingChores(pending.length);
        }
      });
      setCounts(newCounts);
    };

    loadCounts();
  }, []);

  const handleCardClick = (feature) => {
    if (feature.isSpecial) {
      navigate('/ai-advisor');
    } else {
      navigate(feature.path);
    }
  };

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            Welcome back, {user?.name || 'Parent'} 👋
          </h1>
          <p className="dashboard-subtitle">
            Manage your family's care from one place
          </p>
        </div>

        {/* Quick Stats */}
        <div className="dashboard-stats">
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon">👶</div>
            <div className="dashboard-stat-content">
              <div className="dashboard-stat-value">{childCount}</div>
              <div className="dashboard-stat-label">Children</div>
            </div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon">📅</div>
            <div className="dashboard-stat-content">
              <div className="dashboard-stat-value">{upcomingAppointments}</div>
              <div className="dashboard-stat-label">Upcoming Appointments</div>
            </div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon">🎨</div>
            <div className="dashboard-stat-content">
              <div className="dashboard-stat-value">{todayActivities}</div>
              <div className="dashboard-stat-label">Today's Activities</div>
            </div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-icon">✅</div>
            <div className="dashboard-stat-content">
              <div className="dashboard-stat-value">{pendingChores}</div>
              <div className="dashboard-stat-label">Pending Chores</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className="quick-action-btn"
              onClick={() => navigate(action.path)}
            >
              <span>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>

        {/* Feature Cards Grid */}
        <div className="dashboard-grid">
          {features.map((feature) => (
            <div
              key={feature.key}
              className={`dashboard-card ${feature.isSpecial ? 'dashboard-card-special' : ''}`}
              onClick={() => handleCardClick(feature)}
            >
              <div className="dashboard-card-icon">{feature.icon}</div>
              <div className="dashboard-card-content">
                <h3 className="dashboard-card-title">{feature.title}</h3>
                <p className="dashboard-card-desc">{feature.description}</p>
              </div>
              {!feature.isSpecial && (
                <div className="dashboard-card-count">
                  {counts[feature.key] !== undefined ? counts[feature.key] : (
                    <span className="spinner-sm" />
                  )}
                  <span className="dashboard-card-count-label">records</span>
                </div>
              )}
              {feature.isSpecial && (
                <div className="dashboard-card-badge">AI Powered</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
