import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import AIAdvisorPage from './pages/AIAdvisorPage';
import AIToolsPage from './pages/AIToolsPage';
import AIResultsPage from './pages/AIResultsPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPage from './pages/PrivacyPage';
import CustomViewsPage from './pages/CustomViewsPage';
import ScreenTimeBalance from './pages/ScreenTimeBalance';
import ReportsPage from './pages/ReportsPage';
import SharingPage from './pages/SharingPage';
import BillingPage from './pages/BillingPage';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

import TimelineView from './pages/TimelineView';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/" replace /> : <Register />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-advisor"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AIAdvisorPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-tools"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AIToolsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-results"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AIResultsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/privacy"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PrivacyPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/insights/timeline" element={<ProtectedRoute><AppLayout><TimelineView /></AppLayout></ProtectedRoute>} />
      <Route path="/codex/custom-viz" element={<ProtectedRoute><AppLayout><CodexCustomVizFeature /></AppLayout></ProtectedRoute>} />
      <Route path="/codex/operations" element={<ProtectedRoute><AppLayout><CodexOperationsFeature /></AppLayout></ProtectedRoute>} />
      <Route
        path="/custom-views"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CustomViewsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/screen-time-balance"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ScreenTimeBalance />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReportsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sharing"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SharingPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BillingPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/:feature"
        element={
          <ProtectedRoute>
            <AppLayout>
              <FeaturePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
