import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFeatureByPath } from '../config/features';
import { fetchItems, createItem, updateItem, deleteItem, getAIInsight, fetchItems as fetchList, exportCSV } from '../api';
import AIOutput from '../components/AIOutput';

export default function FeaturePage() {
  const { feature: featureParam } = useParams();
  const navigate = useNavigate();
  const feature = getFeatureByPath(featureParam);

  const [items, setItems] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [childFilter, setChildFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!feature || feature.isSpecial) {
      navigate('/');
    }
  }, [feature, navigate]);

  const loadItems = useCallback(async () => {
    if (!feature) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (childFilter) params.child_id = childFilter;
      if (search) params.search = search;
      const data = await fetchItems(feature.apiEndpoint, params);
      const list = Array.isArray(data) ? data : data.data || data.items || [];
      setItems(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [feature, childFilter, search]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (feature?.hasChildFilter || feature?.fields.some((f) => f.type === 'child_select')) {
      fetchList('/children')
        .then((data) => {
          const list = Array.isArray(data) ? data : data.data || data.items || [];
          setChildren(list);
        })
        .catch(() => {});
    }
  }, [feature]);

  if (!feature || feature.isSpecial) return null;

  const getChildName = (childId) => {
    const child = children.find((c) => String(c.id) === String(childId));
    return child ? child.name : childId;
  };

  const formatCellValue = (field, value) => {
    if (value === null || value === undefined) return '-';
    if (field === 'child_id') return getChildName(value);
    if (field === 'is_primary') return value ? 'Yes' : 'No';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (String(value).length > 60) return String(value).substring(0, 60) + '...';
    return String(value);
  };

  const formatFieldLabel = (name) => {
    const fieldConfig = feature.fields.find((f) => f.name === name);
    if (fieldConfig) return fieldConfig.label;
    return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const openNewForm = () => {
    const initial = {};
    feature.fields.forEach((f) => {
      if (f.type === 'boolean') {
        initial[f.name] = false;
      } else {
        initial[f.name] = '';
      }
    });
    if (childFilter) initial.child_id = childFilter;
    setFormData(initial);
    setFormErrors({});
    setEditMode(false);
    setSelectedItem(null);
    setShowForm(true);
    setShowDetail(false);
    setAiResult(null);
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setShowDetail(true);
    setShowForm(false);
    setAiResult(null);
  };

  const openEditForm = () => {
    const data = {};
    feature.fields.forEach((f) => {
      data[f.name] = selectedItem[f.name] ?? '';
    });
    setFormData(data);
    setFormErrors({});
    setEditMode(true);
    setShowForm(true);
    setShowDetail(false);
  };

  const closeAll = () => {
    setShowForm(false);
    setShowDetail(false);
    setShowDeleteConfirm(false);
    setSelectedItem(null);
    setAiResult(null);
  };

  const validateForm = () => {
    const errors = {};
    feature.fields.forEach((f) => {
      if (f.required && !formData[f.name] && formData[f.name] !== 0 && formData[f.name] !== false) {
        errors[f.name] = `${f.label} is required`;
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const submitData = { ...formData };
      // Convert numeric fields
      feature.fields.forEach((f) => {
        if (f.type === 'number' && submitData[f.name] !== '' && submitData[f.name] !== null) {
          submitData[f.name] = Number(submitData[f.name]);
        }
      });

      if (editMode && selectedItem) {
        await updateItem(feature.apiEndpoint, selectedItem.id, submitData);
      } else {
        await createItem(feature.apiEndpoint, submitData);
      }
      setShowForm(false);
      setSelectedItem(null);
      loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setDeleting(true);
    try {
      await deleteItem(feature.apiEndpoint, selectedItem.id);
      setShowDeleteConfirm(false);
      setShowDetail(false);
      setSelectedItem(null);
      loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleAskAI = async () => {
    if (!selectedItem) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const context = JSON.stringify(selectedItem, null, 2);
      const data = await getAIInsight(
        feature.key,
        context,
        feature.aiPromptTemplate
      );
      setAiResult(data);
    } catch (err) {
      setAiResult({ response: `Error: ${err.message}`, model: null, usage: null });
    } finally {
      setAiLoading(false);
    }
  };

  const renderFormField = (field) => {
    const value = formData[field.name] ?? '';
    const hasError = formErrors[field.name];

    const commonProps = {
      id: field.name,
      className: `form-input ${hasError ? 'form-input-error' : ''}`,
      value,
      onChange: (e) => {
        const val = field.type === 'boolean' ? e.target.checked : e.target.value;
        setFormData((prev) => ({ ...prev, [field.name]: val }));
        if (formErrors[field.name]) {
          setFormErrors((prev) => {
            const copy = { ...prev };
            delete copy[field.name];
            return copy;
          });
        }
      },
    };

    let input;

    switch (field.type) {
      case 'textarea':
        input = <textarea {...commonProps} rows={3} />;
        break;
      case 'select':
        input = (
          <select {...commonProps}>
            <option value="">Select...</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
        break;
      case 'child_select':
        input = (
          <select {...commonProps}>
            <option value="">Select child...</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.name}</option>
            ))}
          </select>
        );
        break;
      case 'boolean':
        input = (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, [field.name]: e.target.checked }));
              }}
            />
            <span className="checkbox-text">{field.label}</span>
          </label>
        );
        break;
      case 'number':
        input = <input type="number" step="any" {...commonProps} />;
        break;
      case 'date':
        input = <input type="date" {...commonProps} />;
        break;
      case 'time':
        input = <input type="time" {...commonProps} />;
        break;
      default:
        input = <input type="text" {...commonProps} />;
    }

    return (
      <div className="form-group" key={field.name}>
        {field.type !== 'boolean' && (
          <label htmlFor={field.name} className="form-label">
            {field.label}
            {field.required && <span className="form-required">*</span>}
          </label>
        )}
        {input}
        {hasError && <span className="form-error-text">{hasError}</span>}
      </div>
    );
  };

  return (
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            &larr; Dashboard
          </button>
          <h1 className="page-title">
            <span className="page-icon">{feature.icon}</span>
            {feature.title}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const tableName = feature.apiEndpoint.replace(/^\//, '').replace(/-/g, '_');
              exportCSV(tableName).catch((err) => setError(err.message));
            }}
            title="Export to CSV"
          >
            📥 Export CSV
          </button>
          <button className="btn btn-primary" onClick={openNewForm}>
            + New {feature.title.replace(/s$/, '').replace(/ies$/, 'y')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {feature.hasChildFilter && (
          <select
            className="form-input filter-select"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
          >
            <option value="">All Children</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.name}</option>
            ))}
          </select>
        )}
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger">
          {error}
          <button className="alert-close" onClick={() => setError('')}>&times;</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading {feature.title.toLowerCase()}...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{feature.icon}</div>
          <h3>No {feature.title.toLowerCase()} yet</h3>
          <p>Get started by adding your first record</p>
          <button className="btn btn-primary" onClick={openNewForm}>
            + Add {feature.title.replace(/s$/, '').replace(/ies$/, 'y')}
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {feature.listColumns.map((col) => (
                  <th key={col}>{formatFieldLabel(col)}</th>
                ))}
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} onClick={() => openDetail(item)} className="clickable-row">
                  {feature.listColumns.map((col) => (
                    <td key={col}>{formatCellValue(col, item[col])}</td>
                  ))}
                  <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        setSelectedItem(item);
                        const data = {};
                        feature.fields.forEach((f) => {
                          data[f.name] = item[f.name] ?? '';
                        });
                        setFormData(data);
                        setFormErrors({});
                        setEditMode(true);
                        setShowForm(true);
                        setShowDetail(false);
                        setAiResult(null);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedItem && (
        <div className="modal-backdrop" onClick={closeAll}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {feature.icon} {selectedItem.name || selectedItem.title || selectedItem.vaccine_name || 'Detail'}
              </h2>
              <button className="modal-close" onClick={closeAll}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                {feature.fields.map((field) => {
                  let val = selectedItem[field.name];
                  if (field.type === 'child_select') val = getChildName(val);
                  if (field.type === 'boolean') val = val ? 'Yes' : 'No';
                  return (
                    <div className="detail-field" key={field.name}>
                      <span className="detail-label">{field.label}</span>
                      <span className="detail-value">{val || '-'}</span>
                    </div>
                  );
                })}
              </div>

              {/* AI Section */}
              <div className="detail-ai-section">
                <button
                  className="btn btn-ai"
                  onClick={handleAskAI}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <span className="spinner-sm" /> Asking AI...
                    </>
                  ) : (
                    '🤖 Ask AI for Insights'
                  )}
                </button>
                {aiResult && (
                  <AIOutput
                    response={aiResult.response}
                    model={aiResult.model}
                    usage={aiResult.usage}
                  />
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={openEditForm}>
                Edit
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
              <button className="btn btn-ghost" onClick={closeAll}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={closeAll}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editMode ? 'Edit' : 'New'} {feature.title.replace(/s$/, '').replace(/ies$/, 'y')}
              </h2>
              <button className="modal-close" onClick={closeAll}>&times;</button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {feature.fields.map(renderFormField)}
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editMode ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeAll}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Delete</h2>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this record? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
