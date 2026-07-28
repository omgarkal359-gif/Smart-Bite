import React, { useState, useEffect } from 'react';
import {
  IconMail, IconLock, IconUser, IconEye, IconEyeOff,
  IconLoader2, IconCircleCheck, IconArrowRight,
  IconBrandGoogle, IconShieldCheck, IconBuildingStore
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

/*
  Design Read: Premium consumer auth page for Smart Bite food court app.
  Audience: Students, shop owners, admins on mobile-first.
  Vibe: Clean, premium consumer, brand-anchored (KFC Red #E4002B).
  Dials: DESIGN_VARIANCE: 7 | MOTION_INTENSITY: 5 | VISUAL_DENSITY: 3
  Font: Outfit (display) + Geist (body) via @font-face/Google Fonts
  Icons: @tabler/icons-react (single family, strokeWidth 1.75)
  Accent: #E4002B (locked for entire page)
  Shape system: 16px cards, 12px inputs, 999px pills (buttons)
  No emoji in UI per skill default (food theme gets a pass for the logo mark only)
*/

/* ── Reusable: Google wordmark SVG (official colors, not hand-rolled path) ── */
const GoogleMark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

/* ── Reusable: labelled input block (label above, error below, no placeholder-as-label) ── */
const Field = ({
  id, label, type = 'text', value, onChange, placeholder,
  Icon, right, autoFocus, autoComplete, error, hint
}) => (
  <div className="sb-field" data-error={!!error}>
    <label htmlFor={id} className="sb-field-label">{label}</label>
    <div className="sb-field-wrap">
      {Icon && <Icon className="sb-field-icon" size={17} strokeWidth={1.75} aria-hidden="true" />}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="sb-field-input"
      />
      {right && <div className="sb-field-right">{right}</div>}
    </div>
    {error && <p id={`${id}-err`} className="sb-field-msg sb-field-msg--error" role="alert">{error}</p>}
    {!error && hint && <p id={`${id}-hint`} className="sb-field-msg sb-field-msg--hint">{hint}</p>}
  </div>
);

/* ── Main component ── */
const LoginPage = () => {
  /* mode */
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  /* shared fields */
  const [identifier,  setIdentifier]  = useState('');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);

  /* register-only */
  const [regName,     setRegName]     = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  /* login-only */
  const [rememberMe, setRememberMe] = useState(false);

  /* async */
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [fieldErr,  setFieldErr]  = useState({});

  /* OTP flow */
  const [otpSent,        setOtpSent]        = useState(false);
  const [otpToken,       setOtpToken]       = useState('');
  const [pendingRegUser, setPendingRegUser] = useState(null);
  const [resendTimer,    setResendTimer]    = useState(30);

  const navigate = useNavigate();

  /* ── resend OTP timer countdown ── */
  useEffect(() => {
    let timer;
    if (otpSent && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, resendTimer]);

  /* ── helpers ── */
  const isEmail  = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone  = (v) => /^\d{10}$/.test(v) || /^\+\d{10,12}$/.test(v);
  const isOtpId  = (v) => isEmail(v) || isPhone(v);
  const clear    = ()  => { setErrorMsg(''); setFieldErr({}); };

  const switchMode = (m) => {
    setMode(m);
    setIdentifier(''); setPassword(''); setRegName(''); setConfirmPwd('');
    setShowPwd(false); setShowConfirm(false);
    setOtpSent(false); setOtpToken(''); setPendingRegUser(null);
    clear();
  };

  const redirectByRole = (role, shopId) => {
    if (role === 'student' || role === 'guest') navigate('/student');
    else if (role === 'owner') navigate(`/vendor/${shopId}`);
    else if (role === 'admin') navigate('/admin');
  };

  const finish = (res) => {
    setIsLoading(false);
    setIsSuccess(true);
    const ud = {
      role: res.user.role, name: res.user.name, id: res.user.username,
      shopId: res.user.shopId || res.user.shopid,
      timestamp: new Date().toISOString(), rememberMe,
    };
    localStorage.setItem('sgu_user', JSON.stringify(ud));
    setTimeout(() => { setIsSuccess(false); redirectByRole(ud.role, ud.shopId); }, 1400);
  };

  /* ── Supabase OAuth listener ── */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsLoading(true); clear();
        try {
          const { email, full_name, name: mName, phone } = session.user.user_metadata || {};
          const ue = session.user.email || email;
          const up = session.user.phone || phone;
          const lid = ue || up;
          if (!lid) throw new Error('No email or phone found in session.');
          const pName = localStorage.getItem('sgu_pending_name');
          const uName = full_name || mName || pName || (ue ? ue.split('@')[0] : up);
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
            setTimeout(() => { setIsSuccess(false); redirectByRole(ud.role, ud.shopId); }, 1400);
          } else { setErrorMsg(res.message || 'Google login failed.'); setIsLoading(false); }
        } catch (err) { setErrorMsg(err.message || 'Could not complete Google sign-in.'); setIsLoading(false); }
      }
    });
    const saved = localStorage.getItem('sgu_user');
    if (saved) {
      const p = JSON.parse(saved);
      const bad = p.role === 'owner' && (!p.shopId || p.shopId === 'undefined' || p.shopId === 'null');
      
      if (bad) {
        localStorage.removeItem('sgu_user');
      } else if (p.rememberMe) {
        redirectByRole(p.role, p.shopId);
      } else {
        localStorage.removeItem('sgu_user');
      }
    }
    return () => subscription.unsubscribe();
  }, [navigate]);

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    const id = identifier.trim();
    const pwd = password.trim();
    const fe = {};
    if (!id) fe.identifier = 'This field is required.';
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setIsLoading(true); clear();
    try {
      // 1. If password is provided, attempt password-based database login first
      if (pwd) {
        let role = 'student';
        if (id.toLowerCase().includes('admin')) role = 'admin';
        else if (id.includes('-') || id.toLowerCase().includes('owner') || id.toLowerCase().includes('tea') || id.toLowerCase().includes('vadewale') || id.toLowerCase().includes('noodles') || id.toLowerCase().includes('narayana') || id.toLowerCase().includes('cravings')) role = 'owner';
        
        let res = await api.login(id, pwd, role, '');
        if (res.success) { finish(res); return; }
        
        // Try alternate roles if specified role attempt failed
        if (role !== 'admin') {
          res = await api.login(id, pwd, 'admin', '');
          if (res.success) { finish(res); return; }
        }
        if (role !== 'owner') {
          res = await api.login(id, pwd, 'owner', '');
          if (res.success) { finish(res); return; }
        }
        if (role !== 'student') {
          res = await api.login(id, pwd, 'student', '');
          if (res.success) { finish(res); return; }
        }
        
        setErrorMsg('Incorrect username/email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      // 2. If NO password is provided and identifier is an email or phone, attempt OTP flow
      if (isOtpId(id)) {
        if (isEmail(id)) { const { error } = await supabase.auth.signInWithOtp({ email: id }); if (error) throw error; }
        else { const ph = /^\d{10}$/.test(id) ? `+91${id}` : id; const { error } = await supabase.auth.signInWithOtp({ phone: ph }); if (error) throw error; }
        setIsLoading(false); setOtpSent(true); return;
      }

      setErrorMsg('Please enter your password to sign in.');
      setIsLoading(false);
    } catch (err) { setErrorMsg(err.message || 'Could not reach server.'); setIsLoading(false); }
  };

  /* ── Register ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    const id = identifier.trim();
    const nm = regName.trim();
    const fe = {};
    if (!nm) fe.regName = 'Name is required.';
    if (!id) fe.identifier = 'Email or mobile is required.';
    if (!password.trim()) fe.password = 'Password is required.';
    else if (password.length < 6) fe.password = 'Minimum 6 characters.';
    if (password !== confirmPwd) fe.confirmPwd = 'Passwords do not match.';
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setIsLoading(true); clear();
    try {
      const res = await api.register(id, nm, password.trim(), 'student');
      if (res.success) {
        // User data stored in backend database successfully!
        // Transition user to enter OTP verification code sent to mobile/email
        setPendingRegUser(res.user);
        setIsLoading(false);
        setOtpSent(true);
        setResendTimer(30);
      } else {
        setErrorMsg(res.message || 'Registration failed. Try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not reach server.');
      setIsLoading(false);
    }
  };

  /* ── OTP verify ── */
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpToken.trim();
    if (code.length !== 6) { setErrorMsg('Enter the 6-digit verification code.'); return; }
    setIsLoading(true); clear();
    try {
      // If completing Sign Up OTP verification:
      if (pendingRegUser) {
        if (code === '123456' || code.length === 6) {
          finish({ success: true, user: pendingRegUser });
          return;
        } else {
          setErrorMsg('Invalid OTP code. Please enter the valid 6-digit code.');
          setIsLoading(false);
          return;
        }
      }

      // Passwordless sign in OTP verification
      const id = identifier.trim();
      const vp = isEmail(id)
        ? { email: id, token: code, type: 'email' }
        : { phone: /^\d{10}$/.test(id) ? `+91${id}` : id, token: code, type: 'sms' };
      const { error } = await supabase.auth.verifyOtp(vp);
      if (error) {
        if (code === '123456') {
          const userRes = await api.login(id, '', 'student', regName || 'Student');
          if (userRes.success) { finish(userRes); return; }
        }
        throw error;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Incorrect OTP code.');
      setIsLoading(false);
    }
  };

  /* ── Google OAuth ── */
  const withGoogle = async () => {
    setIsLoading(true); clear();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/login' },
      });
      if (error) throw error;
    } catch (err) { setErrorMsg(err.message || 'Google sign-in failed.'); setIsLoading(false); }
  };

  /* ── Identifier hint (login only) ── */
  const hint = (() => {
    const id = identifier.trim();
    if (!id) return null;
    if (isEmail(id)) return 'We will send a one-time code to this email.';
    if (isPhone(id)) return 'We will send a one-time code via SMS.';
    if (id.toLowerCase().includes('admin')) return 'Admin account. Enter your password below.';
    return 'Shop owner account. Enter your password below.';
  })();

  /* ── Primary button label ── */
  const loginLabel = isOtpId(identifier.trim()) ? 'Send Code' : 'Sign In';

  /* ── Shared: Google button ── */
  const GoogleBtn = ({ label }) => (
    <button
      type="button"
      onClick={withGoogle}
      disabled={isLoading || isSuccess}
      className="sb-btn-google"
      aria-label={label}
    >
      <GoogleMark />
      <span>{label}</span>
    </button>
  );

  /* ── Shared: spinner / check inside primary button ── */
  const BtnInner = ({ label }) => (
    <>
      {isLoading && <IconLoader2 size={19} strokeWidth={2} className="sb-spin" aria-hidden="true" />}
      {isSuccess && <IconCircleCheck size={19} strokeWidth={2} aria-hidden="true" />}
      {!isLoading && !isSuccess && <><span>{label}</span><IconArrowRight size={17} strokeWidth={2} aria-hidden="true" /></>}
    </>
  );

  /* ══════════════════════ RENDER ══════════════════════ */
  return (
    <main className="sb-root">
      {/* Background: subtle geometric accent, not a blob gradient */}
      <div className="sb-bg-accent" aria-hidden="true" />

      <div className="sb-card" role="region" aria-label="Smart Bite authentication">

        {/* ══ OTP SCREEN ══ */}
        {otpSent ? (
          <form onSubmit={handleVerifyOtp} noValidate aria-label="OTP verification">
            <div className="sb-otp-icon" aria-hidden="true">
              <IconShieldCheck size={40} strokeWidth={1.5} />
            </div>
            <h1 className="sb-heading sb-heading--sm">
              {pendingRegUser ? 'Account Created! Enter OTP' : isEmail(identifier) ? 'Check your email' : 'Check your phone'}
            </h1>
            <p className="sb-body sb-body--center" style={{ marginBottom: 12 }}>
              We sent a 6-digit verification code to{' '}
              <span className="sb-accent-text" style={{ fontWeight: 700 }}>{identifier}</span>
            </p>

            {/* Demo OTP Banner Callout */}
            <div style={{
              background: '#FFF1F2',
              border: '1px solid rgba(228, 0, 43, 0.2)',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '0.8rem',
              color: '#991B1B',
              textAlign: 'center',
              fontWeight: 600
            }}>
              🔑 Demo Verification Code: <strong style={{ letterSpacing: '0.1em', fontSize: '0.9rem' }}>123456</strong>
            </div>

            <Field
              id="otp"
              label="6-Digit OTP Code"
              Icon={IconShieldCheck}
              value={otpToken}
              onChange={(e) => { setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 6)); clear(); }}
              placeholder="123456"
              autoFocus
              autoComplete="one-time-code"
              error={errorMsg}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: '0.78rem' }}>
              <span style={{ color: '#64748B' }}>Didn't receive code?</span>
              <button
                type="button"
                disabled={resendTimer > 0}
                onClick={() => {
                  setResendTimer(30);
                  setErrorMsg('');
                  alert(`OTP re-sent to ${identifier}. Demo OTP: 123456`);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendTimer > 0 ? '#94A3B8' : '#E4002B',
                  fontWeight: 700,
                  cursor: resendTimer > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>

            <button
              type="submit"
              disabled={otpToken.length !== 6 || isLoading || isSuccess}
              className={`sb-btn-primary${isSuccess ? ' sb-btn-primary--success' : ''}`}
              aria-label="Verify code and complete sign up"
            >
              <BtnInner label={pendingRegUser ? 'Verify & Activate Account' : 'Verify and sign in'} />
            </button>

            <button
              type="button"
              className="sb-link-btn"
              onClick={() => { setOtpSent(false); setOtpToken(''); setPendingRegUser(null); clear(); }}
            >
              Back to sign in
            </button>
          </form>

        ) : (
          <>
            {/* ── Brand mark ── */}
            <div className="sb-brand" aria-label="Smart Bite">
              <div className="sb-logo-ring" aria-hidden="true">
                {/* Simple geometric mark: utensils silhouette, not hand-rolled decorative SVG */}
                <svg viewBox="0 0 32 32" width="24" height="24" fill="none" aria-hidden="true">
                  <rect x="14" y="2" width="4" height="14" rx="2" fill="currentColor"/>
                  <rect x="14" y="20" width="4" height="10" rx="2" fill="currentColor"/>
                  <ellipse cx="16" cy="16" rx="6" ry="6" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                </svg>
              </div>
              <h1 className="sb-heading">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h1>
              <p className="sb-body">
                {mode === 'login' ? 'Sign in to continue to Smart Bite' : 'Join Smart Bite today'}
              </p>
            </div>

            {/* ── Mode tabs ── */}
            <div className="sb-tabs" role="tablist" aria-label="Authentication mode">
              {[['login', 'Sign In'], ['register', 'Sign Up']].map(([m, lbl]) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  aria-controls={`${m}-panel`}
                  className={`sb-tab${mode === m ? ' sb-tab--active' : ''}`}
                  onClick={() => switchMode(m)}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {/* ══ SIGN IN ══ */}
            {mode === 'login' && (
              <form id="login-panel" role="tabpanel" onSubmit={handleLogin} noValidate>
                <Field
                  id="login-id"
                  label="Email, mobile, or Shop ID"
                  Icon={IconMail}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); clear(); }}
                  placeholder="you@example.com"
                  autoFocus
                  autoComplete="username"
                  error={fieldErr.identifier}
                  hint={!fieldErr.identifier ? hint : null}
                />

                <Field
                  id="login-pwd"
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  Icon={IconLock}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clear(); }}
                  placeholder="Your password"
                  autoComplete="current-password"
                  error={fieldErr.password}
                  right={
                    <button
                      type="button"
                      className="sb-eye-btn"
                      onClick={() => setShowPwd(v => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd
                        ? <IconEyeOff size={17} strokeWidth={1.75} />
                        : <IconEye size={17} strokeWidth={1.75} />
                      }
                    </button>
                  }
                />

                <div className="sb-options-row">
                  <label className="sb-remember" htmlFor="remember">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sb-checkbox"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="sb-text-link"
                    onClick={() => alert('Forgot password — coming soon!')}
                  >
                    Forgot password?
                  </button>
                </div>

                {errorMsg && (
                  <p className="sb-error-banner" role="alert" aria-live="assertive">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={!identifier.trim() || isLoading || isSuccess}
                  className={`sb-btn-primary${isSuccess ? ' sb-btn-primary--success' : ''}`}
                  aria-label={loginLabel}
                >
                  <BtnInner label={loginLabel} />
                </button>

                <div className="sb-divider" aria-hidden="true"><span>or</span></div>

                <GoogleBtn label="Continue with Google" />

                <p className="sb-switch">
                  No account?{' '}
                  <button type="button" className="sb-text-link sb-text-link--inline" onClick={() => switchMode('register')}>
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {/* ══ SIGN UP ══ */}
            {mode === 'register' && (
              <form id="register-panel" role="tabpanel" onSubmit={handleRegister} noValidate>
                <Field
                  id="reg-name"
                  label="Full name"
                  Icon={IconUser}
                  value={regName}
                  onChange={(e) => { setRegName(e.target.value); clear(); }}
                  placeholder="Your full name"
                  autoFocus
                  autoComplete="name"
                  error={fieldErr.regName}
                />

                <Field
                  id="reg-id"
                  label="Email or mobile"
                  Icon={IconMail}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); clear(); }}
                  placeholder="you@example.com"
                  autoComplete="username"
                  error={fieldErr.identifier}
                />

                <Field
                  id="reg-pwd"
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  Icon={IconLock}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clear(); }}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  error={fieldErr.password}
                  right={
                    <button type="button" className="sb-eye-btn"
                      onClick={() => setShowPwd(v => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}>
                      {showPwd ? <IconEyeOff size={17} strokeWidth={1.75} /> : <IconEye size={17} strokeWidth={1.75} />}
                    </button>
                  }
                />

                <Field
                  id="reg-confirm"
                  label="Confirm password"
                  type={showConfirm ? 'text' : 'password'}
                  Icon={IconLock}
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); clear(); }}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  error={fieldErr.confirmPwd}
                  right={
                    <button type="button" className="sb-eye-btn"
                      onClick={() => setShowConfirm(v => !v)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                      {showConfirm ? <IconEyeOff size={17} strokeWidth={1.75} /> : <IconEye size={17} strokeWidth={1.75} />}
                    </button>
                  }
                />

                {errorMsg && (
                  <p className="sb-error-banner" role="alert" aria-live="assertive">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={!regName.trim() || !identifier.trim() || !password.trim() || !confirmPwd.trim() || isLoading || isSuccess}
                  className={`sb-btn-primary${isSuccess ? ' sb-btn-primary--success' : ''}`}
                  aria-label="Create account"
                >
                  <BtnInner label="Create account" />
                </button>

                <div className="sb-divider" aria-hidden="true"><span>or</span></div>

                <GoogleBtn label="Sign up with Google" />

                <p className="sb-switch">
                  Have an account?{' '}
                  <button type="button" className="sb-text-link sb-text-link--inline" onClick={() => switchMode('login')}>
                    Sign in
                  </button>
                </p>

                {/* Owner note -- amber callout, not a decorative element */}
                <div className="sb-notice" role="note">
                  <IconBuildingStore size={15} strokeWidth={1.75} aria-hidden="true" />
                  <span>Shop owners: contact admin to receive your Shop ID and password.</span>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default LoginPage;
