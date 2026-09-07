import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

// Public vendor onboarding form. Renders exactly the fields the admin selected.
const OnboardingPage = () => {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | ready | submitting | done | error
  const [invite, setInvite] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.onboarding.getInvite(token)
      .then(res => { if (alive) { setInvite(res); setState('ready'); } })
      .catch(err => { if (alive) { setError(err.message); setState('error'); } });
    return () => { alive = false; };
  }, [token]);

  const handleChange = (key, v) => setValues(prev => ({ ...prev, [key]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setState('submitting');
    setError('');
    try {
      await api.onboarding.submit(token, values);
      setState('done');
    } catch (err) {
      setError(err.message);
      setState('ready');
    }
  };

  const wrap = { maxWidth: 480, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' };
  const card = { background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', border: '1px solid #eef0f3' };
  const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #d8dce2', fontSize: 15, marginTop: 6, boxSizing: 'border-box' };
  const label = { fontSize: 13, fontWeight: 600, color: '#334155' };

  if (state === 'loading') return <div style={wrap}><p>Loading your invite…</p></div>;
  if (state === 'error') return <div style={wrap}><div style={card}><h2 style={{ marginTop: 0 }}>Invite unavailable</h2><p style={{ color: '#64748b' }}>{error}</p></div></div>;
  if (state === 'done') return (
    <div style={wrap}><div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: 42 }}>✅</div>
      <h2>Onboarding submitted</h2>
      <p style={{ color: '#64748b' }}>Thanks! An admin will review your details and approve your vendor account. You’ll receive a login email once approved.</p>
    </div></div>
  );

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Vendor Onboarding</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Complete your details to join SGU Smart-Bite as a vendor.
        </p>

        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 12px', borderRadius: 10, fontSize: 14, margin: '12px 0' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginTop: 14 }}>
            <span style={label}>Email (your login)</span>
            <input style={{ ...input, background: '#f1f5f9', color: '#64748b' }} value={invite?.contactEmail || ''} readOnly />
          </div>

          {(invite?.fields || []).map(f => (
            <div key={f.key} style={{ marginTop: 14 }}>
              <span style={label}>{f.label}</span>
              <input
                style={input}
                type={f.key === 'mobile' ? 'tel' : 'text'}
                value={values[f.key] || ''}
                onChange={e => handleChange(f.key, e.target.value)}
                placeholder={f.label}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={state === 'submitting'}
            style={{ width: '100%', marginTop: 22, padding: '13px', borderRadius: 12, border: 'none', background: '#E4002B', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            {state === 'submitting' ? 'Submitting…' : 'Submit onboarding'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
