import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import './pages.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      });
    } catch (err) {
      console.error('Password reset email error:', err);
    } finally {
      setIsLoading(false);
      // Security: Anti-enumeration rule — always display success notice regardless of account existence
      setIsSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Accent */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #1A5276 0%, rgba(26,82,118,0) 70%)' }}
      />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-100 relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-[#1A5276]/30"
            style={{ background: 'linear-gradient(135deg, #1A5276, #0F3248)' }}
          >
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
            SGU Smart-Bite
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Password Recovery
          </p>
        </div>

        {isSubmitted ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Request Processed</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600 font-medium leading-relaxed">
              If an account exists for this email, a reset link has been sent.
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Please check your email inbox and spam folder for instructions.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm tracking-wide uppercase transition-all shadow-md mt-4"
              style={{ background: 'linear-gradient(135deg, #1A5276, #0F3248)' }}
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="student@sgu.ac.in"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A5276] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              {errorMsg && (
                <p className="text-xs text-rose-500 font-semibold mt-2">{errorMsg}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #1A5276, #0F3248)',
                boxShadow: '0 8px 20px rgba(26, 82, 118, 0.35)'
              }}
            >
              {isLoading ? (
                <span>Sending Reset Link...</span>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <Send size={16} />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#1A5276] transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
