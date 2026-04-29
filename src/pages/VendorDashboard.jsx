import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Clock, Volume2, Power, LogOut, CheckCircle, Banknote, Activity, Smartphone, Utensils, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './pages.css';
import './vendor.css';

const MOCK_TICKETS = [
  { id: 'SGU-001', items: ['2x Margherita Pizza', '1x Coke'], total: 340, time: '2 mins ago', type: 'Dine-In', payment: 'Online UPI', status: 'prep' },
  { id: 'SGU-002', items: ['1x Classic Burger', '1x Fries'], total: 160, time: '5 mins ago', type: 'Takeaway', payment: 'Cash', status: 'pending_cash' },
  { id: 'SGU-003', items: ['3x Spicy Wings'], total: 450, time: '8 mins ago', type: 'Dine-In', payment: 'Online UPI', status: 'prep' },
  { id: 'SGU-004', items: ['1x Cold Coffee'], total: 70, time: '12 mins ago', type: 'Takeaway', payment: 'Online UPI', status: 'prep' },
];

const VendorDashboard = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(MOCK_TICKETS);
  const [isPowerSaver, setIsPowerSaver] = useState(false);
  const [isBusyMode, setIsBusyMode] = useState(false);
  const [heartbeat, setHeartbeat] = useState(true);

  // Heartbeat pulse simulation
  useEffect(() => {
    const pulse = setInterval(() => {
      setHeartbeat(h => !h);
      setTimeout(() => setHeartbeat(h => !h), 500);
    }, 5000);
    return () => clearInterval(pulse);
  }, []);

  const handleConfirmCash = (id) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'prep' } : t));
  };

  const handleMarkReady = (id) => {
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  // Revenue calc
  const onlineRev = tickets.filter(t => t.payment === 'Online UPI').reduce((a, b) => a + b.total, 0);
  const cashRev = tickets.filter(t => t.payment === 'Cash').reduce((a, b) => a + b.total, 0);

  return (
    <div className={`vendor-kds-container page-transition ${isPowerSaver ? 'power-saver' : ''}`}>
      <header className="kds-header shadow-lg">
        <div className="kds-header-left">
          <h1 className="heading-2 text-white">Shop #01 KDS</h1>
          <div className="heartbeat-monitor">
            <Activity size={20} color={heartbeat ? '#22C55E' : '#94A3B8'} className={heartbeat ? 'pulse' : ''} />
            <span className="text-white opacity-80 text-sm">System Online</span>
          </div>
        </div>
        
        <div className="kds-controls">
          <button className={`kds-btn ${isBusyMode ? 'busy' : ''}`} onClick={() => setIsBusyMode(!isBusyMode)}>
            <Clock size={18} /> {isBusyMode ? '+15m Wait' : 'Normal'}
          </button>
          <button className={`kds-btn ${isPowerSaver ? 'active' : ''}`} onClick={() => setIsPowerSaver(!isPowerSaver)}>
            <Power size={18} /> OLED Saver
          </button>
          <button className="kds-btn danger" onClick={() => navigate('/auth')}>
            <LogOut size={18} /> Exit
          </button>
        </div>
      </header>

      <main className="kds-main">
        {/* Revenue Dashboard */}
        <div className="kds-revenue-row">
          <div className="revenue-card shadow-md">
            <div className="rev-icon online"><Smartphone size={24} /></div>
            <div className="rev-info">
              <span className="rev-label">Online UPI</span>
              <span className="rev-amount">₹{onlineRev}</span>
            </div>
          </div>
          <div className="revenue-card shadow-md">
            <div className="rev-icon cash"><Banknote size={24} /></div>
            <div className="rev-info">
              <span className="rev-label">Cash Pending</span>
              <span className="rev-amount">₹{cashRev}</span>
            </div>
          </div>
        </div>

        {/* Horizontal Ticket Scroll */}
        <div className="kds-ticket-scroll">
          <AnimatePresence>
            {tickets.map(ticket => (
              <motion.div 
                key={ticket.id}
                layout
                initial={{ opacity: 0, scale: 0.8, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -50 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className={`kds-ticket shadow-2xl ${ticket.status === 'pending_cash' ? 'alert-border' : ''}`}
              >
                <div className="ticket-header">
                  <span className="ticket-id">{ticket.id}</span>
                  <span className="ticket-time">{ticket.time}</span>
                </div>
                
                <div className="ticket-badges">
                  <span className={`badge ${ticket.type === 'Dine-In' ? 'dine-in' : 'takeaway'}`}>
                    {ticket.type === 'Dine-In' ? <Utensils size={14} /> : <ShoppingBag size={14} />}
                    {ticket.type}
                  </span>
                  <span className={`badge ${ticket.payment === 'Online UPI' ? 'upi' : 'cash'}`}>
                    {ticket.payment === 'Online UPI' ? <Smartphone size={14} /> : <Banknote size={14} />}
                    {ticket.payment}
                  </span>
                </div>

                <div className="ticket-items">
                  {ticket.items.map((item, i) => (
                    <div key={i} className="ticket-item">{item}</div>
                  ))}
                </div>

                <div className="ticket-total">
                  Total: ₹{ticket.total}
                </div>

                <div className="ticket-actions">
                  {ticket.status === 'pending_cash' ? (
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className="jumbo-btn confirm-cash shadow-md"
                      onClick={() => handleConfirmCash(ticket.id)}
                    >
                      <Banknote size={24} /> CONFIRM CASH
                    </motion.button>
                  ) : (
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className="jumbo-btn mark-ready shadow-md"
                      onClick={() => handleMarkReady(ticket.id)}
                    >
                      <CheckCircle size={24} /> MARK READY
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default VendorDashboard;
