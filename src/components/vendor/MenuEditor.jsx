import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Upload, Check, Edit2, Trash2, Camera, Loader2, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api';
import { getFoodItemImage } from '../../utils/imageHelper';

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
  const [items, setItems] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Main', img: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const [editingItem, setEditingItem] = useState(null);
  const [originalItem, setOriginalItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const editFileInputRef = React.useRef(null);

  useEffect(() => {
    if (!shopId) return;
    async function loadMenu() {
      try {
        const fetchedItems = await api.getStallMenu(shopId);
        setItems(fetchedItems);
      } catch (err) {
        console.error('Failed to load menu items:', err);
      }
    }
    loadMenu();
  }, [shopId]);

  const categories = useMemo(() => {
    const list = [...new Set(items.map(item => item.category))];
    if (list.length === 0) return ['Main', 'Sides', 'Beverages', 'Desserts'];
    return list;
  }, [items]);

  const isDirty = useMemo(() => {
    if (!editingItem || !originalItem) return false;
    return (
      editingItem.name !== originalItem.name ||
      String(editingItem.price) !== String(originalItem.price) ||
      editingItem.category !== originalItem.category ||
      (editingItem.img || '') !== (originalItem.img || '')
    );
  }, [editingItem, originalItem]);

  const handleOpenEdit = (item) => {
    const itemImg = item.img || getFoodItemImage(item) || '';
    const itemCopy = {
      ...item,
      name: item.name || '',
      price: item.price !== undefined && item.price !== null ? String(item.price) : '',
      category: item.category || 'Main',
      img: itemImg,
    };
    setEditingItem(itemCopy);
    setOriginalItem(itemCopy);
    setFieldErrors({});
  };

  const handleCloseModal = () => {
    if (isDirty) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmClose) return;
    }
    setEditingItem(null);
    setOriginalItem(null);
    setFieldErrors({});
  };

  const validateEdit = () => {
    const errors = {};
    if (!editingItem.name || !editingItem.name.trim()) {
      errors.name = 'Item name is required';
    }
    const numPrice = parseFloat(editingItem.price);
    if (editingItem.price === '' || isNaN(numPrice) || numPrice <= 0) {
      errors.price = 'Please enter a valid price (greater than ₹0)';
    }
    if (!editingItem.category) {
      errors.category = 'Category is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    if (!validateEdit() || isSaving) return;
    setIsSaving(true);
    try {
      const isOut = editingItem.stock === 0 || editingItem.inStock === false || editingItem.isOutOfStock === true;
      const payload = {
        name: editingItem.name.trim(),
        price: parseFloat(editingItem.price),
        category: editingItem.category,
        img: editingItem.img || '',
        stock: isOut ? 0 : 20,
      };
      await api.updateMenuItem(editingItem.id, payload);
      setItems(items.map(i => i.id === editingItem.id ? { ...i, ...payload, inStock: !isOut, isOutOfStock: isOut } : i));
      setToastMessage({ 
        type: 'success', 
        title: 'Changes Saved',
        text: `"${payload.name}" updated live on menu` 
      });
      setTimeout(() => setToastMessage(null), 3500);
      setEditingItem(null);
      setOriginalItem(null);
      setFieldErrors({});
    } catch (err) {
      console.error('Failed to update item:', err);
      setToastMessage({ 
        type: 'error', 
        title: 'Update Failed',
        text: err.message || 'Could not save changes. Please try again.' 
      });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id, field, value) => {
    // Optimistic local state update
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    try {
      await api.updateMenuItem(id, { [field]: value });
    } catch (err) {
      console.error('Failed to sync item update:', err);
    }
  };

  const handleToggleStock = async (item) => {
    const isCurrentlyOut = (item.stock === 0 || item.isOutOfStock === true || item.inStock === false);
    const newStock = isCurrentlyOut ? 20 : 0;
    const newInStock = isCurrentlyOut;

    // Optimistically update local state
    setItems(prevItems => 
      prevItems.map(i => 
        i.id === item.id 
          ? { ...i, stock: newStock, inStock: newInStock, isOutOfStock: !newInStock } 
          : i
      )
    );

    try {
      await api.updateMenuItem(item.id, { 
        stock: newStock,
        available: 1
      });
      setToastMessage({ 
        type: 'success', 
        title: 'Stock Updated',
        text: `"${item.name}" is now ${newInStock ? 'In Stock' : 'Out of Stock'}` 
      });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update item stock status:', err);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;
    try {
      const payload = {
        name: newItem.name,
        price: parseFloat(newItem.price),
        category: newItem.category,
        stock: 20,
        isVeg: 1
      };
      const createdItem = await api.addMenuItem(shopId, payload);
      setItems([createdItem, ...items]);
      setNewItem({ name: '', price: '', category: 'Main', img: '' });
      setIsAdding(false);
      setToastMessage({ 
        type: 'success', 
        title: 'Item Created',
        text: `"${createdItem.name || 'Item'}" added to menu catalog` 
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      alert('Failed to add item: ' + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem({ ...newItem, img: reader.result });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFieldErrors(prev => ({ ...prev, img: 'File size exceeds 5MB limit' }));
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingItem(prev => ({ ...prev, img: reader.result }));
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setEditingItem(prev => ({ ...prev, img: '' }));
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  return (
    <div className="menu-editor-container">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 mt-6">
        <h2 className="text-3xl sm:text-4xl font-black uppercase" style={{ color: '#0f172a', fontFamily: 'Oswald, sans-serif', margin: 0, letterSpacing: '0.05em' }}>CATALOG EDITOR</h2>
        <motion.button 
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center justify-center gap-3 px-8 py-3.5 rounded-full font-black text-base uppercase transition-all shrink-0"
          onClick={() => setIsAdding(!isAdding)}
          style={{ 
            backgroundColor: isAdding ? '#1e293b' : '#dc2626', 
            color: '#ffffff',
            border: 'none', 
            cursor: 'pointer',
            width: 'max-content',
            minWidth: 'max-content',
            letterSpacing: '1px',
            boxShadow: isAdding ? 'none' : '0 8px 20px rgba(220, 38, 38, 0.35)'
          }}
        >
          {isAdding ? <X size={22} strokeWidth={3} /> : <Plus size={22} strokeWidth={3} />}
          <span style={{ lineHeight: 1, paddingRight: '2px' }}>{isAdding ? 'CANCEL' : 'ADD NEW ITEM'}</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="elite-card overflow-hidden mb-8"
            onSubmit={handleAddItem}
          >
            <h3 className="heading-2 form-title">New Item Details</h3>
            
            <div className="flex flex-col gap-5 mb-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Item Name
                </label>
                <input 
                  type="text"
                  className="w-full h-12 px-5 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white hover:border-slate-400 focus:bg-white focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-[15px] placeholder:text-slate-400 shadow-sm"
                  placeholder="e.g. Triple Cheese Sandwich"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Price
                  </label>
                  <div className="flex items-center h-12 rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10 overflow-hidden transition-all shadow-sm">
                    <div className="flex items-center justify-center px-4 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold h-full select-none shrink-0">
                      ₹
                    </div>
                    <input 
                      type="number"
                      className="w-full h-full px-4 bg-transparent border-none outline-none font-semibold text-slate-900 text-[15px] placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="20"
                      value={newItem.price}
                      onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Category
                  </label>
                  <div className="relative flex items-center">
                    <select 
                      className="w-full h-12 pl-5 pr-10 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white hover:border-slate-400 focus:bg-white focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all text-[15px] appearance-none cursor-pointer shadow-sm"
                      value={newItem.category}
                      onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Main">Main</option>
                      <option value="Sides">Sides</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Desserts">Desserts</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <div 
              className={`drop-zone ${isUploading ? 'shimmer' : ''}`}
              onClick={() => fileInputRef.current.click()}
            >
              {newItem.img ? (
                <img src={newItem.img} className="preview-image" />
              ) : isUploading ? (
                <Loader2 size={40} className="upload-spinner" />
              ) : (
                <>
                  <div className="upload-icon-wrapper">
                    <Camera size={32} />
                  </div>
                  <p className="upload-text">Upload Photo</p>
                  <p className="upload-hint">DRAG & DROP OR TAP</p>
                </>
              )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit" 
              className="w-full mt-4 h-[52px] rounded-[18px] text-[15px] font-bold tracking-wide text-white bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] shadow-[0_4px_20px_rgba(220,38,38,0.4)] hover:shadow-[0_6px_25px_rgba(220,38,38,0.5)] transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              <Check size={19} strokeWidth={3} className="text-white" />
              <span>Save Changes</span>
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="menu-sections flex flex-col gap-10 mt-8">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0 && !isAdding) return null;
          
          return (
            <div key={cat} className="category-section">
              <div className="category-header">
                <h3 className="heading-2 category-title">{cat}</h3>
                <div className="title-separator" />
                <span className="item-count">{catItems.length} Items</span>
              </div>
              
              <div className="items-grid">
                {catItems.map((item, index) => {
                  const isItemOutOfStock = (item.stock === 0 || item.isOutOfStock === true || item.inStock === false);

                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={item.id} 
                      className={`menu-item-card elite-card group ${isItemOutOfStock ? 'is-out-of-stock' : ''}`}
                    >
                      <div className="menu-item-image">
                        <img src={getFoodItemImage(item)} alt={item.name} />
                        {isItemOutOfStock && (
                          <div className="stock-badge-overlay">
                            <span>OUT OF STOCK</span>
                          </div>
                        )}
                        <div className="image-overlay" onClick={() => handleOpenEdit(item)} style={{ cursor: 'pointer' }}>
                          <Edit2 size={24} />
                        </div>
                      </div>
                      
                      <div className="menu-item-details">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="item-name">{item.name}</h4>
                          {isItemOutOfStock && (
                            <span className="out-of-stock-pill-inline">Out of Stock</span>
                          )}
                        </div>
                        <div className="item-meta">
                          <span className="category-tag">{item.category}</span>
                          <span className="price-tag">₹{item.price}</span>
                        </div>
                      </div>

                      <div className="menu-item-actions">
                        {/* Out of Stock Toggle Button */}
                        <button 
                          type="button"
                          className={`stock-toggle-pill ${isItemOutOfStock ? 'out-of-stock' : 'in-stock'}`}
                          onClick={() => handleToggleStock(item)}
                          title={isItemOutOfStock ? "Item is OUT OF STOCK. Click to mark IN STOCK" : "Item is IN STOCK. Click to mark OUT OF STOCK"}
                        >
                          <span className="stock-dot" />
                          <span className="stock-text">{isItemOutOfStock ? 'OUT OF STOCK' : 'IN STOCK'}</span>
                          <span className="stock-switch">
                            <span className="stock-switch-thumb" />
                          </span>
                        </button>

                        <button 
                          type="button"
                          className="edit-action-btn"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Item Details"
                        >
                          <Edit2 size={18} />
                        </button>

                        <button 
                          type="button"
                          className="delete-btn"
                          title="Delete Item"
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
                              try {
                                await api.updateMenuItem(item.id, { available: false });
                                setItems(items.filter(i => i.id !== item.id));
                                setToastMessage({ type: 'success', text: `"${item.name}" deleted successfully` });
                                setTimeout(() => setToastMessage(null), 3500);
                              } catch(err) {
                                setToastMessage({ type: 'error', text: 'Failed to delete item: ' + err.message });
                                setTimeout(() => setToastMessage(null), 4000);
                              }
                            }
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ultra-Sleek Professional Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`fixed bottom-6 right-6 z-[3000] flex items-center gap-3.5 pl-4 pr-3 py-3 rounded-2xl bg-white/95 backdrop-blur-md border ${
              toastMessage.type === 'error'
                ? 'border-rose-200 shadow-xl shadow-rose-900/10'
                : 'border-slate-200/80 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5'
            } min-w-[280px] max-w-sm`}
          >
            {/* Status Icon */}
            {toastMessage.type === 'error' ? (
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle size={18} strokeWidth={2.5} />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 size={18} strokeWidth={2.5} />
              </div>
            )}

            {/* Content */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                {toastMessage.title || (toastMessage.type === 'error' ? 'Update Failed' : 'Changes Saved')}
                {toastMessage.type !== 'error' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </span>
              <span className="text-xs text-slate-500 font-medium truncate">
                {toastMessage.text}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setToastMessage(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer p-0 shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional SaaS Edit Dish Details Modal */}
      <AnimatePresence>
        {editingItem && (
          <div 
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden my-auto"
            >
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <h3 className="text-[17px] font-bold text-slate-900 tracking-tight m-0 font-['Inter',sans-serif]">
                    Edit Dish Details
                  </h3>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    Update item details and sync live with your restaurant menu.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={handleCloseModal} 
                  aria-label="Close modal"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all border-none bg-transparent cursor-pointer p-0 shrink-0"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>
              
              {/* Form Body */}
              <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4.5 m-0 bg-white font-['Inter',sans-serif]">
                
                {/* ITEM NAME */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-slate-700 tracking-normal flex items-center justify-between">
                    <span>Dish Name</span>
                    <span className="text-[11px] text-slate-400 font-normal">Required</span>
                  </label>
                  <input
                    type="text"
                    className={`w-full h-11 px-3.5 rounded-xl border ${
                      fieldErrors.name 
                        ? 'border-rose-400 ring-4 ring-rose-500/10 bg-rose-50/20' 
                        : 'border-slate-200 hover:border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                    } bg-white text-sm text-slate-800 font-medium placeholder:text-slate-400 outline-none transition-all shadow-xs`}
                    value={editingItem.name}
                    onChange={(e) => {
                      setEditingItem({ ...editingItem, name: e.target.value });
                      if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                    }}
                    placeholder="e.g. Single Idli"
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-rose-500 mt-0.5 flex items-center gap-1 font-medium m-0">
                      <AlertCircle size={13} /> {fieldErrors.name}
                    </p>
                  )}
                </div>

                {/* PRICE & CATEGORY */}
                <div className="grid grid-cols-2 gap-3.5">
                  {/* PRICE */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-slate-700 tracking-normal flex items-center justify-between">
                      <span>Price</span>
                      <span className="text-[11px] text-slate-400 font-normal">INR</span>
                    </label>
                    <div className="relative flex items-center h-11">
                      <div className="absolute left-3.5 text-slate-400 font-semibold text-sm pointer-events-none select-none">
                        ₹
                      </div>
                      <input
                        type="number"
                        step="any"
                        className={`w-full h-full pl-8 pr-3.5 rounded-xl border ${
                          fieldErrors.price 
                            ? 'border-rose-400 ring-4 ring-rose-500/10 bg-rose-50/20' 
                            : 'border-slate-200 hover:border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        } bg-white text-sm text-slate-800 font-medium placeholder:text-slate-400 outline-none transition-all shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        value={editingItem.price}
                        onChange={(e) => {
                          setEditingItem({ ...editingItem, price: e.target.value });
                          if (fieldErrors.price) setFieldErrors(prev => ({ ...prev, price: null }));
                        }}
                        placeholder="20"
                      />
                    </div>
                    {fieldErrors.price && (
                      <p className="text-xs text-rose-500 mt-0.5 flex items-center gap-1 font-medium m-0">
                        <AlertCircle size={13} /> {fieldErrors.price}
                      </p>
                    )}
                  </div>

                  {/* CATEGORY */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-slate-700 tracking-normal">
                      Category
                    </label>
                    <div className="relative flex items-center h-11">
                      <select
                        className="w-full h-full pl-3.5 pr-9 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 bg-white text-sm text-slate-800 font-medium outline-none transition-all appearance-none cursor-pointer shadow-xs"
                        value={editingItem.category}
                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      >
                        {Array.from(new Set([...categories, editingItem.category].filter(Boolean))).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* ITEM PHOTO */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-slate-700 tracking-normal flex items-center justify-between">
                    <span>Dish Photo</span>
                    <span className="text-[11px] text-slate-400 font-normal">Recommended 1:1</span>
                  </label>

                  {editingItem.img ? (
                    <div className="relative w-full h-[155px] rounded-xl overflow-hidden border border-slate-200 bg-slate-950 shadow-xs group">
                      <img 
                        src={editingItem.img} 
                        alt={editingItem.name || 'Dish Preview'} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" 
                      />
                      {/* Frosted Action Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end justify-between p-3">
                        <span className="text-[11px] font-medium text-white/90 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-md">
                          Live Photo
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold shadow-sm backdrop-blur-md border border-slate-200/80 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <Camera size={13} className="text-slate-600" />
                            <span>Change</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveImage(e)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 size={13} className="text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => editFileInputRef.current?.click()}
                      className={`w-full h-[140px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                        isUploading 
                          ? 'border-slate-200 bg-slate-50' 
                          : 'border-slate-200 hover:border-red-400 bg-slate-50/50 hover:bg-red-50/30'
                      }`}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={22} className="text-red-500 animate-spin" />
                          <span className="text-xs font-medium text-slate-500">Uploading photo...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center p-4">
                          <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400">
                            <Upload size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700 m-0">Click to upload photo</p>
                            <p className="text-[11px] text-slate-400 m-0 mt-0.5">PNG, JPG or WebP up to 5MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {fieldErrors.img && (
                    <p className="text-xs text-rose-500 mt-0.5 flex items-center gap-1 font-medium m-0">
                      <AlertCircle size={13} /> {fieldErrors.img}
                    </p>
                  )}

                  <input 
                    type="file"
                    ref={editFileInputRef}
                    onChange={handleEditFileChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Save Changes Red Button */}
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="w-full mt-1.5 h-12 rounded-xl text-sm font-semibold tracking-normal text-white bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-600/30 transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span className="text-white">Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check size={17} strokeWidth={2.5} className="text-white" />
                      <span className="text-white">Save Changes</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
