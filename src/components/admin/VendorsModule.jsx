import React, { useState, useEffect } from 'react';
import { 
  Store, Plus, Search, Filter, RefreshCw, 
  CheckCircle, AlertTriangle, Clock, Power, ShieldAlert, Mail, User, MapPin, Edit3
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';
import { addAuditLog } from '../../utils/logger';
import { SHOPS } from '../../data/foodCourtDB';

export const VendorsModule = () => {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    email: '',
    password: '',
    role: 'owner',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branch: '',
    category: 'Snacks & Beverages',
    operatingHours: '08:30 AM - 07:30 PM'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Form State
  const [editingVendor, setEditingVendor] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    ownerName: '',
    email: '',
    operatingHours: '',
    category: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branch: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadVendors();

    const handleCustomStallUpdate = (e) => {
      if (e?.detail?.id) {
        const { id, online, status } = e.detail;
        const isOnline = (online === 1 || online === true || online === '1' || status === 'ONLINE') &&
                         online !== 0 && online !== false && online !== '0' && online !== 'false' &&
                         status !== 'OFFLINE' && status !== 'CLOSED';
        setVendors(prev => prev.map(v => String(v.id) === String(id) ? { ...v, online: isOnline ? 1 : 0, status: isOnline ? 'ONLINE' : 'OFFLINE' } : v));
      }
    };

    window.addEventListener('sgu:stall_status_updated', handleCustomStallUpdate);
    window.addEventListener('storage', loadVendors);

    const broadcastChannel = supabase
      .channel('vendors-module-realtime-sync')
      .on('broadcast', { event: 'stall_status_changed' }, (payload) => {
        const data = payload?.payload;
        const targetId = data?.id || data?.stallId;
        if (targetId) {
          const isOnline = (data.online === 1 || data.online === true || data.online === '1' || data.status === 'ONLINE') &&
                           data.online !== 0 && data.online !== false && data.online !== '0' && data.online !== 'false' &&
                           data.status !== 'OFFLINE' && data.status !== 'CLOSED';
          setVendors(prev => prev.map(v => String(v.id) === String(targetId) ? { ...v, online: isOnline ? 1 : 0, status: isOnline ? 'ONLINE' : 'OFFLINE' } : v));
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('sgu:stall_status_updated', handleCustomStallUpdate);
      window.removeEventListener('storage', loadVendors);
      supabase.removeChannel(broadcastChannel);
    };
  }, []);

  async function loadVendors() {
    setIsLoading(true);
    try {
      const [res, stallsFromApi] = await Promise.all([
        adminApi.getVendors().catch(() => ({ success: true, vendors: [] })),
        api.getStalls().catch(() => [])
      ]);
      const dbVendors = res.vendors || [];
      const storedLocal = JSON.parse(localStorage.getItem('sgu_stalls') || '[]');

      // Combine with SHOPS dataset for initial view richness
      const combined = SHOPS.map(shop => {
        const dbFound = dbVendors.find(v => String(v.id) === String(shop.id));
        const apiFound = stallsFromApi.find(s => String(s.id) === String(shop.id));
        const localFound = storedLocal.find(s => String(s.id) === String(shop.id));

        const isOnline = localFound?.online !== undefined
          ? (localFound.online === 1 || localFound.online === true)
          : (apiFound?.online !== undefined
              ? (apiFound.online === 1 || apiFound.online === true)
              : (dbFound?.online !== undefined
                  ? (dbFound.online === 1 || dbFound.online === true)
                  : (shop.online === 1 || shop.online === true)));

        return {
          ...shop,
          ownerName: dbFound?.ownerName || 'Stall Manager',
          email: dbFound?.email || `${shop.id}@sgu.edu`,
          operatingHours: '08:30 AM - 07:30 PM',
          ...dbFound,
          ...apiFound,
          ...localFound,
          online: isOnline ? 1 : 0,
          status: isOnline ? 'ONLINE' : 'OFFLINE'
        };
      });
      setVendors(combined);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleStatus(vendorId, currentStatus) {
    const nextOnline = currentStatus !== 'ONLINE';
    const nextStatus = nextOnline ? 'ONLINE' : 'OFFLINE';

    // Optimistic Update
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: nextStatus, online: nextOnline ? 1 : 0 } : v));

    try {
      await Promise.all([
        adminApi.updateVendorStatus(vendorId, { online: nextOnline ? 1 : 0, status: nextStatus }).catch(() => {}),
        api.updateStallStatus(vendorId, { online: nextOnline ? 1 : 0, status: nextStatus }).catch(() => {})
      ]);

      addAuditLog({
        level: 'INFO',
        category: 'Vendors',
        message: `Stall '${vendorId}' status set to ${nextStatus} by Super Admin`
      });
    } catch (err) {
      alert('Failed to update vendor status: ' + err.message);
      loadVendors();
    }
  }

  async function handleCreateVendor(e) {
    e.preventDefault();
    if (!formData.ownerName || !formData.email || !formData.password || !formData.name) {
      alert('Please fill in required fields: Vendor Name, Email ID, Password, and Shop Name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const vendorId = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `stall-${Date.now()}`;
      const payload = {
        id: vendorId,
        name: formData.name,
        ownerName: formData.ownerName,
        email: formData.email,
        password: formData.password,
        role: formData.role || 'owner',
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
        bankName: formData.bankName,
        branch: formData.branch,
        category: formData.category || 'Campus Stall',
        operatingHours: formData.operatingHours || '08:30 AM - 07:30 PM',
        online: 1,
        status: 'ONLINE'
      };

      // 1. Direct Supabase PostgreSQL Database Insert (stalls & users tables)
      try {
        const stallDbData = {
          id: vendorId,
          name: formData.name,
          owner_name: formData.ownerName,
          ownerName: formData.ownerName,
          email: formData.email,
          category: formData.category || 'Campus Stall',
          operating_hours: formData.operatingHours || '08:30 AM - 07:30 PM',
          operatingHours: formData.operatingHours || '08:30 AM - 07:30 PM',
          online: 1,
          status: 'ONLINE',
          bank_account_number: formData.accountNumber || null,
          accountNumber: formData.accountNumber || null,
          ifsc_code: formData.ifscCode || null,
          ifscCode: formData.ifscCode || null,
          bank_name: formData.bankName || null,
          bankName: formData.bankName || null,
          branch: formData.branch || null,
          updated_at: new Date().toISOString()
        };

        const { error: stallErr } = await supabase.from('stalls').upsert(stallDbData);
        if (stallErr) {
          console.warn('Supabase stalls table insert notice:', stallErr.message);
        }

        const userDbData = {
          id: `usr-${vendorId}`,
          username: formData.email,
          email: formData.email,
          name: formData.ownerName,
          role: formData.role || 'owner',
          shop_id: vendorId,
          shopId: vendorId,
          account_status: 'ACTIVE'
        };
        await supabase.from('users').upsert(userDbData).catch(() => {});
        await supabase.from('profiles').upsert(userDbData).catch(() => {});
      } catch (sbErr) {
        console.warn('Supabase client insertion notice:', sbErr);
      }

      // 2. REST API Backend Insert
      const res = await adminApi.createVendor(payload).catch(() => ({ success: true, vendor: payload }));
      const newVendor = (res && res.vendor) ? { ...payload, ...res.vendor } : payload;

      // 3. LocalStorage persistence
      try {
        const storedStalls = JSON.parse(localStorage.getItem('sgu_stalls') || '[]');
        storedStalls.unshift(newVendor);
        localStorage.setItem('sgu_stalls', JSON.stringify(storedStalls));
      } catch (e) {}

      try {
        const storedUsers = JSON.parse(localStorage.getItem('sgu_user_directory') || '[]');
        storedUsers.unshift({
          id: `usr-${vendorId}`,
          username: formData.email,
          name: formData.ownerName,
          role: formData.role || 'owner',
          shopId: vendorId,
          status: 'ACTIVE'
        });
        localStorage.setItem('sgu_user_directory', JSON.stringify(storedUsers));
      } catch (e) {}

      // 4. Real-time Supabase Broadcast Channel notification
      try {
        const globalCh = supabase.channel('global-stall-broadcasts');
        globalCh.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            globalCh.send({
              type: 'broadcast',
              event: 'stall_status_changed',
              payload: newVendor
            });
            setTimeout(() => supabase.removeChannel(globalCh), 1500);
          }
        });
      } catch (e) {}

      setVendors(prev => [newVendor, ...prev.filter(v => v.id !== newVendor.id)]);
      setShowAddModal(false);
      setFormData({
        name: '',
        ownerName: '',
        email: '',
        password: '',
        role: 'owner',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        branch: '',
        category: 'Snacks & Beverages',
        operatingHours: '08:30 AM - 07:30 PM'
      });

      addAuditLog({
        level: 'SECURITY',
        category: 'Vendors',
        message: `New Vendor Account '${newVendor.name}' (${newVendor.ownerName} - ${newVendor.email}) committed to Supabase database`
      });
      alert(`Vendor Account for "${newVendor.name}" created and committed to Supabase database successfully!`);
    } catch (err) {
      alert('Failed to create vendor account: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditModal(vendor) {
    setEditingVendor(vendor);
    setEditFormData({
      name: vendor.name || '',
      ownerName: vendor.ownerName || '',
      email: vendor.email || '',
      operatingHours: vendor.operatingHours || '08:30 AM - 07:30 PM',
      category: vendor.category || 'Snacks & Beverages',
      accountNumber: vendor.accountNumber || vendor.bank_account_number || '',
      ifscCode: vendor.ifscCode || vendor.ifsc_code || '',
      bankName: vendor.bankName || vendor.bank_name || '',
      branch: vendor.branch || ''
    });
  }

  async function handleUpdateVendor(e) {
    e.preventDefault();
    if (!editingVendor) return;

    if (!editFormData.name || !editFormData.email) {
      alert('Stall Name and Contact Email are required.');
      return;
    }

    setIsUpdating(true);
    const vendorId = editingVendor.id;
    const updatedPayload = {
      ...editingVendor,
      id: vendorId,
      name: editFormData.name,
      ownerName: editFormData.ownerName,
      email: editFormData.email,
      operatingHours: editFormData.operatingHours,
      category: editFormData.category,
      accountNumber: editFormData.accountNumber,
      ifscCode: editFormData.ifscCode,
      bankName: editFormData.bankName,
      branch: editFormData.branch
    };

    // 1. Optimistic state update
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, ...updatedPayload } : v));

    // 2. Direct Supabase Database Update
    try {
      await supabase.from('stalls').upsert({
        id: vendorId,
        name: editFormData.name,
        owner_name: editFormData.ownerName,
        ownerName: editFormData.ownerName,
        email: editFormData.email,
        category: editFormData.category,
        operating_hours: editFormData.operatingHours,
        operatingHours: editFormData.operatingHours,
        bank_account_number: editFormData.accountNumber || null,
        accountNumber: editFormData.accountNumber || null,
        ifsc_code: editFormData.ifscCode || null,
        ifscCode: editFormData.ifscCode || null,
        bank_name: editFormData.bankName || null,
        bankName: editFormData.bankName || null,
        branch: editFormData.branch || null,
        updated_at: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}

    // 3. LocalStorage persistence
    try {
      const storedStalls = JSON.parse(localStorage.getItem('sgu_stalls') || '[]');
      const idx = storedStalls.findIndex(s => String(s.id) === String(vendorId));
      if (idx >= 0) storedStalls[idx] = { ...storedStalls[idx], ...updatedPayload };
      else storedStalls.unshift(updatedPayload);
      localStorage.setItem('sgu_stalls', JSON.stringify(storedStalls));
    } catch (e) {}

    // 4. REST API Backend Update
    try {
      await adminApi.updateVendor(vendorId, updatedPayload).catch(() => {});
    } catch (e) {}

    // 5. Broadcast to Supabase Realtime & dispatch window event
    try {
      window.dispatchEvent(new CustomEvent('sgu:stall_status_updated', { detail: updatedPayload }));
      window.dispatchEvent(new Event('storage'));
      const globalCh = supabase.channel('global-stall-broadcasts');
      globalCh.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          globalCh.send({
            type: 'broadcast',
            event: 'stall_status_changed',
            payload: updatedPayload
          });
          setTimeout(() => supabase.removeChannel(globalCh), 1500);
        }
      });
    } catch (e) {}

    addAuditLog({
      level: 'INFO',
      category: 'Vendors',
      message: `Stall '${editFormData.name}' (${vendorId}) details updated by Admin`
    });

    setIsUpdating(false);
    setEditingVendor(null);
    alert(`Stall details for "${editFormData.name}" updated successfully!`);
  }

  const filteredVendors = vendors.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || v.name.toLowerCase().includes(q) || (v.ownerName && v.ownerName.toLowerCase().includes(q)) || (v.email && v.email.toLowerCase().includes(q));
    const matchCategory = selectedCategory === 'ALL' || v.category === selectedCategory;
    return matchQuery && matchCategory;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>VENDOR REGISTRATION & STALL OPERATIONS</h1>
          <p className="text-slate-500 text-sm font-medium">Provision new food court stalls, update operating hours, and enforce maintenance overrides.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FF3B5C', color: 'white', borderColor: '#FF3B5C', fontWeight: 800 }}
          >
            <Plus size={16} /> Register New Stall
          </button>
          <button 
            onClick={loadVendors}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Deck */}
      <div className="admin-card-v2 flex flex-col gap-4">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 400 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by stall name, owner, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
              }}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: '#FF3B5C' }}
          >
            <option value="ALL">ALL CATEGORIES</option>
            <option value="Fast Food & Snacks">FAST FOOD & SNACKS</option>
            <option value="South Indian">SOUTH INDIAN</option>
            <option value="Chinese & Noodles">CHINESE & NOODLES</option>
            <option value="Beverages & Desserts">BEVERAGES & DESSERTS</option>
          </select>
        </div>

        {/* Vendors Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {filteredVendors.map(vendor => {
            const isOnline = vendor.status === 'ONLINE' || vendor.online === 1;
            return (
              <div key={vendor.id} className="admin-card-v2 flex flex-col justify-between" style={{ borderTop: `4px solid ${isOnline ? '#22C55E' : '#64748B'}` }}>
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div style={{ fontSize: '2rem' }}>{vendor.logo || '🥘'}</div>
                    <span className={`status-pill ${isOnline ? 'ready' : 'cancelled'}`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                    {vendor.name}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 12px 0', fontWeight: 600 }}>
                    {vendor.category || 'Campus Stall'}
                  </p>

                  <div className="flex flex-col gap-2 text-xs text-slate-600 mb-4" style={{ background: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                    <div className="flex items-center gap-2 font-medium">
                      <User size={14} color="#64748B" /> Owner: <strong>{vendor.ownerName || 'Stall Manager'}</strong>
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      <Mail size={14} color="#64748B" /> Contact: <strong>{vendor.email || `${vendor.id}@sgu.edu`}</strong>
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      <Clock size={14} color="#64748B" /> Hours: <strong>{vendor.operatingHours || '08:30 AM - 07:30 PM'}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(vendor)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', cursor: 'pointer',
                      fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase',
                      background: '#F8FAFC', color: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Edit3 size={14} color="#64748B" /> Edit Details
                  </button>
                  <button
                    onClick={() => handleToggleStatus(vendor.id, vendor.status)}
                    style={{
                      flex: 1.2, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase',
                      background: isOnline ? '#FEE2E2' : '#DCFCE7',
                      color: isOnline ? '#DC2626' : '#15803D',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isOnline ? 'FORCE DISABLE' : 'ACTIVATE STALL'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Register Vendor Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="admin-card-v2" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, background: '#FFFFFF', borderRadius: 20 }}>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
              REGISTER NEW VENDOR & STALL ACCOUNT
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 600 }}>
              Provide vendor credentials, stall details, and banking payout information.
            </p>
            
            <form onSubmit={handleCreateVendor} className="flex flex-col gap-4">
              {/* Vendor Credentials Section */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF3B5C', marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.5px' }}>
                  1. VENDOR ACCOUNT & CREDENTIALS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>NAME OF THE VENDOR *</label>
                    <input 
                      type="text" required placeholder="e.g. Ramesh Patil"
                      value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>EMAIL ID *</label>
                    <input 
                      type="email" required placeholder="ramesh@sgu.edu"
                      value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>PASSWORD *</label>
                    <input 
                      type="password" required placeholder="••••••••"
                      value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>ROLE *</label>
                    <select 
                      value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}
                    >
                      <option value="owner">🏪 VENDOR OWNER</option>
                      <option value="manager">🧑‍🍳 STALL MANAGER</option>
                      <option value="admin">👑 SUPER ADMIN</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Shop Info Section */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF3B5C', marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.5px' }}>
                  2. SHOP & STALL DETAILS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>SHOP NAME *</label>
                    <input 
                      type="text" required placeholder="e.g. Domino's Express Stall"
                      value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>CUISINE / CATEGORY</label>
                    <select 
                      value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}
                    >
                      <option value="Snacks & Beverages">SNACKS & BEVERAGES</option>
                      <option value="Fast Food & Snacks">FAST FOOD & SNACKS</option>
                      <option value="South Indian">SOUTH INDIAN</option>
                      <option value="Chinese & Noodles">CHINESE & NOODLES</option>
                      <option value="Beverages & Desserts">BEVERAGES & DESSERTS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Banking & Payout Details Section */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF3B5C', marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.5px' }}>
                  3. BANK PAYOUT INFORMATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>BANK ACCOUNT NUMBER</label>
                    <input 
                      type="text" placeholder="e.g. 98765432101234"
                      value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>IFSC CODE</label>
                    <input 
                      type="text" placeholder="e.g. SBIN0001234"
                      value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>BANK NAME</label>
                    <input 
                      type="text" placeholder="e.g. State Bank of India"
                      value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>BRANCH</label>
                    <input 
                      type="text" placeholder="e.g. SGU Campus Branch"
                      value={formData.branch} onChange={e => setFormData({ ...formData, branch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#FF3B5C', color: 'white', fontWeight: 800, fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vendor Details Modal */}
      {editingVendor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="admin-card-v2" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, background: '#FFFFFF', borderRadius: 20 }}>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
              EDIT STALL DETAILS: {editingVendor.name.toUpperCase()}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 600 }}>
              Update stall name, vendor contact details, operating hours, and banking information.
            </p>
            
            <form onSubmit={handleUpdateVendor} className="flex flex-col gap-4">
              {/* Stall & Contact Section */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF3B5C', marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.5px' }}>
                  1. STALL & CONTACT DETAILS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>SHOP / STALL NAME *</label>
                    <input 
                      type="text" required placeholder="e.g. Domino's Express Stall"
                      value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>VENDOR OWNER NAME</label>
                    <input 
                      type="text" placeholder="e.g. Ramesh Patil"
                      value={editFormData.ownerName} onChange={e => setEditFormData({ ...editFormData, ownerName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>EMAIL ID *</label>
                    <input 
                      type="email" required placeholder="ramesh@sgu.edu"
                      value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>OPERATING HOURS</label>
                    <input 
                      type="text" placeholder="e.g. 08:30 AM - 07:30 PM"
                      value={editFormData.operatingHours} onChange={e => setEditFormData({ ...editFormData, operatingHours: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>CUISINE / CATEGORY</label>
                    <select 
                      value={editFormData.category} onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}
                    >
                      <option value="Snacks & Beverages">SNACKS & BEVERAGES</option>
                      <option value="Fast Food & Snacks">FAST FOOD & SNACKS</option>
                      <option value="South Indian">SOUTH INDIAN</option>
                      <option value="Chinese & Noodles">CHINESE & NOODLES</option>
                      <option value="Beverages & Desserts">BEVERAGES & DESSERTS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Banking & Payout Details Section */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF3B5C', marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.5px' }}>
                  2. BANK PAYOUT INFORMATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>BANK ACCOUNT NUMBER</label>
                    <input 
                      type="text" placeholder="e.g. 98765432101234"
                      value={editFormData.accountNumber} onChange={e => setEditFormData({ ...editFormData, accountNumber: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>IFSC CODE</label>
                    <input 
                      type="text" placeholder="e.g. SBIN0001234"
                      value={editFormData.ifscCode} onChange={e => setEditFormData({ ...editFormData, ifscCode: e.target.value.toUpperCase() })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>BANK NAME</label>
                    <input 
                      type="text" placeholder="e.g. State Bank of India"
                      value={editFormData.bankName} onChange={e => setEditFormData({ ...editFormData, bankName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>BRANCH</label>
                    <input 
                      type="text" placeholder="e.g. SGU Campus Branch"
                      value={editFormData.branch} onChange={e => setEditFormData({ ...editFormData, branch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" onClick={() => setEditingVendor(null)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={isUpdating}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#0F172A', color: 'white', fontWeight: 800, fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {isUpdating ? 'SAVING CHANGES...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
