import './App.css';
import React, { useEffect, useRef, useState } from 'react';

const API_WEATHER = 'https://api.openweathermap.org/data/2.5/weather';
const API_GEOCODE = 'https://api.openweathermap.org/geo/1.0/direct';
const API_KEY = process.env.REACT_APP_OPENWEATHER_KEY;

function App() {
  const [city, setCity] = useState('Algiers');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- autosuggest state ---
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  const fetchWeather = async (q) => {
    setError('');
    setData(null);
    if (!API_KEY) { setError('Missing API key'); return; }
    const query = (q ?? city).trim() || 'Algiers';
    try {
      setLoading(true);
      const url = `${API_WEATHER}?q=${encodeURIComponent(query)}&appid=${API_KEY}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  // Debounced geocoding lookup
  const lookup = (q) => {
    if (!API_KEY) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setHighlight(-1);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `${API_GEOCODE}?q=${encodeURIComponent(q)}&limit=6&appid=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Suggest request failed');
        const json = await res.json();
        const items = (json || []).map((it) => ({
          label: `${it.name}${it.state ? ', ' + it.state : ''}${it.country ? ', ' + it.country : ''}`,
          value: `${it.name}${it.country ? ',' + it.country : ''}`,
        }));
        setSuggestions(items);
        setOpen(items.length > 0);
        setHighlight(-1);
      } catch {
        // silent fail; keep UI calm
        setSuggestions([]);
        setOpen(false);
        setHighlight(-1);
      }
    }, 250); // debounce ms
  };

  const onChange = (e) => {
    const v = e.target.value;
    setCity(v);
    lookup(v);
  };

  const pick = (s) => {
    setCity(s.value);
    setOpen(false);
    setHighlight(-1);
    // optional: auto search on pick
    fetchWeather(s.value);
  };

  const onKeyDown = (e) => {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setHighlight((h) => {
        const max = suggestions.length - 1;
        if (max < 0) return -1;
        if (e.key === 'ArrowDown') return h >= max ? 0 : h + 1;
        if (e.key === 'ArrowUp') return h <= 0 ? max : h - 1;
        return h;
      });
      return;
    }
    if (e.key === 'Enter') {
      if (open && highlight >= 0 && suggestions[highlight]) {
        pick(suggestions[highlight]);
      } else {
        fetchWeather();
      }
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (ev) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // theme + bg icon
  const theme = (data?.weather?.[0]?.main || 'default').toLowerCase();
  const iconCode = data?.weather?.[0]?.icon || '01d';
  const bigIconUrl = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

  if (typeof document !== 'undefined') {
    document.body.className = `theme-${theme}`;
  }

  return (
    <div className={`app theme-${theme}`} style={{ '--bgIcon': `url(${bigIconUrl})` }}>
      <h1 className="brand">Weatherly</h1>

      <div className="controls">
        <div className="input-wrap" ref={wrapRef} style={{ position: 'relative' }}>
          <span className="input-icon">🔎</span>
          <input
            value={city}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Search city (e.g., Algiers or Algiers,DZ)"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="suggest-list"
          />
          <span className="input-kbd">Enter ↵</span>

          {/* Suggest dropdown (inline-styled so App.css remains unchanged) */}
          {open && suggestions.length > 0 && (
            <div
              id="suggest-list"
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                zIndex: 10,
                background: 'rgba(255,255,255,0.95)',
                color: '#1d2a36',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                overflow: 'hidden',
                backdropFilter: 'blur(6px)',
              }}
            >
              {suggestions.map((s, i) => (
                <div
                  key={s.label + i}
                  role="option"
                  aria-selected={highlight === i}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseLeave={() => setHighlight(-1)}
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: highlight === i ? 'rgba(31,138,192,0.12)' : 'transparent',
                    borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                  title={s.label}
                >
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn" onClick={() => fetchWeather()} disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="city">{data.name}</div>
              <div className="meta">
                {data.weather?.[0]?.description ?? ''} • feels like {Math.round(data.main.feels_like)}°C
              </div>
            </div>
            <img
              className="icon-hero"
              alt={data.weather?.[0]?.main || 'weather'}
              src={`https://openweathermap.org/img/wn/${iconCode}@4x.png`}
            />
          </div>

          <div className="readings">
            <div className="temp">{Math.round(data.main.temp)}°C</div>
            <div className="chips">
              <span className="chip">Min {Math.round(data.main.temp_min)}°</span>
              <span className="chip">Max {Math.round(data.main.temp_max)}°</span>
              <span className="chip">Humidity {data.main.humidity}%</span>
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="label">Wind</span>
              <span className="value">{Math.round(data.wind.speed)} m/s</span>
            </div>
            <div className="stat">
              <span className="label">Pressure</span>
              <span className="value">{data.main.pressure} hPa</span>
            </div>
            <div className="stat">
              <span className="label">Visibility</span>
              <span className="value">{((data.visibility ?? 0) / 1000).toFixed(1)} km</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
