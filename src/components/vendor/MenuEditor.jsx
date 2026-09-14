import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, X, Check, Edit2, Trash2, Camera, Loader2, 
  Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp
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
      showToast(`Item "${item.name}" set ${newAvailable ? 'IN STOCK 🟢' : 'OUT OF STOCK 🔴'}`, 'info');
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
    <div className="w-full space-y-4 font-sans text-slate-800">
      {/* 1. Control Toolbar (Compact & Aligned) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            ACTIVE MENU ITEMS ({items.length})
          </span>

          {/* Approval Requests Trigger */}
          <button
            type="button"
            onClick={() => setShowRequestsDrawer(!showRequestsDrawer)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Clock size={13} className="text-amber-600" />
            <span>Approval Requests ({pendingRequestsCount} Pending)</span>
            {showRequestsDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Add New Item Button */}
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className={`inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-xs font-bold transition-all border-0 cursor-pointer tracking-wide uppercase ${
            isAdding ? 'bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
          }`}
        >
          {isAdding ? <X size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          <span>{isAdding ? 'CANCEL' : 'ADD NEW ITEM'}</span>
        </motion.button>
      </div>

      {/* 2. Approval Requests Drawer */}
      <AnimatePresence>
        {showRequestsDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <div className="flex justify-between items-center border-b border-amber-200/60 pb-2">
              <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5 m-0">
                <Clock size={15} /> Vendor Menu Approval Requests ({requests.length})
              </h3>
              <span className="text-[11px] text-amber-700 font-medium">Structural changes require Super Admin approval</span>
            </div>

            {requests.length === 0 ? (
              <p className="text-xs text-amber-800 italic m-0">No change requests submitted yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {requests.map(r => (
                  <div key={r.id} className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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
                        <p className="text-xs text-red-600 font-bold mt-1 bg-red-50 p-1.5 rounded-lg border border-red-100 m-0">
                          Rejection Reason: {r.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                        r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {r.status === 'PENDING' && <Clock size={11} />}
                        {r.status === 'APPROVED' && <CheckCircle2 size={11} />}
                        {r.status === 'REJECTED' && <XCircle size={11} />}
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

      {/* 3. Add New Item Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            className="overflow-hidden p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4"
            onSubmit={handleAddItem}
          >
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900 m-0">Submit New Item Request</h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">Structural additions will be submitted to the Admin for approval before publishing live.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FloatingInput 
                label="Item Name (e.g. Single Idli)"
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
                className="floating-input appearance-none bg-white border border-slate-200 p-2.5 rounded-xl w-full text-xs font-medium"
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
              className={`border border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500 transition-colors ${isUploading ? 'shimmer' : ''}`}
              onClick={() => fileInputRef.current.click()}
            >
              {newItem.img ? (
                <img src={newItem.img} className="max-h-32 mx-auto rounded-lg object-cover" alt="Preview" />
              ) : isUploading ? (
                <Loader2 size={32} className="animate-spin mx-auto text-indigo-500" />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-1">
                    <Camera size={16} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 m-0">Upload Photo</p>
                  <p className="text-[10px] text-slate-400 m-0">TAP TO BROWSE</p>
                </div>
              )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit" 
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all border-0 cursor-pointer tracking-wide"
            >
              Submit Item for Admin Approval
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 4. Menu Categories & High-Density Horizontal Cards */}
      <div className="space-y-6">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0 && !isAdding) return null;
          
          return (
            <div key={cat} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 pt-2">
                <h2 className="text-base font-black uppercase text-red-600 tracking-tight m-0">{cat}</h2>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{catItems.length} ITEMS</span>
              </div>
              
              {/* 5. Full-Width Single-Column Cards (One Big Card Per Line) */}
              <div className="flex flex-col gap-3.5 w-full">
                {catItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="w-full bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[96px]"
                  >
                    {/* Left Group: Big Thumbnail + Text Information */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Product Thumbnail (80px - 88px) */}
                      <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 group shadow-xs">
                        <img src={getFoodItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
                        <div 
                          className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                          onClick={() => setEditingItem({...item})}
                          title="Click to edit details"
                        >
                          <Edit2 size={16} />
                        </div>
                      </div>
                      
                      {/* Information Block */}
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <h4 className="text-base sm:text-lg font-bold text-slate-900 truncate m-0 leading-tight tracking-tight">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium mt-0.5 flex-wrap">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg uppercase tracking-wider border border-slate-200/60">
                            {item.category}
                          </span>
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-black text-sm rounded-lg border border-emerald-200/70 inline-flex items-center">
                            ₹{item.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Group: Operational Toggle + Edit + Delete */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 sm:ml-auto w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Operational Quick Availability Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide transition-all border-0 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                          item.available 
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60' 
                            : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
                        }`}
                        title="Operational Toggle: Instant Live Update + Audit Log"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${item.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span>{item.available ? 'In Stock' : 'Out of Stock'}</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => setEditingItem({...item})}
                        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200 bg-white cursor-pointer shadow-2xs"
                        title="Request Structural Edit"
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* Delete Button */}
                      <button 
                        type="button"
                        onClick={() => handleDeleteRequest(item)}
                        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-200 bg-white cursor-pointer shadow-2xs"
                        title="Request Item Deactivation"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
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
                  padding: '20px 24px', 
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-800 m-0">Edit Item Request</h2>
                  <p className="text-xs text-slate-400 m-0">Edits will be submitted to Admin for approval before publishing live.</p>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center text-slate-500 hover:text-slate-800">
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
              
              {/* Modal Body */}
              <div 
                className="flex flex-col flex-1 overflow-y-auto min-h-0 bg-white"
                style={{ padding: '24px', gap: '20px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                  <FloatingInput 
                    label="Item Name"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                  />
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
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
                <div style={{ marginTop: '12px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3" style={{ margin: '0 0 12px 0' }}>Item Photo</h4>
                  <div 
                    className={`relative w-full h-40 rounded-2xl overflow-hidden border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${isUploading ? 'border-slate-300 bg-slate-50' : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300'}`}
                    onClick={() => editFileInputRef.current.click()}
                  >
                    {editingItem.img ? (
                      <>
                        <img src={editingItem.img} className="absolute inset-0 w-full h-full object-cover" alt="Item preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-white text-xs font-medium flex items-center gap-1.5"><Camera size={16} /> Change Photo</p>
                        </div>
                      </>
                    ) : isUploading ? (
                      <Loader2 size={28} className="text-indigo-500 animate-spin" />
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-white rounded-full shadow-xs flex items-center justify-center text-indigo-500 mb-2">
                          <Camera size={20} />
                        </div>
                        <p className="text-xs font-medium text-indigo-900" style={{ margin: 0 }}>Upload new photo</p>
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
                  type="button"
                  className="w-full text-white font-bold shadow-xs hover:shadow-md transition-all border-0 cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  style={{ 
                    padding: '14px', 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    marginTop: '12px',
                    fontSize: '13px'
                  }}
                  onClick={handleSaveEdit}
                  disabled={isUploading}
                >
                  <Check size={18} />
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
