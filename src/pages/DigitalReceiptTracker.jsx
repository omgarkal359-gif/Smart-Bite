import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ArrowLeft, QrCode, CheckCircle, Clock, ChefHat, BellRing, Download, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import './pages.css';
import './tracker.css';

const STATUS_STEPS = [
  { id: 'placed', label: 'Order Placed', icon: Clock },
  { id: 'prep', label: 'Preparing', icon: ChefHat },
  { id: 'ready', label: 'Ready for Pickup', icon: CheckCircle },
];

const DigitalReceiptTracker = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setCurrentStep(1), 3000), // Move to prep
      setTimeout(() => setCurrentStep(2), 8000), // Move to ready
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <div className="tracker-container-v21 page-transition">
      <header className="glass-header blur-header">
        <div className="menu-header-top">
          <button className="btn-icon tap-effect" onClick={() => navigate('/student')}>
            <ArrowLeft size={24} />
          </button>
          <h1 className="heading-2">Order #SGU21</h1>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="tracker-main-v21">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <GlassCard className="receipt-card-v21 shadow-md">
            
            <div className="qr-section-v21">
              <div className="qr-wrapper-v21">
                <QrCode size={120} color="var(--primary-navy)" />
              </div>
              <p className="heading-2 mt-4">#SGU21</p>
              <p className="text-muted">Show code at the counter</p>
            </div>

            <div className="timeline-v21">
              {STATUS_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index <= currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.id} className={`timeline-step-v21 ${isActive ? 'active' : ''}`}>
                    <div className={`step-icon-v21 ${isCurrent && index === 2 ? 'pulse-ready' : ''}`}>
                      <Icon size={20} />
                    </div>
                    <div className="step-content-v21">
                      <h3 className="step-label">{step.label}</h3>
                      {isCurrent && <p className="step-desc text-muted">In progress...</p>}
                    </div>
                    {index < STATUS_STEPS.length - 1 && <div className="step-line-v21" />}
                  </div>
                );
              })}
            </div>

            {currentStep === 2 && (
              <motion.div 
                className="ready-actions-v21 mt-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <button className="btn-pdf-v21">
                  <Download size={20} /> Download PDF Receipt
                </button>
                <button className="btn-email-v21">
                  <Mail size={20} /> Resend to Email
                </button>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
};

export default DigitalReceiptTracker;
