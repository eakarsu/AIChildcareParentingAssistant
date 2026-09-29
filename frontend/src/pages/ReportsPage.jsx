import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchItems,
  getGrowthReport,
  getSleepReport,
  getFeedingReport,
  getExpenseSummary,
  getReportsOverview,
} from '../api';

const TABS = [
  { key: 'growth', label: '📏 Growth', needsChild: true },
  { key: 'sleep', label: '😴 Sleep', needsChild: true },
  { key: 'feeding', label: '🍽️ Feeding', needsChild: true },
  { key: 'expenses', label: '💰 Expenses', needsChild: false },
  { key: 'overview', label: '📊 Overview', needsChild: false },
];

const fmt = (value, digits = 2) =>
  value === null || value === undefined || value === '' ? '—' : Number(value).toFixed(digits);

const money = (cents, dollars) =>
  `${dollars === null || dollars === undefined ? '—' : `$${Number(dollars).toFixed(2)}`} (${cents ?? 0}¢)`;

function KpiCards({ items }) {
  return (
    <div className="dashboard-stats">
      {items.map((item) => (
        <div className="dashboard-stat-card" key={item.label}>
          <div className="dashboard-stat-icon">{item.icon}</div>
          <div className="dashboard-stat-content">
            <div className="dashboard-stat-value">{item.value}</div>
            <div className="dashboard-stat-label">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DefinitionNote({ definition }) {
  if (!definition) return null;
  return <p className="report-definition">ℹ️ {definition}</p>;
}

function InsufficientNote({ report }) {
  if (!report || !report.insufficient) return null;
  return (
    <div className="alert alert-warning">
      {report.reason || 'Not enough data to compute this report.'}
    </div>
  );
}

export default function ReportsPage() {
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [tab, setTab] = useState('growth');
  const [days, setDays] = useState(30);

  const [report, setReport] = useState(null);
  const [expenseFrom, setExpenseFrom] = useState('');
  const [expenseTo, setExpenseTo] = useState('');
  const [expenses, setExpenses] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItems('/children')
      .then((data) => {
        const list = Array.isArray(data) ? data : data.data || data.items || [];
        setChildren(list);
        if (list.length > 0) setChildId(String(list[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadChildReport = useCallback(async () => {
    if (!childId || !['growth', 'sleep', 'feeding'].includes(tab)) return;
    setLoading(true);
    setError('');
    try {
      let data;
      if (tab === 'growth') data = await getGrowthReport(childId);
      else if (tab === 'sleep') data = await getSleepReport(childId, days);
      else data = await getFeedingReport(childId, days);
      setReport(data);
    } catch (err) {
      setError(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [childId, tab, days]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getExpenseSummary({ from: expenseFrom, to: expenseTo });
      setExpenses(data);
    } catch (err) {
      setError(err.message);
      setExpenses(null);
    } finally {
      setLoading(false);
    }
  }, [expenseFrom, expenseTo]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOverview(await getReportsOverview());
    } catch (err) {
      setError(err.message);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (['growth', 'sleep', 'feeding'].includes(tab)) loadChildReport();
  }, [tab, loadChildReport]);

  useEffect(() => {
    if (tab === 'expenses') loadExpenses();
    if (tab === 'overview') loadOverview();
  }, [tab, loadExpenses, loadOverview]);

  const renderGrowth = () => {
    if (!report) return null;
    const deltas = report.deltas || {};
    return (
      <>
        <InsufficientNote report={report} />
        {!report.insufficient && (
          <KpiCards
            items={[
              { icon: '📏', label: 'Height Δ', value: deltas.heightCm?.available ? `${fmt(deltas.heightCm.delta)} cm` : '—' },
              { icon: '⚖️', label: 'Weight Δ', value: deltas.weightKg?.available ? `${fmt(deltas.weightKg.delta)} kg` : '—' },
              { icon: '📈', label: 'Measurements', value: report.count },
            ]}
          />
        )}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Height (cm)</th>
                <th>Weight (kg)</th>
                <th>Head (cm)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.series.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{fmt(row.heightCm)}</td>
                  <td>{fmt(row.weightKg)}</td>
                  <td>{fmt(row.headCircumferenceCm)}</td>
                  <td>{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!report.insufficient && (
          <div className="card">
            <h3>Computed deltas</h3>
            {['heightCm', 'weightKg', 'headCircumferenceCm'].map((key) => {
              const delta = deltas[key];
              if (!delta) return null;
              return (
                <div className="row" key={key}>
                  <strong>{key}</strong>
                  {delta.available ? (
                    <span>
                      {fmt(delta.first.value)} → {fmt(delta.last.value)} {delta.unit} ({fmt(delta.delta)}{' '}
                      {delta.unit} over {delta.spanDays} days = {fmt(delta.perMonth)} {delta.unit}/month)
                    </span>
                  ) : (
                    <span>{delta.reason}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const renderSleep = () => {
    if (!report) return null;
    return (
      <>
        <InsufficientNote report={report} />
        <KpiCards
          items={[
            { icon: '⏱️', label: 'Total hours', value: fmt(report.totalHours) },
            { icon: '📅', label: 'Avg hours/day', value: fmt(report.averageHoursPerDay) },
            { icon: '🌙', label: 'Days recorded', value: report.dayCount },
            { icon: '🛏️', label: 'Sessions', value: report.validCount },
          ]}
        />
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Sessions</th>
              </tr>
            </thead>
            <tbody>
              {report.perDay.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{fmt(row.hours)}</td>
                  <td>{row.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="row">
            <strong>Longest night</strong>
            <span>
              {report.longestNight
                ? `${report.longestNight.date}: ${fmt(report.longestNight.hours)} h`
                : '—'}
            </span>
          </div>
          <div className="row">
            <strong>Shortest night</strong>
            <span>
              {report.shortestNight
                ? `${report.shortestNight.date}: ${fmt(report.shortestNight.hours)} h`
                : '—'}
            </span>
          </div>
          <div className="row">
            <strong>Excluded (missing/invalid times)</strong>
            <span>{report.missingOrInvalidCount}</span>
          </div>
        </div>
      </>
    );
  };

  const renderFeeding = () => {
    if (!report) return null;
    return (
      <>
        <InsufficientNote report={report} />
        <KpiCards
          items={[
            { icon: '🍽️', label: 'Meals', value: report.count },
            { icon: '📅', label: 'Days recorded', value: report.dayCount },
            { icon: '📈', label: 'Avg meals/day', value: fmt(report.averageMealsPerDay) },
            { icon: '🔥', label: 'Calories', value: report.caloriesTotal },
          ]}
        />
        <div className="report-grid">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Meal type</th>
                  <th>Count</th>
                  <th>Calories</th>
                </tr>
              </thead>
              <tbody>
                {report.byMealType.map((row) => (
                  <tr key={row.meal_type}>
                    <td>{row.meal_type}</td>
                    <td>{row.count}</td>
                    <td>{row.calories}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meals</th>
                  <th>Calories</th>
                </tr>
              </thead>
              <tbody>
                {report.dailyTotals.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.count}</td>
                    <td>{row.calories}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  const renderExpenses = () => {
    if (!expenses) return null;
    return (
      <>
        <div className="filters-bar">
          <label className="form-label" htmlFor="expense-from">From</label>
          <input
            id="expense-from"
            type="date"
            className="form-input filter-select"
            value={expenseFrom}
            onChange={(e) => setExpenseFrom(e.target.value)}
          />
          <label className="form-label" htmlFor="expense-to">To</label>
          <input
            id="expense-to"
            type="date"
            className="form-input filter-select"
            value={expenseTo}
            onChange={(e) => setExpenseTo(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={loadExpenses}>Apply</button>
        </div>
        <KpiCards
          items={[
            { icon: '💰', label: 'Grand total', value: money(expenses.totalCents, expenses.totalDollars) },
            { icon: '🧾', label: 'Expenses', value: expenses.count },
            { icon: '💵', label: 'Currency', value: expenses.currency },
          ]}
        />
        <div className="report-grid">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {expenses.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td>{row.count}</td>
                    <td>{money(row.totalCents, row.totalDollars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Count</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {expenses.byMonth.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{row.count}</td>
                    <td>{money(row.totalCents, row.totalDollars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="report-definition">ℹ️ {expenses.note}</p>
      </>
    );
  };

  const renderOverview = () => {
    if (!overview) return null;
    return (
      <>
        <KpiCards items={[{ icon: '👶', label: 'Children', value: overview.children }]} />
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Table</th>
                <th>Your rows</th>
              </tr>
            </thead>
            <tbody>
              {overview.perFeature.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.table}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const currentTab = TABS.find((t) => t.key === tab);
  const definition = ['growth', 'sleep', 'feeding'].includes(tab)
    ? report?.definition
    : tab === 'expenses'
      ? expenses?.definition
      : overview?.definition;

  return (
    <div className="container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <span className="page-icon">📈</span> Reports
          </h1>
          <p className="page-subtitle">
            Deterministic summaries computed from your own rows — no estimates.
          </p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="report-tabs">
          {TABS.map((item) => (
            <button
              key={item.key}
              className={`btn btn-sm ${tab === item.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {currentTab?.needsChild && (
          <>
            <select
              className="form-input filter-select"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
            >
              <option value="">Select child...</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
            <select
              className="form-input filter-select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 14, 30, 90, 365].map((d) => (
                <option key={d} value={d}>Last {d} days (of data)</option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button className="alert-close" onClick={() => setError('')}>&times;</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Computing report…</p>
        </div>
      ) : (
        <>
          {tab === 'growth' && renderGrowth()}
          {tab === 'sleep' && renderSleep()}
          {tab === 'feeding' && renderFeeding()}
          {tab === 'expenses' && renderExpenses()}
          {tab === 'overview' && renderOverview()}
        </>
      )}

      <DefinitionNote definition={definition} />
    </div>
  );
}
