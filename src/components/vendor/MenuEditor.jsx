import React, { useState, useEffect } from 'react';
import { Plus, X, Upload, Check, Edit2, Trash2, Camera, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_MENU = [
  { id: 1, name: 'Margherita Pizza', price: 299, category: 'Main', img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80&fm=webp' },
  { id: 2, name: 'Classic Burger', price: 159, category: 'Main', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80&fm=webp' },
  { id: 3, name: 'Cold Coffee', price: 99, category: 'Beverages', img: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=400&q=80&fm=webp' },
];

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

export const MenuEditor = () => {
  const [items, setItems] = useState(MOCK_MENU);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Main', img: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleUpdate = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    const item = {
      ...newItem,
      id: Date.now(),
      img: newItem.img || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80&fm=webp`
    };
    setItems([item, ...items]);
    setNewItem({ name: '', price: '', category: 'Main', img: '' });
    setIsAdding(false);
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

  return (
    <div className="menu-editor-container">
      <div className="flex justify-between items-center mb-8">
        <h2 className="heading-2 text-2xl text-navy-900" style={{ margin: 0 }}>Catalog Editor</h2>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${isAdding ? 'bg-red-50 text-red-600' : 'bg-primary-navy text-white'}`}
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
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
            <h3 className="heading-2 text-lg mb-6 text-slate-800">New Item Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingInput 
                label="Item Name (e.g. Triple Cheese)"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}
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
                <option>Main</option>
                <option>Sides</option>
                <option>Beverages</option>
                <option>Desserts</option>
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
              className={`drop-zone mt-4 min-h-[160px] flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-2xl transition-all relative overflow-hidden cursor-pointer ${isUploading ? 'shimmer' : ''}`}
              onClick={() => fileInputRef.current.click()}
            >
              {newItem.img ? (
                <img src={newItem.img} className="absolute inset-0 w-full h-full object-cover" />
              ) : isUploading ? (
                <Loader2 size={40} className="text-navy-500 animate-spin" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-navy-50 rounded-full flex items-center justify-center mb-3">
                    <Camera size={32} className="text-navy-600" />
                  </div>
                  <p className="text-sm font-black text-navy-900 uppercase tracking-widest">Upload Photo</p>
                  <p className="text-xs text-slate-400 font-bold">DRAG & DROP OR TAP</p>
                </>
              )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="w-full bg-green-500 text-white font-black py-5 rounded-2xl mt-8 shadow-xl hover:bg-green-600 transition-colors uppercase tracking-widest"
            >
              Publish to Menu
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="menu-sections flex flex-col gap-10 mt-8">
        {['Main', 'Sides', 'Beverages', 'Desserts'].map(cat => {
          const catItems = items.filter(i => i.category === cat);
          if (catItems.length === 0 && !isAdding) return null;
          
          return (
            <div key={cat} className="category-section">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="heading-2 text-xl text-navy-800 m-0">{cat}</h3>
                <div className="h-[2px] flex-1 bg-slate-100 rounded-full" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{catItems.length} Items</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
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
                      <img src={item.img} alt={item.name} />
                      <div className="image-overlay">
                        <Edit2 size={16} />
                      </div>
                    </div>
                    
                    <div className="menu-item-details">
                      <h4 className="heading-2 item-name">{item.name}</h4>
                      <div className="item-meta">
                        <span className="category-tag">{item.category}</span>
                        <div className="price-edit">
                          <span className="currency">₹</span>
                          <input 
                            type="number"
                            className="price-input" 
                            value={item.price}
                            onChange={(e) => handleUpdate(item.id, 'price', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="menu-item-actions">
                      <button 
                        className="delete-btn"
                        onClick={() => setItems(items.filter(i => i.id !== item.id))}
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
    </div>
  );
};
