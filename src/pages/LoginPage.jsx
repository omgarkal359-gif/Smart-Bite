import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, User, Lock, Mail, Loader2,
  CheckCircle2, ArrowRight, ShieldCheck, Store
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

/* ─────────────────────────────────────────
   Reusable Google SVG
───────────────────────────────────────── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

/* ─────────────────────────────────────────
   Reusable Input Field
───────────────────────────────────────── */
const InputField = ({
  id, label, type = 'text', value, onChange, placeholder,
  icon: Icon, rightAction, required, autoFocus, autoComplete,
  error, hint
}) => (
  <div className="lp-field">
    <label htmlFor={id} className="lp-label">{label}</label>
    <div className={`lp-input-wrap ${error ? 'has-error' : ''}`}>
      {Icon && <Icon className="lp-icon-left" size={18} aria-hidden="true" />}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="lp-input"
        required={required}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {rightAction && <div className="lp-icon-right">{rightAction}</div>}
    </div>
    {error  && <p id={`${id}-error`} className="lp-field-error" role="alert">{error}</p>}
    {!error && hint && <p id={`${id}-hint`} className="lp-field-hint">{hint.text}</p>}
  </div>
);

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
const LoginPage = () => {
  /* mode */
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  /* shared */
  const [identifier,    setIdentifier]    = useState('');
  const [password,      setPassword]      = useState('');
  const [showPwd,       setShowPwd]       = useState(false);

  /* register-only */
  const [regName,       setRegName]       = useState('');
  const [confirmPwd,    setConfirmPwd]    = useState('');
  const [showConfirm,   setShowConfirm]   = useState(false);

  /* login-only */
  const [rememberMe,    setRememberMe]    = useState(false);

  /* async states */
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');

  /* field-level errors */
  const [fieldErrors, setFieldErrors] = useState({});

  /* OTP flow */
  const [otpSent,  setOtpSent]  = useState(false);
  const [otpToken, setOtpToken] = useState('');

  const navigate = useNavigate();

  /* ── helpers ── */
  const isEmail  = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone  = (v) => /^\d{10}$/.test(v) || /^\+\d{10,12}$/.test(v);
  const isOtpId  = (v) => isEmail(v) || isPhone(v);

  const clearErrors = () => { setErrorMsg(''); setFieldErrors({}); };

  const switchMode = (m) => {
    setMode(m);
    setIdentifier(''); setPassword(''); setRegName(''); setConfirmPwd('');
    setShowPwd(false); setShowConfirm(false);
    setOtpSent(false); setOtpToken('');
    clearErrors();
  };

  const redirectByRole = (role, shopId) => {
    if (role === 'student' || role === 'guest') navigate('/student');
    else if (role === 'owner') navigate(`/vendor/${shopId}`);
    else if (role === 'admin') navigate('/admin');
  };

  const finishLogin = (response) => {
    setIsLoading(false);
    setIsSuccess(true);
    const userData = {
      role: response.user.role, name: response.user.name,
      id: response.user.username,
      shopId: response.user.shopId || response.user.shopid,
      timestamp: new Date().toISOString(), rememberMe,
    };
    localStorage.setItem('sgu_user', JSON.stringify(userData));
    setTimeout(() => { setIsSuccess(false); redirectByRole(userData.role, userData.shopId); }, 1500);
  };

  /* ── Supabase OAuth listener ── */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsLoading(true); clearErrors();
        try {
          const { email, full_name, name: mName, phone } = session.user.user_metadata || {};
          const userEmail = session.user.email || email;
          const userPhone = session.user.phone || phone;
          const lid = userEmail || userPhone;
          if (!lid) throw new Error('No email or phone found in session.');
          const pending = localStorage.getItem('sgu_pending_name');
          const uName = full_name || mName || pending || (userEmail ? userEmail.split('@')[0] : userPhone);
          localStorage.removeItem('sgu_pending_name');
          const res = await api.googleLogin(lid, uName);
          if (res.success) {
            setIsLoading(false); setIsSuccess(true);
            const ud = {
              role: res.user.role, name: res.user.name, id: res.user.username,
              shopId: res.user.shopId || res.user.shopid,
              timestamp: new Date().toISOString(), rememberMe: true,
            };
            localStorage.setItem('sgu_user', JSON.stringify(ud));
            await supabase.auth.signOut();
            setTimeout(() => { setIsSuccess(false); redirectByRole(ud.role, ud.shopId); }, 1500);
          } else { setErrorMsg(res.message || 'Google login failed.'); setIsLoading(false); }
        } catch (err) { setErrorMsg(err.message || 'Could not complete Google sign-in.'); setIsLoading(false); }
      }
    });

    const saved = localStorage.getItem('sgu_user');
    if (saved) {
      const p = JSON.parse(saved);
      const bad = p.role === 'owner' && (!p.shopId || p.shopId === 'undefined' || p.shopId === 'null');
      if (bad) localStorage.removeItem('sgu_user');
      else redirectByRole(p.role, p.shopId);
    }
    return () => subscription.unsubscribe();
  }, [navigate]);

  /* ── Login handler ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    const id = identifier.trim();
    const fe = {};
    if (!id) { fe.identifier = 'Please enter your Shop ID, email, or mobile.'; }
    if (Object.keys(fe).length) { setFieldErrors(fe); return; }

    setIsLoading(true); clearErrors();
    try {
      if (isOtpId(id)) {
        if (isEmail(id)) { const { error } = await supabase.auth.signInWithOtp({ email: id }); if (error) throw error; }
        else { const ph = /^\d{10}$/.test(id) ? `+91${id}` : id; const { error } = await supabase.auth.signInWithOtp({ phone: ph }); if (error) throw error; }
        setIsLoading(false); setOtpSent(true); return;
      }
      const role = id.toLowerCase().includes('admin') ? 'admin' : 'owner';
      const res = await api.login(id, password.trim(), role, '');
      if (res.success) { finishLogin(res); return; }
      const retry = await api.login(id, password.trim(), 'student', '');
      if (retry.success) { finishLogin(retry); return; }
      setErrorMsg('Invalid credentials. Please check your details and try again.');
      setIsLoading(false);
    } catch (err) { setErrorMsg(err.message || 'Could not connect to server.'); setIsLoading(false); }
  };

  /* ── Register handler ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    const id = identifier.trim();
    const nm = regName.trim();
    const fe = {};
    if (!nm) fe.regName = 'Full name is required.';
    if (!id) fe.identifier = 'Email or mobile number is required.';
    if (!password.trim()) fe.password = 'Password is required.';
    else if (password.length < 6) fe.password = 'Password must be at least 6 characters.';
    if (password !== confirmPwd) fe.confirmPwd = 'Passwords do not match.';
    if (Object.keys(fe).length) { setFieldErrors(fe); return; }

    setIsLoading(true); clearErrors();
    try {
      const res = await api.register(id, nm, password.trim(), 'student');
      if (res.success) { finishLogin(res); }
      else { setErrorMsg(res.message || 'Registration failed. Please try again.'); setIsLoading(false); }
    } catch (err) { setErrorMsg(err.message || 'Could not connect to server.'); setIsLoading(false); }
  };

  /* ── OTP verify ── */
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpToken.trim().length !== 6) { setErrorMsg('Please enter the full 6-digit code.'); return; }
    setIsLoading(true); clearErrors();
    try {
      const id = identifier.trim();
      const vp = isEmail(id)
        ? { email: id, token: otpToken.trim(), type: 'email' }
        : { phone: /^\d{10}$/.test(id) ? `+91${id}` : id, token: otpToken.trim(), type: 'sms' };
      const { error } = await supabase.auth.verifyOtp(vp);
      if (error) throw error;
    } catch (err) { setErrorMsg(err.message || 'Failed to verify code.'); setIsLoading(false); }
  };

  /* ── Google OAuth ── */
  const loginWithGoogle = async () => {
    setIsLoading(true); clearErrors();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/login' },
      });
      if (error) throw error;
    } catch (err) { setErrorMsg(err.message || 'Google Sign-In failed.'); setIsLoading(false); }
  };

  /* ── Smart hint for login ── */
  const getHint = () => {
    const id = identifier.trim();
    if (!id) return null;
    if (isEmail(id)) return { text: '📧 You\'ll receive a one-time code via email' };
    if (isPhone(id)) return { text: '📱 You\'ll receive a one-time code via SMS' };
    if (id.toLowerCase().includes('admin')) return { text: '🔐 Admin — enter your password' };
    return { text: '🏪 Shop Owner — enter your password' };
  };

  /* ── submit label ── */
  const loginBtnLabel = isOtpId(identifier.trim()) ? 'Send Code' : 'Sign In';

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    <div className="lp-root" role="main">

      {/* ── decorative blobs ── */}
      <div className="lp-blob lp-blob-1" aria-hidden="true" />
      <div className="lp-blob lp-blob-2" aria-hidden="true" />

      <div className="lp-card" role="region" aria-label="Authentication">

        {/* ══ OTP SCREEN ══ */}
        {otpSent ? (
          <form onSubmit={handleVerifyOtp} noValidate aria-label="OTP Verification">
            <div className="lp-otp-badge" aria-hidden="true">✉️</div>
            <h1 className="lp-heading" style={{ fontSize: '1.6rem' }}>
              {isEmail(identifier) ? 'Check Your Email' : 'Check Your Phone'}
            </h1>
            <p className="lp-sub">
              We sent a 6-digit code to{' '}
              <strong className="lp-highlight">{identifier}</strong>
            </p>

            <InputField
              id="otp-code"
              label="Verification Code"
              icon={ShieldCheck}
              value={otpToken}
              onChange={(e) => { setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 6)); clearErrors(); }}
              placeholder="● ● ● ● ● ●"
              autoFocus
              autoComplete="one-time-code"
              error={errorMsg}
            />

            <button
              type="submit"
              disabled={otpToken.length !== 6 || isLoading || isSuccess}
              className={`lp-btn-primary ${isSuccess ? 'lp-btn-success' : ''}`}
              aria-label="Verify code and sign in"
            >
              {isLoading  && <Loader2 className="lp-spin" size={20} aria-hidden="true" />}
              {isSuccess  && <CheckCircle2 size={20} aria-hidden="true" />}
              {!isLoading && !isSuccess && <><span>Verify &amp; Sign In</span><ArrowRight size={18} aria-hidden="true" /></>}
            </button>

            <button
              type="button"
              className="lp-text-btn"
              onClick={() => { setOtpSent(false); setOtpToken(''); clearErrors(); }}
              aria-label="Go back to login"
            >
              ← Back to Login
            </button>
          </form>

        ) : (
          <>
            {/* ── Brand Header ── */}
            <div className="lp-brand" aria-label="Smart Bite">
              <div className="lp-logo" aria-hidden="true">🍽️</div>
              <h1 className="lp-heading">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="lp-sub">
                {mode === 'login'
                  ? 'Sign in to continue to Smart Bite'
                  : 'Join Smart Bite — it\'s free'}
              </p>
            </div>

            {/* ── Tab Toggle ── */}
            <div className="lp-tabs" role="tablist" aria-label="Authentication mode">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                aria-controls="login-panel"
                className={`lp-tab ${mode === 'login' ? 'lp-tab-active' : ''}`}
                onClick={() => switchMode('login')}
                type="button"
              >
                Sign In
              </button>
              <button
                role="tab"
                aria-selected={mode === 'register'}
                aria-controls="register-panel"
                className={`lp-tab ${mode === 'register' ? 'lp-tab-active' : ''}`}
                onClick={() => switchMode('register')}
                type="button"
              >
                Sign Up
              </button>
            </div>

            {/* ══ LOGIN FORM ══ */}
            {mode === 'login' && (
              <form
                id="login-panel"
                role="tabpanel"
                onSubmit={handleLogin}
                noValidate
                aria-label="Sign in form"
              >
                <InputField
                  id="login-id"
                  label="Email / Mobile / Shop ID"
                  icon={Mail}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); clearErrors(); }}
                  placeholder="email, mobile or shop ID"
                  required
                  autoFocus
                  autoComplete="username"
                  error={fieldErrors.identifier}
                  hint={!fieldErrors.identifier ? getHint() : null}
                />

                <InputField
                  id="login-pwd"
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  icon={Lock}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  error={fieldErrors.password}
                  rightAction={
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      className="lp-toggle-btn"
                    >
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                {/* Remember Me + Forgot */}
                <div className="lp-row">
                  <label className="lp-remember" htmlFor="remember-me">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="lp-checkbox"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="lp-forgot"
                    onClick={() => alert('Forgot Password — coming soon!')}
                    aria-label="Forgot password"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Global error */}
                {errorMsg && (
                  <div className="lp-error-banner" role="alert" aria-live="assertive">
                    <span>⚠️</span> {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!identifier.trim() || isLoading || isSuccess}
                  className={`lp-btn-primary ${isSuccess ? 'lp-btn-success' : ''}`}
                  aria-label={loginBtnLabel}
                >
                  {isLoading  && <Loader2 className="lp-spin" size={20} aria-hidden="true" />}
                  {isSuccess  && <CheckCircle2 size={20} aria-hidden="true" />}
                  {!isLoading && !isSuccess && <><span>{loginBtnLabel}</span><ArrowRight size={18} aria-hidden="true" /></>}
                </button>

                {/* Divider */}
                <div className="lp-divider" aria-hidden="true"><span>or continue with</span></div>

                {/* Google */}
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={isLoading || isSuccess}
                  className="lp-btn-google"
                  aria-label="Sign in with Google"
                >
                  <GoogleIcon />
                  <span>Sign in with Google</span>
                </button>

                {/* Switch to register */}
                <p className="lp-switch-text">
                  Don't have an account?{' '}
                  <button type="button" className="lp-switch-link" onClick={() => switchMode('register')}>
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {/* ══ REGISTER FORM ══ */}
            {mode === 'register' && (
              <form
                id="register-panel"
                role="tabpanel"
                onSubmit={handleRegister}
                noValidate
                aria-label="Create account form"
              >
                <InputField
                  id="reg-name"
                  label="Full Name"
                  icon={User}
                  value={regName}
                  onChange={(e) => { setRegName(e.target.value); clearErrors(); }}
                  placeholder="Your full name"
                  required
                  autoFocus
                  autoComplete="name"
                  error={fieldErrors.regName}
                />

                <InputField
                  id="reg-id"
                  label="Email / Mobile"
                  icon={Mail}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); clearErrors(); }}
                  placeholder="Email or 10-digit mobile"
                  required
                  autoComplete="username"
                  error={fieldErrors.identifier}
                />

                <InputField
                  id="reg-pwd"
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  icon={Lock}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                  error={fieldErrors.password}
                  rightAction={
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'} className="lp-toggle-btn">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                <InputField
                  id="reg-confirm"
                  label="Confirm Password"
                  type={showConfirm ? 'text' : 'password'}
                  icon={Lock}
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); clearErrors(); }}
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  error={fieldErrors.confirmPwd}
                  rightAction={
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'} className="lp-toggle-btn">
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                {/* Global error */}
                {errorMsg && (
                  <div className="lp-error-banner" role="alert" aria-live="assertive">
                    <span>⚠️</span> {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!regName.trim() || !identifier.trim() || !password.trim() || !confirmPwd.trim() || isLoading || isSuccess}
                  className={`lp-btn-primary ${isSuccess ? 'lp-btn-success' : ''}`}
                  aria-label="Create account"
                >
                  {isLoading  && <Loader2 className="lp-spin" size={20} aria-hidden="true" />}
                  {isSuccess  && <CheckCircle2 size={20} aria-hidden="true" />}
                  {!isLoading && !isSuccess && <><span>Create Account</span><ArrowRight size={18} aria-hidden="true" /></>}
                </button>

                {/* Divider */}
                <div className="lp-divider" aria-hidden="true"><span>or sign up with</span></div>

                {/* Google */}
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={isLoading || isSuccess}
                  className="lp-btn-google"
                  aria-label="Sign up with Google"
                >
                  <GoogleIcon />
                  <span>Sign up with Google</span>
                </button>

                {/* Switch to login */}
                <p className="lp-switch-text">
                  Already have an account?{' '}
                  <button type="button" className="lp-switch-link" onClick={() => switchMode('login')}>
                    Sign in
                  </button>
                </p>

                {/* Owner note */}
                <div className="lp-owner-note">
                  <Store size={14} aria-hidden="true" />
                  <span>Shop owners — contact admin to get your Shop ID &amp; password.</span>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
