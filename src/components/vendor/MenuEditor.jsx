import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, X, Upload, Check, Edit2, Trash2, Camera, Loader2, 
  Clock, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';
import { getFoodItemImage } from '../../utils/imageHelper';
import { useCart } from '../../context/CartContext';

const FloatingInput = ({ label, ...props }) => (
  <div className="floating-label-group">
    <input 
      className="floating-input" 
      placeholder=" "
      {...props} 
    />
    <label className="floating-label">{label}</label>
  </div>
);

export const MenuEditor = ({ shopId }) => {
  const { showToast } = useCart();
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showRequestsDrawer, setShowRequestsDrawer] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Main', img: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const [editingItem, setEditingItem] = useState(null);
  const editFileInputRef = React.useRef(null);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    try {
      const [fetchedItems, fetchedReqs] = await Promise.all([
        api.getStallMenu(shopId),
        api.getVendorMenuRequests(shopId)
      ]);
      setItems(fetchedItems);
      setRequests(fetchedReqs);
    } catch (err) {
      console.error('Failed to load menu data:', err);
    }
  }, [shopId]);

  useEffect(() => {
    loadData();

    if (!shopId) return;

    // Realtime subscription for vendor change requests
    const channel = supabase
      .channel(`vendor-menu-reqs-${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_change_requests', filter: `stall_id=eq.${shopId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const status = payload.new.status;
            if (status === 'APPROVED') {
              showToast('Your menu change request was APPROVED by Admin! 🎉', 'success');
            } else if (status === 'REJECTED') {
              showToast(`Your menu change request was REJECTED: ${payload.new.rejection_reason || 'No reason specified.'}`, 'error');
            }
          }
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, loadData, showToast]);

  const categories = useMemo(() => {
    const list = [...new Set(items.map(item => item.category))];
    if (list.length === 0) return ['Main', 'Sides', 'Beverages', 'Desserts'];
    return list;
  }, [items]);

  const pendingRequestsCount = useMemo(() => {
    return requests.filter(r => r.status === 'PENDING').length;
  }, [requests]);

  // Operational Availability Toggle (INSTANT LIVE UPDATE + AUDIT LOG)
  const handleToggleAvailability = async (item) => {
    const newAvailable = !item.available;
    // Optimistic update
    setItems(items.map(i => i.id === item.id ? { ...i, available: newAvailable ? 1 : 0 } : i));
    try {
      const res = await api.updateMenuAvailability(item.id, newAvailable);
      if (!res.success) throw new Error(res.message);
      showToast(`Item "${item.name}" set ${newAvailable ? 'AVAILABLE 🟢' : 'OUT OF STOCK 🔴'}`, 'info');
    } catch (err) {
      showToast('Failed to toggle availability: ' + err.message, 'error');
      loadData();
    }
  };

  // Structural Add Item (SUBMIT FOR ADMIN APPROVAL)
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;
    try {
      const payload = {
        name: newItem.name,
        price: parseFloat(newItem.price),
        category: newItem.category,
        stock: 20,
        isVeg: 1,
        img: newItem.img || null
      };
      const result = await api.createMenuAddRequest(shopId, payload);
      if (!result?.success) throw new Error(result?.message || 'Request failed');
      
      setNewItem({ name: '', price: '', category: 'Main', img: '' });
      setIsAdding(false);
      setShowRequestsDrawer(true);
      showToast(`Menu addition request for "${newItem.name}" submitted for Admin Approval! ⏳`, 'info');
      await loadData();
    } catch (err) {
      showToast('Failed to submit item request: ' + err.message, 'error');
    }
  };

  // Structural Edit Item (SUBMIT FOR ADMIN APPROVAL)
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const currentItem = items.find(i => i.id === editingItem.id) || editingItem;
      const payload = {
        name: editingItem.name,
        price: parseFloat(editingItem.price),
        category: editingItem.category,
        img: editingItem.img
      };
      const result = await api.createMenuEditRequest(shopId, editingItem.id, currentItem, payload);
      if (!result?.success) throw new Error(result?.message || 'Request failed');

      setEditingItem(null);
      setShowRequestsDrawer(true);
      showToast(`Menu edit request for "${editingItem.name}" submitted for Admin Approval! 📝`, 'info');
      await loadData();
    } catch (err) {
      showToast('Failed to submit edit request: ' + err.message, 'error');
    }
  };

  // Structural Delete / Deactivate Item (SUBMIT FOR ADMIN APPROVAL)
  const handleDeleteRequest = async (item) => {
    if (!window.confirm(`Request Admin approval to deactivate menu item "${item.name}"?`)) return;
    try {
      const result = await api.createMenuDeleteRequest(shopId, item.id, item);
      if (!result?.success) throw new Error(result?.message || 'Request failed');

      setShowRequestsDrawer(true);
      showToast(`Deactivation request for "${item.name}" submitted for Admin Approval! ⏳`, 'info');
      await loadData();
    } catch (err) {
      showToast('Failed to submit deactivation request: ' + err.message, 'error');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await api.uploadMenuImage(shopId, file);
      setNewItem((prev) => ({ ...prev, img: url }));
    } catch (err) {
      showToast('Image upload failed: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await api.uploadMenuImage(shopId, file);
      setEditingItem((prev) => ({ ...prev, img: url }));
    } catch (err) {
      showToast('Image upload failed: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="menu-editor-container space-y-6">
      {/* Header & Drawer Trigger */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
            Active Menu Items ({items.length})
          </span>

          <button
            onClick={() => setShowRequestsDrawer(!showRequestsDrawer)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Clock size={14} className="text-amber-600" />
            <span>Approval Requests ({pendingRequestsCount} Pending)</span>
            {showRequestsDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <motion.button 
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center justify-center gap-2.5 transition-all"
          onClick={() => setIsAdding(!isAdding)}
          style={{ 
            backgroundColor: isAdding ? '#334155' : '#dc2626', 
            color: '#ffffff',
            border: 'none', 
            cursor: 'pointer',
            boxShadow: isAdding ? 'none' : '0 8px 22px rgba(220, 38, 38, 0.4)',
            whiteSpace: 'nowrap',
            height: '44px',
            padding: '0 24px',
            borderRadius: '22px',
            fontSize: '0.875rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}
        >
          {isAdding ? <X size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
          <span>{isAdding ? 'CANCEL' : 'ADD NEW ITEM'}</span>
        </motion.button>
      </div>

      {/* Approval Requests Drawer / Panel */}
      <AnimatePresence>
        {showRequestsDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 mb-6 space-y-4 overflow-hidden"
          >
            <div className="flex justify-between items-center border-b border-amber-200 pb-3">
              <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <Clock size={18} /> Vendor Menu Approval Requests ({requests.length})
              </h3>
              <span className="text-xs text-amber-700 font-medium">Structural edits require Super Admin authorization</span>
            </div>

            {requests.length === 0 ? (
              <p className="text-xs text-amber-800 italic">No change requests submitted yet.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {requests.map(r => (
                  <div key={r.id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          r.requestType === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                          r.requestType === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {r.requestType}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          {r.proposedData?.name || r.currentData?.name || 'Menu Item'}
                        </span>
                        {r.proposedData?.price !== undefined && (
                          <span className="text-xs font-semibold text-slate-600">₹{r.proposedData.price}</span>
                        )}
                      </div>

                      {r.status === 'REJECTED' && r.rejectionReason && (
                        <p className="text-xs text-red-600 font-bold mt-1 bg-red-50 p-2 rounded-lg border border-red-100">
                          Rejection Reason: {r.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {r.status === 'PENDING' && <Clock size={12} />}
                        {r.status === 'APPROVED' && <CheckCircle2 size={12} />}
                        {r.status === 'REJECTED' && <XCircle size={12} />}
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Item Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="elite-card overflow-hidden mb-8 p-6 bg-white rounded-3xl border border-slate-200 shadow-md space-y-4"
            onSubmit={handleAddItem}
          >
            <h3 className="heading-2 form-title text-slate-900 text-lg font-bold">Submit New Item Request</h3>
            <p className="text-xs text-slate-500">Structural menu changes will be submitted to the Admin for approval before appearing live.</p>

            <div className="form-grid grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingInput 
                label="Item Name (e.g. Triple Cheese)"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
              />
              <FloatingInput 
                label="Price (₹)"
                type="number"
                value={newItem.price}
                onChange={(e) => setNewItem({...newItem, price: e.target.value})}
              />
            </div>

            <div className="floating-label-group">
              <select 
                className="floating-input appearance-none bg-white border border-slate-200 p-3 rounded-xl w-full"
                value={newItem.category}
                onChange={(e) => setNewItem({...newItem, category: e.target.value})}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Main">Main</option>
                <option value="Sides">Sides</option>
                <option value="Beverages">Beverages</option>
                <option value="Desserts">Desserts</option>
              </select>
              <label className="floating-label">Category</label>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <div 
              className={`drop-zone border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors ${isUploading ? 'shimmer' : ''}`}
              onClick={() => fileInputRef.current.click()}
            >
              {newItem.img ? (
                <img src={newItem.img} className="preview-image max-h-40 mx-auto rounded-xl object-cover" alt="Preview" />
              ) : isUploading ? (
                <Loader2 size={40} className="upload-spinner animate-spin mx-auto text-indigo-500" />
              ) : (
                <>
                  <div className="upload-icon-wrapper w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Camera size={20} />
                  </div>
                  <p className="upload-text text-xs font-bold text-slate-700">Upload Photo</p>
                  <p className="upload-hint text-[10px] text-slate-400">TAP TO BROWSE</p>
                </>
              )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="btn-publish-menu w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all border-none cursor-pointer"
            >
              Submit Item for Admin Approval
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Menu Categories & Cards */}
      <div className="menu-sections flex flex-col gap-8 mt-6">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0 && !isAdding) return null;
          
          return (
            <div key={cat} className="category-section">
              <div className="category-header flex items-center gap-3 mb-4">
                <h3 className="heading-2 category-title text-xl font-bold text-slate-900">{cat}</h3>
                <div className="title-separator flex-1 h-px bg-slate-200" />
                <span className="item-count text-xs font-bold text-slate-400">{catItems.length} Items</span>
              </div>
              
              <div className="items-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catItems.map((item, index) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={item.id} 
                    className="menu-item-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 group"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img src={getFoodItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
                        <div 
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                          onClick={() => setEditingItem({...item})}
                        >
                          <Edit2 size={18} />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="item-name text-base font-bold text-slate-900 truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">{item.category}</span>
                          <span className="text-base font-black text-slate-900">₹{item.price}</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Quick Toggle & Delete Action */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      {/* Operational Quick Toggle (Available / Out of Stock) */}
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                          item.available 
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                        title="Operational Toggle: Instant Live Update + Audit Log"
                      >
                        <span className={`w-2 h-2 rounded-full ${item.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {item.available ? 'In Stock 🟢' : 'Out of Stock 🔴'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingItem({...item})}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border-none cursor-pointer"
                          title="Request Structural Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border-none cursor-pointer"
                          onClick={() => handleDeleteRequest(item)}
                          title="Request Item Deactivation"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Structural Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full flex flex-col overflow-hidden"
              style={{ height: '85vh', minHeight: '500px', maxHeight: '800px' }}
            >
              {/* Modal Header */}
              <div 
                className="flex justify-between items-center shrink-0"
                style={{ 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                  padding: '24px 32px', 
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <div>
                  <h2 className="text-xl font-bold text-slate-800 m-0">Edit Item Request</h2>
                  <p className="text-xs text-slate-400">Edits will be submitted to Admin for approval before publishing live.</p>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center text-slate-500 hover:text-slate-800">
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>
              
              {/* Modal Body */}
              <div 
                className="flex flex-col flex-1 overflow-y-auto min-h-0 bg-white"
                style={{ padding: '32px', gap: '24px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                  <FloatingInput 
                    label="Item Name"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                  />
                  
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                      <FloatingInput 
                        label="Price (₹)"
                        type="number"
                        value={editingItem.price}
                        onChange={(e) => setEditingItem({...editingItem, price: e.target.value})}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="floating-label-group" style={{ margin: 0, height: '100%' }}>
                        <select 
                          className="floating-input bg-white border border-slate-200 rounded-xl"
                          style={{ height: '100%' }}
                          value={editingItem.category}
                          onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label className="floating-label">Category</label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Image Upload Section */}
                <div style={{ marginTop: '16px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4" style={{ marginBottom: '16px', marginTop: 0 }}>Item Photo</h4>
                  <div 
                    className={`relative w-full h-48 rounded-2xl overflow-hidden border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${isUploading ? 'border-slate-300 bg-slate-50' : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300'}`}
                    style={{ minHeight: '192px' }}
                    onClick={() => editFileInputRef.current.click()}
                  >
                    {editingItem.img ? (
                      <>
                        <img src={editingItem.img} className="absolute inset-0 w-full h-full object-cover" alt="Item preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-white font-medium flex items-center gap-2"><Camera size={18} /> Change Photo</p>
                        </div>
                      </>
                    ) : isUploading ? (
                      <Loader2 size={32} className="text-indigo-500 animate-spin" />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-500 mb-3">
                          <Camera size={24} />
                        </div>
                        <p className="text-sm font-medium text-indigo-900" style={{ margin: 0 }}>Upload new photo</p>
                      </>
                    )}
                  </div>
                  <input 
                    type="file"
                    ref={editFileInputRef}
                    onChange={handleEditFileChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
                
                {/* Submit Edit Request Button */}
                <button 
                  className="w-full text-white font-bold shadow-md hover:shadow-lg transition-all border-none cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  style={{ 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    marginTop: '16px'
                  }}
                  onClick={handleSaveEdit}
                  disabled={isUploading}
                >
                  <Check size={20} />
                  Submit Edit for Admin Approval
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
