import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Wallet, IndianRupee, CheckCircle2, History, X } from 'lucide-react';
import { api } from '../../api';
import { addAuditLog } from '../../utils/logger';

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ISO date (yyyy-mm-dd) N days ago / today, for the range inputs.
const isoDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

export const SettlementsModule = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payFor, setPayFor] = useState(null);   // row being paid
  const [history, setHistory] = useState(null); // { stall, items }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = {};
      if (from) range.from = new Date(from + 'T00:00:00').toISOString();
      if (to) range.to = new Date(to + 'T23:59:59').toISOString();
      const data = await api.getVendorSettlements(range);
      setRows(data);
    } catch (e) {
      setError(e.message || 'Failed to load settlements.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce((a, r) => ({
    gross: a.gross + r.gross, commission: a.commission + r.commission,
    net: a.net + r.netEarned, paid: a.paid + r.paid, balance: a.balance + r.balance
  }), { gross: 0, commission: 0, net: 0, paid: 0, balance: 0 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wallet size={24} color="#6366F1" /> VENDOR SETTLEMENTS
          </h1>
          <p className="text-slate-500 text-sm font-medium">Money owed to each stall from paid orders, minus what you’ve already paid out.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.7rem', fontWeight: 800, color: '#64748B' }}>
            FROM
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ padding: '7px 9px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.7rem', fontWeight: 800, color: '#64748B' }}>
            TO
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ padding: '7px 9px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700 }} />
          </label>
          <button onClick={() => { setFrom(isoDay(7)); setTo(isoDay(0)); }}
            style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>Last 7d</button>
          <button onClick={() => { setFrom(''); setTo(''); }}
            style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>All time</button>
          <button onClick={load}
            style={{ padding: '9px 12px', borderRadius: 10, border: 'none', background: '#0F172A', color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="status-pill cancelled" style={{ alignSelf: 'flex-start' }}>{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 font-semibold p-6"><Loader2 className="animate-spin" size={18} /> Loading settlements…</div>
      ) : rows.length === 0 ? (
        <div className="admin-card-v2" style={{ padding: 24, color: '#64748B', fontWeight: 600 }}>No paid orders in this range yet.</div>
      ) : (
        <div className="admin-card-v2" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px' }}>Stall</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Orders</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Gross</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Commission</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Net earned</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Paid</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Balance owed</th>
                <th style={{ padding: '12px 14px' }}>Bank / UPI</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.stallId} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F172A' }}>
                    {r.stallName}
                    {r.vendor?.name && <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>{r.vendor.name}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{r.orders}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{inr(r.gross)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#DC2626' }}>−{inr(r.commission)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{inr(r.netEarned)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#64748B' }}>{inr(r.paid)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: r.balance > 0 ? '#15803D' : '#94A3B8' }}>{inr(r.balance)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '0.72rem', color: '#475569' }}>
                    {r.vendor?.upi ? <div>UPI: {r.vendor.upi}</div> : null}
                    {r.vendor?.accountLast4 ? <div>A/C ••{r.vendor.accountLast4} · {r.vendor.ifsc || ''}</div> : null}
                    {!r.vendor?.upi && !r.vendor?.accountLast4 ? <span style={{ color: '#F59E0B' }}>No bank details</span> : null}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setPayFor(r)} disabled={r.balance <= 0}
                      style={{ padding: '7px 12px', borderRadius: 9, border: 'none', cursor: r.balance <= 0 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.75rem', background: r.balance <= 0 ? '#E2E8F0' : '#DCFCE7', color: r.balance <= 0 ? '#94A3B8' : '#15803D' }}>
                      Mark paid
                    </button>
                    <button onClick={() => setHistory({ stall: r, items: null })} title="Payout history"
                      style={{ marginLeft: 6, padding: '7px 9px', borderRadius: 9, border: '1px solid #E2E8F0', cursor: 'pointer', background: '#fff', color: '#475569' }}>
                      <History size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC', fontWeight: 800, color: '#0F172A' }}>
                <td style={{ padding: '12px 14px' }}>TOTAL</td>
                <td></td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>{inr(totals.gross)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#DC2626' }}>−{inr(totals.commission)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>{inr(totals.net)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>{inr(totals.paid)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: '#15803D' }}>{inr(totals.balance)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {payFor && <PayoutModal row={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
      {history && <HistoryModal row={history.stall} onClose={() => setHistory(null)} />}
    </div>
  );
};

// ── Mark-paid modal ──────────────────────────────────────────────────────────
const PayoutModal = ({ row, onClose, onDone }) => {
  const [amount, setAmount] = useState(String(row.balance));
  const [method, setMethod] = useState('manual');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.recordVendorPayout({
        stallId: row.stallId,
        amount: Number(amount),
        gross: row.gross,
        commission: row.commission,
        method,
        reference
      });
      addAuditLog({ level: 'INFO', category: 'Payouts', message: `Payout ₹${amount} recorded for ${row.stallName} (${method})` });
      onDone();
    } catch (e) {
      setErr(e.message || 'Failed to record payout.');
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: '0 0 4px 0', fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '1.15rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
        <IndianRupee size={18} color="#15803D" /> Record payout — {row.stallName}
      </h3>
      <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px 0' }}>
        Balance owed: <b>{inr(row.balance)}</b>. This only records the payment — send the money via your bank/UPI or Cashfree Payouts.
      </p>
      {row.vendor?.upi && <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: 6 }}>UPI: <b>{row.vendor.upi}</b></div>}
      {row.vendor?.accountLast4 && <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: 10 }}>A/C ••{row.vendor.accountLast4} · {row.vendor.ifsc}</div>}

      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>AMOUNT ₹</label>
      <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
        style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700, marginBottom: 12 }} />

      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>METHOD</label>
      <select value={method} onChange={e => setMethod(e.target.value)}
        style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700, marginBottom: 12 }}>
        <option value="manual">Manual (bank/UPI transfer)</option>
        <option value="cashfree">Cashfree Payouts</option>
      </select>

      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', marginBottom: 4 }}>REFERENCE / UTR (optional)</label>
      <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="UTR / txn id / note"
        style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 600, marginBottom: 14 }} />

      {err && <div style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 700, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} disabled={saving || !(Number(amount) > 0)}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#15803D', color: '#fff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.6 : 1 }}>
          <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Confirm paid'}
        </button>
      </div>
    </Overlay>
  );
};

// ── Payout-history modal ─────────────────────────────────────────────────────
const HistoryModal = ({ row, onClose }) => {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.getPayoutHistory(row.stallId).then(setItems).catch(e => setErr(e.message || 'Failed to load history.'));
  }, [row.stallId]);
  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: '0 0 12px 0', fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '1.1rem', color: '#0F172A' }}>
        Payout history — {row.stallName}
      </h3>
      {err && <div style={{ color: '#DC2626', fontSize: '0.8rem' }}>{err}</div>}
      {!items ? <div style={{ color: '#64748B', fontSize: '0.85rem' }}>Loading…</div> :
        items.length === 0 ? <div style={{ color: '#64748B', fontSize: '0.85rem' }}>No payouts recorded yet.</div> : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {items.map(p => (
              <div key={p.id} style={{ borderBottom: '1px solid #F1F5F9', padding: '10px 0', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0F172A' }}>
                  <span>{inr(p.amount)}</span>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>{new Date(p.created_at).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  {p.method}{p.reference ? ` · ${p.reference}` : ''}{p.created_by ? ` · by ${p.created_by}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
    </Overlay>
  );
};

const Overlay = ({ children, onClose }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(440px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
      {children}
    </div>
  </div>
);
