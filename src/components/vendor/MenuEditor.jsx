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
    const itemCopy = {
      ...item,
      name: item.name || '',
      price: item.price !== undefined && item.price !== null ? String(item.price) : '',
      category: item.category || 'Main',
      img: item.img || '',
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
    if (!validateEdit() || !isDirty || isSaving) return;
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
      setToastMessage({ type: 'success', text: `"${payload.name}" updated successfully!` });
      setTimeout(() => setToastMessage(null), 3500);
      setEditingItem(null);
      setOriginalItem(null);
      setFieldErrors({});
    } catch (err) {
      console.error('Failed to update item:', err);
      setToastMessage({ type: 'error', text: 'Failed to update item: ' + (err.message || 'Unknown error') });
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
      setToastMessage({ type: 'success', text: `"${createdItem.name || 'Item'}" added successfully!` });
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
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="btn-publish-menu"
            >
              Publish to Menu
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

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-[3000] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${
              toastMessage.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-slate-400 hover:text-white bg-transparent border-none cursor-pointer p-1 flex items-center"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Redesigned Edit Menu Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight m-0">
                    Edit Menu Item
                  </h3>
                  <p className="text-xs text-slate-500 font-normal m-0 mt-1">
                    Update the details of your menu item
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={handleCloseModal} 
                  aria-label="Close modal"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
              
              {/* Body (Scrollable Form) */}
              <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden m-0">
                <div className="px-7 py-6 flex flex-col gap-6 overflow-y-auto flex-1 min-h-0">
                  
                  {/* Section: Basic Information */}
                  <div className="flex flex-col gap-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Basic Information
                    </span>

                    {/* Item Name */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Item Name
                      </label>
                      <input
                        type="text"
                        className={`w-full h-12 px-4 rounded-xl border ${
                          fieldErrors.name 
                            ? 'border-rose-400 ring-4 ring-rose-500/10' 
                            : 'border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        } bg-white text-sm text-slate-900 font-medium placeholder:text-slate-400 outline-none transition-all shadow-xs`}
                        value={editingItem.name}
                        onChange={(e) => {
                          setEditingItem({ ...editingItem, name: e.target.value });
                          if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                        }}
                        placeholder="e.g. Single Idli"
                      />
                      {fieldErrors.name && (
                        <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium m-0">
                          <AlertCircle size={13} /> {fieldErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Price & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Price with Segmented Badge */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-700">
                          Price
                        </label>
                        <div className={`flex items-center h-12 rounded-xl border ${
                          fieldErrors.price 
                            ? 'border-rose-400 ring-4 ring-rose-500/10' 
                            : 'border-slate-200 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10'
                        } bg-white overflow-hidden transition-all shadow-xs`}>
                          <div className="flex items-center justify-center px-4 bg-slate-50 border-r border-slate-200 text-slate-500 text-sm font-semibold h-full select-none shrink-0">
                            ₹
                          </div>
                          <input
                            type="number"
                            step="any"
                            className="w-full h-full px-4 bg-transparent border-none outline-none text-sm text-slate-900 font-medium placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={editingItem.price}
                            onChange={(e) => {
                              setEditingItem({ ...editingItem, price: e.target.value });
                              if (fieldErrors.price) setFieldErrors(prev => ({ ...prev, price: null }));
                            }}
                            placeholder="20"
                          />
                        </div>
                        {fieldErrors.price && (
                          <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium m-0">
                            <AlertCircle size={13} /> {fieldErrors.price}
                          </p>
                        )}
                      </div>

                      {/* Category */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-700">
                          Category
                        </label>
                        <div className="relative flex items-center h-12">
                          <select
                            className="w-full h-full pl-4 pr-10 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 bg-white text-sm text-slate-900 font-medium outline-none transition-all appearance-none cursor-pointer shadow-xs"
                            value={editingItem.category}
                            onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                          >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown size={16} className="absolute right-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subtle Divider */}
                  <div className="h-px bg-slate-100 my-1" />

                  {/* Section: Menu Image */}
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Menu Image
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        PNG, JPG up to 5MB
                      </span>
                    </div>

                    {editingItem.img ? (
                      <div className="relative w-full h-40 sm:h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 group shadow-xs">
                        <img 
                          src={editingItem.img} 
                          alt={editingItem.name || 'Preview'} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 p-4 backdrop-blur-[2px]">
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/95 hover:bg-white text-slate-800 text-xs font-semibold shadow-md transition-all cursor-pointer border-none"
                          >
                            <Camera size={14} /> Change Photo
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold shadow-md transition-all cursor-pointer border border-rose-200/60"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => editFileInputRef.current?.click()}
                        className={`w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                          isUploading 
                            ? 'border-slate-300 bg-slate-50' 
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        {isUploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={22} className="text-red-500 animate-spin" />
                            <span className="text-xs font-medium text-slate-500">Uploading photo...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center p-4">
                            <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-100 flex items-center justify-center text-slate-400">
                              <Upload size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-700 m-0">Click to upload photo</p>
                              <p className="text-[11px] text-slate-400 m-0 mt-0.5">Recommended 1:1 or 16:9 ratio</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {fieldErrors.img && (
                      <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium m-0">
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
                </div>

                {/* Sticky Footer Actions */}
                <div className="px-7 py-4.5 bg-slate-50/90 backdrop-blur-sm border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 border border-slate-200 bg-white transition-colors cursor-pointer shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isDirty || isSaving || isUploading}
                    className="px-5.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} strokeWidth={2.5} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
