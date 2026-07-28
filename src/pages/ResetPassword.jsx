import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, KeyRound } from 'lucide-react';
import { supabase } from '../supabaseClient';
import './pages.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(null); // null = checking, true/false
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. URL & Recovery Session Validation
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          if (isMounted) setHasValidSession(false);
        } else {
          if (isMounted) setHasValidSession(true);
        }
      } catch (err) {
        if (isMounted) setHasValidSession(false);
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (isMounted) setHasValidSession(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Real-time Password Strength Validation Criteria
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== '';
  const isValidPassword = hasMinLength && hasNumber && passwordsMatch;

  // 3. Password Update Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPassword) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccessMsg('Password updated successfully! Redirecting to login...');
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Could not update password. Link may have expired.');
      setIsLoading(false);
    }
  };

  // Loading State while verifying recovery session
  if (hasValidSession === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-sm font-semibold flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Verifying security link...
        </div>
      </div>
    );
  }

  // Invalid or Expired Recovery Session View
  if (hasValidSession === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle size={36} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Invalid or Expired Link</h2>
            <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
              This password recovery link is either invalid or has expired. Please request a new link to reset your password.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm tracking-wide uppercase transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg, #1A5276, #0F3248)' }}
            >
              Request New Link
            </button>
            <Link
              to="/login"
              className="block text-xs font-bold text-slate-500 hover:text-[#1A5276] transition-colors py-2"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Accent */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #1A5276 0%, rgba(26,82,118,0) 70%)' }}
      />

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-100 relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-[#1A5276]/30"
            style={{ background: 'linear-gradient(135deg, #1A5276, #0F3248)' }}
          >
            <KeyRound size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
            Set New Password
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            SGU Smart-Bite Security
          </p>
        </div>

        {successMsg ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-emerald-900">{successMsg}</h3>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            
            {/* New Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A5276] focus:border-transparent transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A5276] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Real-time Password Strength Checklist */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Password Requirements:
              </span>
              
              <div className="flex items-center gap-2 text-xs font-semibold">
                {hasMinLength ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-slate-300 shrink-0" />
                )}
                <span className={hasMinLength ? 'text-emerald-700' : 'text-slate-500'}>
                  At least 8 characters long
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                {hasNumber ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-slate-300 shrink-0" />
                )}
                <span className={hasNumber ? 'text-emerald-700' : 'text-slate-500'}>
                  Includes at least 1 number
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                {passwordsMatch ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-slate-300 shrink-0" />
                )}
                <span className={passwordsMatch ? 'text-emerald-700' : 'text-slate-500'}>
                  Passwords match
                </span>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-500 font-semibold text-center">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !isValidPassword}
              className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #1A5276, #0F3248)',
                boxShadow: isValidPassword ? '0 8px 20px rgba(26, 82, 118, 0.35)' : 'none'
              }}
            >
              {isLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
