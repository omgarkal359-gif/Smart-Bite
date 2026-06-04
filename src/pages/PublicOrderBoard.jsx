import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, CheckCircle } from 'lucide-react';
import { api, socket } from '../api';
import './pages.css';
import './board.css';

const PublicOrderBoard = () => {
  const [preparing, setPreparing] = useState([]);
  const [ready, setReady] = useState([]);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    async function loadQueue() {
      try {
        const activeOrders = await api.getOrderQueue();
        updateQueueStates(activeOrders);
      } catch (err) {
        console.error('Failed to load queue board:', err);
      }
    }

    function updateQueueStates(orders) {
      const prepList = orders
        .filter(o => o.status === 'placed' || o.status === 'preparing' || o.status === 'pending_cash')
        .map(o => o.id.replace('SGU-', ''));
      
      const readyList = orders
        .filter(o => o.status === 'ready')
        .map(o => o.id.replace('SGU-', ''));

      setPreparing(prepList);
      setReady(readyList);
    }

    loadQueue();

    // Check if food court has online stalls
    async function checkStallsStatus() {
      try {
        const stalls = await api.getStalls();
        const onlineCount = stalls.filter(s => s.online === 1 || s.online === true).length;
        setIsClosed(onlineCount === 0);
      } catch (err) {
        console.error('Failed to load stall statuses:', err);
      }
    }
    checkStallsStatus();

    // Join real-time queue broadcasts
    socket.emit('join', 'public-board');
    socket.emit('join', 'student');

    const handleQueueUpdate = (updatedOrders) => {
      updateQueueStates(updatedOrders);
    };

    const handleStallStatusUpdate = () => {
      checkStallsStatus();
    };

    socket.on('queue_update', handleQueueUpdate);
    socket.on('stall_status_update', handleStallStatusUpdate);

    // Polling fallbacks
    const queueInterval = setInterval(loadQueue, 5000); // Poll queue every 5 seconds
    const stallsInterval = setInterval(checkStallsStatus, 15000); // Poll stalls status every 15 seconds

    return () => {
      socket.off('queue_update', handleQueueUpdate);
      socket.off('stall_status_update', handleStallStatusUpdate);
      clearInterval(queueInterval);
      clearInterval(stallsInterval);
    };
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
