import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Upload, Check, Edit2, Trash2, Camera, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api';

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
      <div className="flex justify-between items-center mb-10 mt-6">
        <h2 className="text-4xl font-black uppercase" style={{ color: '#0f172a', fontFamily: 'Oswald, sans-serif', margin: 0, letterSpacing: '0.05em' }}>CATALOG EDITOR</h2>
        <motion.button 
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all"
          onClick={() => setIsAdding(!isAdding)}
          style={{ 
            backgroundColor: isAdding ? '#1e293b' : '#dc2626', 
            color: '#ffffff',
            border: 'none', 
            cursor: 'pointer',
            boxShadow: isAdding ? 'none' : '0 8px 20px rgba(220, 38, 38, 0.3)'
          }}
        >
          {isAdding ? <X size={22} strokeWidth={3} /> : <Plus size={22} strokeWidth={3} />}
          {isAdding ? 'CANCEL' : 'ADD NEW ITEM'}
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
                {catItems.map((item, index) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={item.id} 
                    className="menu-item-card elite-card group"
                  >
                    <div className="menu-item-image">
                      <img src={item.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'} alt={item.name} />
                      <div className="image-overlay" onClick={() => setEditingItem({...item})} style={{ cursor: 'pointer' }}>
                        <Edit2 size={24} />
                      </div>
                    </div>
                    
                    <div className="menu-item-details">
                      <h4 className="item-name" style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 'bold' }}>{item.name}</h4>
                      <div className="item-meta">
                        <span className="category-tag">{item.category}</span>
                        <div className="price-tag" style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#0f172a' }}>
                          ₹ {item.price}
                        </div>
                      </div>
                    </div>

                    <div className="menu-item-actions">
                      <button 
                        className="delete-btn"
                        onClick={async () => {
                          try {
                            await api.updateMenuItem(item.id, { available: false });
                            setItems(items.filter(i => i.id !== item.id));
                          } catch (err) {
                            alert('Failed to delete item: ' + err.message);
                          }
                        }}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
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
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden"
              style={{ height: '85vh', minHeight: '500px', maxHeight: '800px' }}
            >
              {/* Sticky Header */}
              <div className="bg-white z-20 px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h3 className="text-3xl font-black uppercase tracking-wide text-slate-900 m-0">Edit Item</h3>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center">
                  <X size={24} />
                </button>
              </div>
              
              {/* Body */}
              <div className="flex flex-col gap-6 p-8 flex-1 overflow-y-auto min-h-0">
                <FloatingInput 
                  label="Item Name"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                />
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <FloatingInput 
                      label="Price (₹)"
                      type="number"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({...editingItem, price: e.target.value})}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="floating-label-group m-0 h-full">
                      <select 
                        className="floating-input appearance-none h-full"
                        value={editingItem.category}
                        onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <label className="floating-label">Category</label>
                    </div>
                  </div>
                </div>

                <input 
                  type="file" 
                  ref={editFileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleEditFileChange} 
                />
                
                <div 
                  className={`drop-zone ${isUploading ? 'shimmer' : ''} !mb-2 shrink-0`}
                  onClick={() => editFileInputRef.current.click()}
                >
                  {editingItem.img ? (
                    <img src={editingItem.img} className="preview-image" style={{ objectFit: 'cover' }} />
                  ) : isUploading ? (
                    <Loader2 size={40} className="upload-spinner animate-spin" />
                  ) : (
                    <>
                      <div className="upload-icon-wrapper"><Camera size={32} /></div>
                      <p className="upload-text">Change Photo</p>
                    </>
                  )}
                </div>

                <button 
                  onClick={async () => {
                    try {
                      const payload = {
                        name: editingItem.name,
                        price: parseFloat(editingItem.price),
                        category: editingItem.category,
                        img: editingItem.img
                      };
                      await api.updateMenuItem(editingItem.id, payload);
                      setItems(items.map(i => i.id === editingItem.id ? {...i, ...payload} : i));
                      setEditingItem(null);
                    } catch(err) {
                      alert('Failed to update item: ' + err.message);
                    }
                  }}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase tracking-wider text-sm transition-colors border-none cursor-pointer shrink-0 mt-2"
                  disabled={isUploading}
                >
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
