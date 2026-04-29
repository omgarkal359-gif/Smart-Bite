import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Input } from '../components/ui/Input';
import { ShoppingCart, GraduationCap, Store, User, ArrowRight, HelpCircle, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './pages.css';
import './auth_updates.css';

const TABS = [
  { id: 'student', label: 'STUDENT', icon: GraduationCap },
  { id: 'owner', label: 'SHOP OWNER', icon: Store },
  { id: 'guest', label: 'GUEST', icon: User }
];

const AuthGateway = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('student');
  const [formData, setFormData] = useState({ prn: '', email: '', shopId: '', pin: '', name: '', mobile: '' });
  const [persistLogin, setPersistLogin] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Persistence check
  useEffect(() => {
    const token = localStorage.getItem('sgu_token');
    if (token) navigate('/student');
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [navigate]);

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const triggerError = (msg) => {
    triggerHaptic();
    setErrorShake(true);
    setToastMsg(msg);
    setTimeout(() => setErrorShake(false), 500);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    triggerHaptic();

    if (activeTab === 'student') {
      if (!/^\d{10}$/.test(formData.prn)) {
        triggerError('Invalid PRN. Must be 10 digits.');
        return;
      }
      if (persistLogin) localStorage.setItem('sgu_token', 'mock_jwt_token_12345');
      setToastMsg('OTP Sent Successfully!');
      setTimeout(() => navigate('/student'), 1000);
    } 
    else if (activeTab === 'owner') {
      if (!formData.shopId || !formData.pin) {
        triggerError('Invalid Credentials');
        return;
      }
      navigate('/vendor');
    }
    else if (activeTab === 'guest') {
      if (!formData.name) {
        triggerError('Name is required');
        return;
      }
      navigate('/student');
    }
  };

  if (isLoading) {
    return (
      <div className="auth-container-v21">
        <div className="auth-background-fullbleed" />
        <div className="skeleton-overlay flex flex-col items-center justify-center h-screen w-full relative z-20">
           <div className="w-24 h-24 rounded-3xl bg-gray-300 animate-pulse mb-8" />
           <div className="w-72 h-96 rounded-3xl bg-gray-300 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container-v21 page-transition">
      <div className="auth-background-fullbleed" />
      <div className="auth-overlay-blur" />

      {/* Elite UI: Top Trending Bar & Inactive Cart */}
      <div className="auth-elite-header">
        <div className="trending-ticker">
          <div className="ticker-content">
            <span><Flame size={14}/> Trending Now: Triple Cheese Burger @ Burger Joint</span>
            <span><Flame size={14}/> 20% OFF on all Pizzas today!</span>
          </div>
        </div>
        <div className="auth-cart-icon inactive">
          <ShoppingCart size={24} />
        </div>
      </div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`auth-toast ${toastMsg.includes('Invalid') ? 'error' : 'success'}`}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="auth-content-v21"
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="auth-header-v21">
          <div className="logo-v21">SGU</div>
          <h1 className="heading-1 auth-kfc-heading">LOGIN TO SMART-BITE</h1>
        </div>

        <motion.div 
          animate={errorShake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <GlassCard className="auth-card-v21 shadow-2xl">
            
            {/* KFC Segmented Control */}
            <div className="auth-tabs-v21 kfc-segmented">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); triggerHaptic(); }}
                    className={`tab-btn-v21 relative tap-effect ${isActive ? 'active' : ''}`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="activeTabIndicator"
                        className="tab-indicator kfc-active-indicator"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex flex-col items-center gap-1 font-heading">
                      <Icon size={18} />
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleLogin} className="auth-form-v21">
              <div className="relative" style={{ minHeight: '320px' }}>
                <AnimatePresence>
                  <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4 w-full absolute top-0 left-0"
                  >
                    {activeTab === 'student' && (
                      <>
                        <Input
                          label="PRN Number"
                          placeholder="Enter 10-digit PRN"
                          type="number"
                          value={formData.prn}
                          onChange={(e) => setFormData({...formData, prn: e.target.value})}
                        />
                        <Input
                          label="Mobile or University Email"
                          placeholder="example@sgu.edu"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                        
                        <div className="flex items-center gap-2 mt-2 relative">
                          <input 
                            type="checkbox" 
                            id="persist" 
                            checked={persistLogin} 
                            onChange={(e) => setPersistLogin(e.target.checked)} 
                            className="kfc-checkbox"
                          />
                          <label htmlFor="persist" className="text-sm font-bold text-gray-800">Trust this device</label>
                          <HelpCircle 
                            size={16} 
                            className="text-gray-400 cursor-pointer ml-1" 
                            onMouseEnter={() => setShowTooltip(true)} 
                            onMouseLeave={() => setShowTooltip(false)}
                            onClick={() => setShowTooltip(!showTooltip)}
                          />
                          <AnimatePresence>
                            {showTooltip && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="tooltip-v21"
                              >
                                Keeps you logged in for 30 days securely.
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </>
                    )}
                    
                    {activeTab === 'owner' && (
                      <>
                        <Input
                          label="Unique Shop ID"
                          placeholder="e.g. SHOP-01"
                          value={formData.shopId}
                          onChange={(e) => setFormData({...formData, shopId: e.target.value})}
                        />
                        <Input
                          label="Registered Email"
                          placeholder="vendor@sgu.edu"
                        />
                        <Input 
                          type="password" 
                          label="Security PIN/Password" 
                          placeholder="••••••••" 
                          value={formData.pin}
                          onChange={(e) => setFormData({...formData, pin: e.target.value})}
                        />
                      </>
                    )}

                    {activeTab === 'guest' && (
                      <>
                        <Input 
                          label="Full Name" 
                          placeholder="Enter your name" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                        <Input
                          label="Mobile Number"
                          placeholder="+91 9876543210"
                        />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">For order updates only.</p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.97 }} 
                type="submit" 
                className={`btn-primary-v21 mt-6 kfc-submit-btn ${activeTab === 'guest' ? 'btn-amber' : ''}`}
              >
                {activeTab === 'student' && 'SEND OTP'}
                {activeTab === 'owner' && 'ACCESS DASHBOARD'}
                {activeTab === 'guest' && 'FAST CHECKOUT'}
                <ArrowRight size={20} />
              </motion.button>
            </form>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AuthGateway;
