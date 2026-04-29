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

  // Simulate socket-driven updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random preparing order to move to ready
      if (preparing.length > 0) {
        setPreparing(prev => {
          const next = [...prev];
          const moved = next.shift();
          
          setReady(r => {
            const nextReady = [moved, ...r];
            if (nextReady.length > 6) nextReady.pop(); // keep max 6
            return nextReady;
          });
          
          // Add a new preparing order
          next.push(Math.max(...next, ...ready) + 1);
          return next;
        });
      }
    }, 5000); // Update every 5 seconds for simulation

    return () => clearInterval(interval);
  }, [preparing, ready]);

  return (
    <div className="tv-board-container">
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
