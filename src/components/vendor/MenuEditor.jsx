import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Upload, Check, Edit2, Trash2, Camera, Loader2 } from 'lucide-react';
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
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingItem({ ...editingItem, img: reader.result });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
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
            
            <div className="form-grid">
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
                className="floating-input appearance-none"
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
                        <div className="image-overlay" onClick={() => setEditingItem({ ...item, inStock: !isItemOutOfStock })} style={{ cursor: 'pointer' }}>
                          <Edit2 size={24} />
                        </div>
                      </div>
                      
                      <div className="menu-item-details">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="item-name" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>{item.name}</h4>
                          {isItemOutOfStock && (
                            <span className="out-of-stock-pill-inline">Out of Stock</span>
                          )}
                        </div>
                        <div className="item-meta">
                          <span className="category-tag">{item.category}</span>
                          <div className="price-tag" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#0f172a' }}>
                            ₹ {item.price}
                          </div>
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
                          onClick={() => setEditingItem({ ...item, inStock: !isItemOutOfStock })}
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
                              } catch (err) {
                                alert('Failed to delete item: ' + err.message);
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
              {/* Refined Header (Banner) */}
              <div 
                className="flex justify-between items-center shrink-0"
                style={{ 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                  padding: '24px 32px', 
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <h2 className="text-2xl font-bold text-slate-800 m-0 tracking-tight" style={{ margin: 0 }}>Edit Menu Item</h2>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center text-slate-500 hover:text-slate-800">
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>
              
              {/* Body */}
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
                          className="floating-input bg-white"
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

                {/* Stock Status Selector in Modal */}
                <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3" style={{ margin: '0 0 12px 0' }}>Stock Availability</h4>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        editingItem.stock !== 0 && editingItem.inStock !== false
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                      onClick={() => setEditingItem({ ...editingItem, stock: 20, inStock: true })}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      In Stock
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        editingItem.stock === 0 || editingItem.inStock === false
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                      onClick={() => setEditingItem({ ...editingItem, stock: 0, inStock: false })}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      Out of Stock
                    </button>
                  </div>
                </div>

                {/* Spaced out Image Section */}
                <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
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
                        <p className="text-xs text-indigo-500 mt-1" style={{ margin: '4px 0 0 0' }}>Click to browse files</p>
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
                
                {/* Save Button */}
                <button 
                  className="w-full mt-2 text-white font-bold shadow-md hover:shadow-lg transition-all border-none cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  style={{ 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    marginTop: '16px'
                  }}
                  onClick={async () => {
                    try {
                      const isOut = editingItem.stock === 0 || editingItem.inStock === false;
                      const payload = {
                        name: editingItem.name,
                        price: parseFloat(editingItem.price),
                        category: editingItem.category,
                        img: editingItem.img,
                        stock: isOut ? 0 : 20,
                      };
                      await api.updateMenuItem(editingItem.id, payload);
                      setItems(items.map(i => i.id === editingItem.id ? {...i, ...payload, inStock: !isOut, isOutOfStock: isOut} : i));
                      setEditingItem(null);
                    } catch(err) {
                      alert('Failed to update item: ' + err.message);
                    }
                  }}
                  disabled={isUploading}
                >
                  <Check size={20} />
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
