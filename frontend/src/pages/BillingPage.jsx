import React, { useEffect, useState } from 'react';
import { billing } from '../api';

function formatPrice(cents) {
  if (!cents) return 'Free';
  return `$${(cents / 100).toFixed(2)} / month`;
}

function PlanStatusBadge({ status }) {
  const map = {
    active: 'badge-success',
    inactive: 'badge-secondary',
    past_due: 'badge-warning',
    canceled: 'badge-danger',
  };
  return <span className={`badge ${map[status] || 'badge-secondary'}`}>{status}</span>;
}

export default function BillingPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    billing.status()
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  const handleCheckout = async (planId) => {
    setBusy(planId);
    setError('');
    setNotice('');
    try {
      const res = await billing.checkout(planId);
      if (res.configured === false) {
        setNotice(`Checkout is unavailable: ${res.reason}.`);
      } else if (res.url) {
        window.location.href = res.url;
      } else {
        setNotice('Stripe did not return a checkout URL.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!status && !error) {
    return <div className="container"><p>Loading billing…</p></div>;
  }

  const plans = (status && status.plans) || [];
  const configured = Boolean(status && status.configured);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title"><span className="page-icon">💳</span> Billing &amp; Plans</h1>
        <p className="page-subtitle">Manage your subscription. Checkout is only offered when Stripe is configured.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-warning">{notice}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Current subscription</h3>
        <p>
          Plan: <strong>{status ? status.plan : 'free'}</strong>{' '}
          <PlanStatusBadge status={status ? status.status : 'inactive'} />
        </p>
        <p className="muted">
          {status && status.current_period_end
            ? `Current period ends ${new Date(status.current_period_end).toLocaleDateString()}`
            : 'No active billing period.'}
        </p>
        <p>
          Stripe:{' '}
          <span className={`badge ${configured ? 'badge-success' : 'badge-secondary'}`}>
            {configured ? 'configured' : 'not configured'}
          </span>
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          marginBottom: '1.5rem',
        }}
      >
        {plans.map((plan) => {
          const isCurrent = status && status.plan === plan.id && status.status === 'active';
          return (
            <div className="card" key={plan.id}>
              <h3>{plan.name}</h3>
              <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatPrice(plan.monthly_price_cents)}</p>
              <ul style={{ margin: '0.75rem 0 1rem 1.1rem', padding: 0 }}>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              {plan.monthly_price_cents === 0 ? (
                <button className="btn btn-secondary" disabled>{isCurrent ? 'Current plan' : 'Included'}</button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={busy === plan.id || isCurrent}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {isCurrent ? 'Current plan' : busy === plan.id ? 'Starting…' : 'Checkout'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!configured && (
        <div className="card">
          <h3>Heads up</h3>
          <p className="muted">
            Stripe is not configured in this environment, so the Checkout button will report that honestly instead of
            creating a subscription. Set <code>STRIPE_SECRET_KEY</code> (and <code>STRIPE_WEBHOOK_SECRET</code>) to enable
            real checkout.
          </p>
        </div>
      )}
    </div>
  );
}
