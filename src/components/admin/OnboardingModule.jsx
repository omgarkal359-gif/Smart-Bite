import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Check, X, RefreshCw, Copy, Store, Power, UserPlus, Link2, Pencil, Save, KeyRound, Eye, EyeOff, ShieldCheck, Trash2 } from 'lucide-react';
import { api, DEFAULT_FIELD_CATALOG, getDeletedStallIds } from '../../api';
import { supabase } from '../../supabaseClient';

const GROUP_LABELS = {
  core: 'Core Details',
  bank: 'Bank & Payout Details',
  compliance: 'Compliance & Legal (KYC)',
  stall: 'Stall & Shop Setup'
};

// Single "Vendors" screen with three tabs.
export const OnboardingModule = () => {
  const [tab, setTab] = useState('existing');       // existing | add | pending
  const [subTab, setSubTab] = useState('manual');   // manual | link

  const [catalog, setCatalog] = useState(DEFAULT_FIELD_CATALOG);
  const [invites, setInvites] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [busy, setBusy] = useState(false);

  // form state (shared email/name; manual uses `manualData`, link uses `selected`)
  const [email, setEmail] = useState('');
  const [inviteeName, setInviteeName] = useState('');
  const [manualData, setManualData] = useState({});
  const [selected, setSelected] = useState({ full_name: true, mobile: true, business_name: true });
  const [alsoEmail, setAlsoEmail] = useState(false);

  // password reset states per vendor
  const [passwords, setPasswords] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [passwordNotices, setPasswordNotices] = useState({});
  const [resetLoading, setResetLoading] = useState({});

  const handleResetPassword = async (v) => {
    const vendorEmail = editData.email || editData.contact_email || v.contact_email || v.email;
    if (!vendorEmail || !vendorEmail.trim()) {
      setPasswordNotices(prev => ({
        ...prev,
        [v.id]: { type: 'error', msg: 'Please enter a valid Vendor Email Address in the form above before resetting password.' }
      }));
      return;
    }
    const cleanEmail = vendorEmail.trim().toLowerCase();
    const newPwd = passwords[v.id] || '';
    
    setResetLoading(prev => ({ ...prev, [v.id]: true }));
    setPasswordNotices(prev => ({ ...prev, [v.id]: null }));
    
    try {
      const res = await api.onboarding.resetPassword(cleanEmail, newPwd, v.id);
      setVendors(prev => prev.map(x => x.id === v.id ? { ...x, contact_email: cleanEmail, email: cleanEmail } : x));
      setPasswordNotices(prev => ({
        ...prev,
        [v.id]: { type: 'success', msg: res.message }
      }));
    } catch (err) {
      setPasswordNotices(prev => ({
        ...prev,
        [v.id]: { type: 'error', msg: err.message || 'Failed to reset password in Supabase.' }
      }));
    } finally {
      setResetLoading(prev => ({ ...prev, [v.id]: false }));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, stalls] = await Promise.all([
        api.onboarding.listInvites().catch(() => ({ invites: [], fieldCatalog: DEFAULT_FIELD_CATALOG })),
        api.getStalls().catch(() => [])
      ]);
      setInvites(inv?.invites || []);
      setCatalog(inv?.fieldCatalog && inv.fieldCatalog.length ? inv.fieldCatalog : DEFAULT_FIELD_CATALOG);
      setVendors(stalls || []);
      setError('');
    } catch (err) { 
      setCatalog(DEFAULT_FIELD_CATALOG);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = catalog.reduce((acc, f) => { (acc[f.group] = acc[f.group] || []).push(f); return acc; }, {});
  const pending = invites.filter(i => i.status === 'submitted');

  const linkFor = (token) => `${window.location.origin}/onboard/${token}`;
  const copy = (text, id) => {
    try { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); }
    catch (_e) { window.prompt('Copy this link:', text); }
  };
  const resetForm = () => { setEmail(''); setInviteeName(''); setManualData({}); setSelected({ full_name: true, mobile: true, business_name: true }); setAlsoEmail(false); };

  // ── actions ──
  const handleManual = async (e) => {
    e.preventDefault(); setError(''); setNotice(null); setBusy(true);
    try {
      const data = { ...manualData };
      if (inviteeName && !data.full_name) data.full_name = inviteeName;
      const res = await api.onboarding.manualCreate({ email: email.trim(), data });
      setNotice({ type: 'created', email: res.email, password: res.tempPassword });
      resetForm(); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const handleLink = async (e) => {
    e.preventDefault(); setError(''); setNotice(null); setBusy(true);
    try {
      const fields = Object.keys(selected).filter(k => selected[k]);
      const res = await api.onboarding.createInvite({ email: email.trim(), inviteeName: inviteeName.trim(), fields, sendEmail: alsoEmail });
      setNotice({ type: 'invite', link: res.inviteLink, emailed: res.emailed, preview: res.previewUrl });
      resetForm(); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const handleApprove = async (inv) => {
    setError(''); setNotice(null);
    try { const res = await api.onboarding.approve(inv.id); setNotice({ type: 'created', email: res.email, password: res.tempPassword }); await load(); }
    catch (err) { setError(err.message); }
  };
  const handleReject = async (inv) => {
    const reason = window.prompt('Reason for rejection (optional):') ?? '';
    try { await api.onboarding.reject(inv.id, reason); await load(); } catch (err) { setError(err.message); }
  };
  const toggleVendor = async (v) => {
    const nextOnline = !(v.online === 1);
    setVendors(prev => prev.map(x => x.id === v.id ? { ...x, online: nextOnline ? 1 : 0 } : x));
    try { await api.updateStallStatus(v.id, { online: nextOnline ? 1 : 0 }); } catch (err) { setError(err.message); load(); }
  };

  const [deletingId, setDeletingId] = useState(null);
  const [vendorToDelete, setVendorToDelete] = useState(null);

  const handleDeleteVendor = (v) => {
    setVendorToDelete(v);
  };

  const confirmDeleteVendor = async (v) => {
    if (!v || !v.id) return;
    setDeletingId(v.id);
    setError('');
    setNotice(null);

    try {
      await api.deleteVendor(v.id);
      setVendors(prev => prev.filter(x => x.id !== v.id));
      if (editingId === v.id) setEditingId(null);
      setNotice({ type: 'deleted', name: v.name });
      setVendorToDelete(null);
    } catch (err) {
      setError(err.message || 'Failed to delete vendor from database.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── edit an existing vendor (FSSAI + bank + details) ──
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editBusy, setEditBusy] = useState(false);

  const BANK_KEYS = ['account_holder', 'account_number', 'ifsc', 'upi_id'];

  const openEdit = async (v) => {
    setError(''); setNotice(null); setEditingId(v.id);
    setEditData({ name: v.name, category: v.category, email: v.email || v.contact_email || '' });
    try {
      const { data } = await supabase.from('vendors')
        .select('business_name, fssai, contact_email, details, account_holder, ifsc, upi_id, account_last4, payout_status')
        .eq('stall_id', v.id).maybeSingle();
      setEditData({
        name: data?.business_name || v.name,
        category: v.category,
        email: data?.contact_email || v.contact_email || v.email || '',
        fssai: data?.fssai || '',
        account_holder: data?.account_holder || '',
        ifsc: data?.ifsc || '',
        upi_id: data?.upi_id || '',
        account_number: '', // never prefilled; encrypted at rest
        _last4: data?.account_last4 || '',
        _payoutStatus: data?.payout_status || 'pending',
        ...(data?.details || {})
      });
    } catch (_e) {}
  };

  const saveEdit = async (id) => {
    setEditBusy(true); setError('');
    try {
      const { name, category, email: vendorEmail, fssai, _last4, _payoutStatus, ...rest } = editData;
      // Bank fields go through the server (encrypted + payout registration).
      const bank = {};
      for (const k of BANK_KEYS) { if (rest[k] !== undefined) bank[k] = rest[k]; delete rest[k]; }

      await supabase.from('stalls').update({ name, category, updated_at: new Date().toISOString() }).eq('id', id);
      const { error: vErr } = await supabase.from('vendors').upsert({
        stall_id: id,
        business_name: name,
        contact_email: vendorEmail ? vendorEmail.trim().toLowerCase() : null,
        fssai: fssai || null,
        details: rest,
        updated_at: new Date().toISOString()
      }, { onConflict: 'stall_id' });
      if (vErr) throw new Error(vErr.message);

      // Only call payout endpoint if bank info was entered/changed.
      if (bank.account_number || bank.upi_id || bank.account_holder || bank.ifsc) {
        await api.onboarding.savePayout({ stallId: id, ...bank, name });
      }

      setEditingId(null); setNotice({ type: 'saved' }); await load();
    } catch (err) { setError(err.message); } finally { setEditBusy(false); }
  };

  // ── styles ──
  const box = { 
    background: '#FFFFFF', 
    border: '1px solid #E2E8F0', 
    borderRadius: 18, 
    padding: 22, 
    boxShadow: '0 8px 30px -5px rgba(15, 23, 42, 0.04)' 
  };

  const input = { 
    width: '100%', 
    padding: '9px 13px', 
    borderRadius: 10, 
    border: '1px solid #E2E8F0', 
    fontSize: '0.82rem', 
    fontWeight: 600,
    boxSizing: 'border-box', 
    outline: 'none', 
    background: '#F8FAFC', 
    color: '#0F172A',
    transition: 'all 0.2s ease' 
  };

  const btn = (bg, fg, border) => ({ 
    background: bg, 
    color: fg, 
    border: border || 'none', 
    borderRadius: 999, 
    padding: '8px 16px', 
    cursor: 'pointer', 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: 6, 
    fontSize: '0.82rem', 
    fontWeight: 700, 
    transition: 'all 0.2s ease', 
    boxShadow: bg === '#FF3B00' ? '0 4px 14px rgba(255, 59, 0, 0.25)' : 'none' 
  });

  const tabBtn = (active) => ({ 
    padding: '9px 18px', 
    borderRadius: 999, 
    border: active ? '1px solid #FF3B00' : '1px solid #E2E8F0', 
    cursor: 'pointer', 
    fontSize: '0.82rem', 
    fontWeight: 800, 
    background: active ? '#FF3B00' : '#FFFFFF', 
    color: active ? '#FFFFFF' : '#64748B', 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: 7, 
    transition: 'all 0.2s ease', 
    boxShadow: active ? '0 4px 16px rgba(255, 59, 0, 0.25)' : '0 2px 4px rgba(0,0,0,0.02)' 
  });

  const subBtn = (active) => ({ 
    padding: '9px 18px', 
    borderRadius: 999, 
    border: active ? '1px solid #FF3B00' : '1px solid #E2E8F0', 
    cursor: 'pointer', 
    fontSize: '0.82rem', 
    fontWeight: 800, 
    background: active ? '#FFF5F3' : '#FFFFFF', 
    color: active ? '#FF3B00' : '#64748B', 
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    transition: 'all 0.2s ease',
    boxShadow: active ? '0 4px 12px rgba(255, 59, 0, 0.1)' : 'none'
  });

  const primaryActionBtn = {
    padding: '11px 22px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #FF3B00 0%, #E4002B 100%)',
    color: '#FFFFFF',
    fontSize: '0.85rem',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 6px 20px rgba(255, 59, 0, 0.25)',
    transition: 'all 0.2s ease'
  };

  const iconBtn = { width: 34, height: 34, borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' };
  const iconBtnSuccess = { width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' };
  const iconBtnDanger = { width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' };

  const emailNameRow = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
      <div>
        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: 6 }}>Vendor Email Address *</label>
        <input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@smartbite.in" />
      </div>
      <div>
        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: 6 }}>Owner / Contact Name (Optional)</label>
        <input style={input} value={inviteeName} onChange={e => setInviteeName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 4 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Vendors Management & Onboarding</h2>

      {/* Top tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabBtn(tab === 'existing')} onClick={() => setTab('existing')}><Store size={18} /> Existing Vendors ({vendors.length})</button>
        <button style={tabBtn(tab === 'add')} onClick={() => setTab('add')}><UserPlus size={18} /> Add New Vendor</button>
        <button style={tabBtn(tab === 'pending')} onClick={() => setTab('pending')}><Check size={18} /> Pending Approvals{pending.length ? ` (${pending.length})` : ''}</button>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: '0.9rem', fontWeight: 700 }}>{error}</div>}
      {notice?.type === 'saved' && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: '0.9rem', fontWeight: 700 }}>Vendor details saved successfully.</div>
      )}
      {notice?.type === 'created' && (
        <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#3730A3', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: '0.9rem' }}>
          Vendor account initialized for <b>{notice.email}</b>. Temp password: <code style={{ background: '#FFFFFF', padding: '4px 8px', borderRadius: 8, border: '1px solid #A5B4FC', fontWeight: 800, fontFamily: 'monospace' }}>{notice.password}</code> — share this credential with the vendor.
        </div>
      )}
      {notice?.type === 'invite' && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: '0.9rem' }}>
          Invite link generated{notice.emailed ? ' and sent via email' : ''}. Share link with vendor:{' '}
          <button onClick={() => copy(notice.link, 'notice')} style={{ ...btn('#065F46', '#FFFFFF'), marginLeft: 8, padding: '6px 14px', fontSize: '0.8rem' }}><Copy size={14} /> {copiedId === 'notice' ? 'Copied!' : 'Copy Link'}</button>
          <div style={{ fontSize: '0.82rem', marginTop: 8, wordBreak: 'break-all' }}><code>{notice.link}</code></div>
        </div>
      )}
      {notice?.type === 'deleted' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '14px 18px', borderRadius: 14, marginBottom: 20, fontSize: '0.9rem', fontWeight: 700 }}>
          ✓ Vendor "{notice.name}" has been permanently deleted from the database and dashboard.
        </div>
      )}

      {/* ── TAB: existing vendors ── */}
      {tab === 'existing' && (
        <div style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>Registered Campus Stalls</h3>
            <button onClick={load} style={btn('#FFFFFF', '#334155', '1px solid #E2E8F0')}><RefreshCw size={14} /> Refresh Catalog</button>
          </div>
          {loading ? <p style={{ color: '#64748B', fontSize: 14 }}>Loading vendors list…</p> : (vendors.length === 0 ? <p style={{ color: '#64748B', fontSize: 14 }}>No vendors onboarded yet.</p> : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {vendors
                .filter(v => !getDeletedStallIds().includes(String(v.id)))
                .map(v => (
                <div key={v.id} style={{ border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', background: '#FFFFFF', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #FFF5F3, #FFEBE6)', border: '1px solid #FFD0C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#FF3B00' }}>{v.logo || <Store size={22} />}</div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0F172A' }}>{v.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>{v.category}</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: v.online === 1 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: v.online === 1 ? '#059669' : '#DC2626', border: v.online === 1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 14px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.online === 1 ? '#10B981' : '#EF4444' }} />
                      {v.online === 1 ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <button onClick={() => (editingId === v.id ? setEditingId(null) : openEdit(v))} title={editingId === v.id ? 'Close editor' : 'Edit vendor details'} style={iconBtn}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => toggleVendor(v)} title={v.online === 1 ? 'Take offline' : 'Bring online'} style={v.online === 1 ? iconBtnDanger : iconBtnSuccess}>
                      <Power size={16} />
                    </button>
                    <button onClick={() => handleDeleteVendor(v)} disabled={deletingId === v.id} title={`Delete ${v.name} permanently`} style={iconBtnDanger}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {editingId === v.id && (
                    <div style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC', padding: 18 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                        <div><label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Stall Name</label><input style={input} value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} /></div>
                        <div><label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Category</label><input style={input} value={editData.category || ''} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))} /></div>
                        <div><label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Vendor Email (Login Account)</label><input type="email" style={input} value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} placeholder="vendor@sgu.edu.in" /></div>
                        <div><label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>FSSAI License No.</label><input style={input} value={editData.fssai || ''} onChange={e => setEditData(d => ({ ...d, fssai: e.target.value }))} placeholder="FSSAI number" /></div>
                        {catalog.filter(f => f.key !== 'business_name' && f.key !== 'fssai' && f.key !== 'category').map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{f.label}</label>
                            <input
                              style={input}
                              value={editData[f.key] || ''}
                              onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                              placeholder={f.key === 'account_number' && editData._last4 ? `•••• ${editData._last4} — enter to change` : f.label}
                            />
                          </div>
                        ))}
                      </div>
                      {editData._last4 && (
                        <div style={{ fontSize: 13, color: '#64748B', marginTop: 10, fontWeight: 600 }}>
                          Payout: •••• {editData._last4} · Status <b style={{ color: editData._payoutStatus === 'registered' ? '#059669' : editData._payoutStatus === 'failed' ? '#B91C1C' : '#B45309' }}>{editData._payoutStatus}</b>
                        </div>
                      )}

                      {/* Reset System Password via Supabase */}
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed #CBD5E1', background: '#FFFFFF', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <KeyRound size={16} color="#DC2626" /> Reset Vendor Password (Supabase Verified)
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 12px 0' }}>
                          Set a new password for this vendor. The updated password is saved directly to the Supabase database & Auth, and verified live when logging into the Vendor Dashboard (no email links needed).
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          <div style={{ position: 'relative', flex: '1 1 240px' }}>
                            <input
                              type={showPasswords[v.id] ? 'text' : 'password'}
                              style={{ ...input, paddingRight: 40 }}
                              placeholder="Enter new system password (min 6 chars)"
                              value={passwords[v.id] || ''}
                              onChange={e => setPasswords(prev => ({ ...prev, [v.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswords(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                            >
                              {showPasswords[v.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleResetPassword(v)}
                            disabled={resetLoading[v.id]}
                            style={btn('#DC2626', '#FFFFFF')}
                          >
                            <ShieldCheck size={15} /> {resetLoading[v.id] ? 'Updating Supabase…' : 'Reset Password via Supabase'}
                          </button>
                        </div>

                        {passwordNotices[v.id] && (
                          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: passwordNotices[v.id].type === 'error' ? '#FEF2F2' : '#F0FDF4', border: passwordNotices[v.id].type === 'error' ? '1px solid #FECACA' : '1px solid #BBF7D0', color: passwordNotices[v.id].type === 'error' ? '#991B1B' : '#166534', fontSize: '0.82rem', fontWeight: 600 }}>
                            {passwordNotices[v.id].msg}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button onClick={() => saveEdit(v.id)} disabled={editBusy} style={btn('#059669', '#FFFFFF')}><Save size={15} /> {editBusy ? 'Saving…' : 'Save Details'}</button>
                        <button onClick={() => setEditingId(null)} style={btn('#FFFFFF', '#334155', '1px solid #E2E8F0')}><X size={15} /> Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: add new vendor (sub-tabs) ── */}
      {tab === 'add' && (
        <div style={box}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
            <button style={subBtn(subTab === 'manual')} onClick={() => setSubTab('manual')}>
              <UserPlus size={16} /> Manual Onboarding
            </button>
            <button style={subBtn(subTab === 'link')} onClick={() => setSubTab('link')}>
              <Link2 size={16} /> Send Registration Link
            </button>
          </div>

          {/* Manual: admin fills everything, account created immediately */}
          {subTab === 'manual' && (
            <form onSubmit={handleManual}>
              <p style={{ color: '#64748B', fontSize: '0.88rem', fontWeight: 600, marginTop: 0, marginBottom: 20 }}>
                Directly register vendor details (Name, Contact, Bank Details, FSSAI, PAN). Account is created immediately and temporary credentials are generated.
              </p>

              {emailNameRow}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
                {Object.keys(grouped).map(group => (
                  <div key={group} style={{ background: '#F8FAFC', borderRadius: 16, padding: 18, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3B00' }} />
                      {GROUP_LABELS[group] || group}
                    </div>
                    {grouped[group].map(f => (
                      <div key={f.key} style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>{f.label}</label>
                        <input style={input} value={manualData[f.key] || ''} onChange={e => setManualData(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.label} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24 }}>
                <button type="submit" disabled={busy} style={primaryActionBtn}>
                  <UserPlus size={18} /> {busy ? 'Registering Vendor…' : 'Register Vendor Account'}
                </button>
              </div>
            </form>
          )}

          {/* Send link: pick fields, generate link, optional email */}
          {subTab === 'link' && (
            <form onSubmit={handleLink}>
              <p style={{ color: '#64748B', fontSize: '0.88rem', fontWeight: 600, marginTop: 0, marginBottom: 20 }}>
                Generate a self-service onboarding link for the vendor to fill out their own Bank, KYC, and Stall details.
              </p>

              {emailNameRow}

              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
                Fields to collect from Vendor (Email is mandatory):
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {Object.keys(grouped).map(group => (
                  <div key={group} style={{ background: '#F8FAFC', borderRadius: 16, padding: 18, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                      {GROUP_LABELS[group] || group}
                    </div>
                    {grouped[group].map(f => (
                      <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', fontWeight: 600, color: '#334155', padding: '6px 0', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!selected[f.key]} onChange={() => setSelected(prev => ({ ...prev, [f.key]: !prev[f.key] }))} style={{ width: 16, height: 16, accentColor: '#FF3B00' }} /> {f.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginTop: 20, cursor: 'pointer' }}>
                <input type="checkbox" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#FF3B00' }} />
                Send invitation link via Email
              </label>

              <div style={{ marginTop: 20 }}>
                <button type="submit" disabled={busy} style={primaryActionBtn}>
                  <Link2 size={16} /> {busy ? 'Generating Link…' : 'Generate & Send Registration Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── TAB: pending approvals ── */}
      {tab === 'pending' && (
        <div style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Awaiting approval</h3>
            <button onClick={load} style={btn('#fff', '#334155', '1px solid #e2e8f0')}><RefreshCw size={14} /> Refresh</button>
          </div>
          {pending.length === 0 ? <p style={{ color: '#64748b' }}>Nothing awaiting approval.</p> : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(inv => (
                <div key={inv.id} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600 }}>{inv.contact_email}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{Object.entries(inv.submitted_data || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'no data'}</div>
                  </div>
                  <button onClick={() => handleApprove(inv)} style={btn('#059669', '#fff')}><Check size={14} /> Approve &amp; create</button>
                  <button onClick={() => handleReject(inv)} style={btn('#fff', '#b91c1c', '1px solid #fecaca')}><X size={14} /> Reject</button>
                </div>
              ))}
            </div>
          )}
          {/* also show sent/invited links awaiting submission */}
          {invites.filter(i => i.status === 'sent').length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ margin: '0 0 8px', color: '#64748b' }}>Invited (link not submitted yet)</h4>
              {invites.filter(i => i.status === 'sent').map(inv => (
                <div key={inv.id} style={{ border: '1px solid #eef0f3', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>{inv.contact_email}</div>
                  <button onClick={() => copy(linkFor(inv.token), inv.id)} style={btn('#fff', '#334155', '1px solid #e2e8f0')}><Copy size={13} /> {copiedId === inv.id ? 'Copied!' : 'Copy link'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Centered Custom Warning Modal for Vendor Deletion */}
      {vendorToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#1E1A29',
            color: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px 32px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            textAlign: 'left',
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif"
          }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '14px', letterSpacing: '0.01em' }}>
              {window.location.host || 'smart-bite-rosy.vercel.app'} says
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '16px', lineHeight: '1.4' }}>
              <span style={{ fontSize: '1.2rem', marginTop: '1px' }}>⚠️</span>
              <span>WARNING: Do you really want to delete the vendor "{vendorToDelete.name}"?</span>
            </div>

            <p style={{ color: '#94A3B8', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 26px 0' }}>
              This will permanently delete the vendor, stall, and login accounts from the database and dashboard.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => confirmDeleteVendor(vendorToDelete)}
                disabled={deletingId === vendorToDelete.id}
                style={{
                  background: '#E9D5FF',
                  color: '#3B0764',
                  border: '2px solid #D8B4FE',
                  borderRadius: '999px',
                  padding: '10px 28px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(216, 180, 254, 0.4)',
                  transition: 'all 0.2s ease',
                  opacity: deletingId === vendorToDelete.id ? 0.7 : 1
                }}
              >
                {deletingId === vendorToDelete.id ? 'Deleting…' : 'OK'}
              </button>

              <button
                type="button"
                onClick={() => setVendorToDelete(null)}
                disabled={deletingId === vendorToDelete.id}
                style={{
                  background: '#4C3B6E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '10px 24px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingModule;
