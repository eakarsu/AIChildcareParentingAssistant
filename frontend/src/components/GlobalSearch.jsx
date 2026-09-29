import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearch } from '../api';
import { getFeatureByKey } from '../config/features';

const DEBOUNCE_MS = 300;

/**
 * Debounced global search across the signed-in user's own records.
 *
 * Results come back already grouped by feature (server caps them at 50); this
 * component keeps that grouping when rendering and deep-links to the record's
 * page with `?record=<id>` so FeaturePage can open it.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  // Debounce the input, then hit /api/search?q=.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await globalSearch(trimmed);
        setResults(Array.isArray(data) ? data : []);
        setError('');
        setOpen(true);
      } catch (err) {
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    const onDocumentClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of results) {
      if (!map.has(item.feature)) map.set(item.feature, []);
      map.get(item.feature).push(item);
    }
    return [...map.entries()];
  }, [results]);

  const handleSelect = (item) => {
    setOpen(false);
    setQuery('');
    navigate(`${item.path}?record=${item.id}`);
  };

  const showDropdown = open && (loading || error || query.trim().length > 0);

  return (
    <div className="global-search" ref={containerRef}>
      <div className="search-input-wrapper global-search-input">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          className="form-input search-input"
          placeholder="Search everything..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search all records"
        />
      </div>

      {showDropdown && (
        <div className="global-search-results">
          {loading && <div className="global-search-status">Searching…</div>}
          {!loading && error && <div className="global-search-status global-search-error">{error}</div>}
          {!loading && !error && results.length === 0 && query.trim() && (
            <div className="global-search-status">No matches for “{query.trim()}”.</div>
          )}
          {!loading &&
            !error &&
            groups.map(([feature, items]) => {
              const meta = getFeatureByKey(feature);
              return (
                <div className="global-search-group" key={feature}>
                  <div className="global-search-group-title">
                    <span aria-hidden="true">{meta?.icon || '📄'}</span>
                    {meta?.title || feature}
                    <span className="global-search-group-count">{items.length}</span>
                  </div>
                  {items.map((item) => (
                    <button
                      type="button"
                      key={`${item.feature}-${item.id}`}
                      className="global-search-item"
                      onClick={() => handleSelect(item)}
                    >
                      <span className="global-search-item-title">{item.title}</span>
                      {item.subtitle && (
                        <span className="global-search-item-subtitle">{item.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
