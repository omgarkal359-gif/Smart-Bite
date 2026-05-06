import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, CheckCircle } from 'lucide-react';
import './pages.css';
import './board.css';

// Mock initial data
const INITIAL_PREPARING = [101, 102, 104, 105, 107, 108];
const INITIAL_READY = [98, 99, 100];

const PublicOrderBoard = () => {
  const [preparing, setPreparing] = useState(INITIAL_PREPARING);
  const [ready, setReady] = useState(INITIAL_READY);

  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    // Sync with shop status
    const savedStatus = localStorage.getItem('shop_status_SHOP-01');
    if (savedStatus === 'CLOSED') setIsClosed(true);
    
    // Poll for status changes (simulating real-time)
    const statusInterval = setInterval(() => {
      const currentStatus = localStorage.getItem('shop_status_SHOP-01');
      setIsClosed(currentStatus === 'CLOSED');
    }, 2000);

    return () => clearInterval(statusInterval);
  }, []);

  return (
    <div className={`tv-board-container ${isClosed ? 'grayscale opacity-50' : ''}`}>
      <AnimatePresence>
        {isClosed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div className="text-center">
              <h1 className="text-white font-black text-8xl uppercase tracking-tighter mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>Temporarily Closed</h1>
              <p className="text-amber-400 text-3xl font-bold uppercase tracking-widest">We&apos;ll be back soon!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="tv-header">
        <div className="tv-logo">SGU SmartBite</div>
        <div className="tv-time">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="tv-main-grid">
        {/* Preparing Column */}
        <div className="tv-column prep-column">
          <div className="tv-col-header">
            <Utensils size={32} /> Preparing
          </div>
          <div className="tv-number-grid">
            <AnimatePresence mode="popLayout">
              {preparing.map(num => (
                <motion.div 
                  key={num}
                  layout
                  initial={{ opacity: 0, scale: 0.5, rotateX: -90 }}
                  animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotateX: 90 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className="tv-number prep-num"
                >
                  {num}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Ready Column */}
        <div className="tv-column ready-column">
          <div className="tv-col-header ready">
            <CheckCircle size={32} /> Please Collect
          </div>
          <div className="tv-number-grid">
            <AnimatePresence mode="popLayout">
              {ready.map((num, idx) => (
                <motion.div 
                  key={num}
                  layout
                  initial={{ opacity: 0, scale: 0.5, x: -50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className={`tv-number ready-num ${idx === 0 ? 'highlight-pulse' : ''}`}
                >
                  {num}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicOrderBoard;
