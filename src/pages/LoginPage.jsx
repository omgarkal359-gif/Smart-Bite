import React, { useState, useEffect } from 'react';
import {
  IconMail, IconLock, IconUser, IconEye, IconEyeOff,
  IconLoader2, IconCircleCheck, IconArrowRight,
  IconBrandGoogle, IconShieldCheck, IconBuildingStore
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
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

  const navigate = useNavigate();

  /* ── Auto-reset loading state if login process is terminated or timed out ── */
  useEffect(() => {
    let timeout;
    if (isLoading && !isSuccess) {
      timeout = setTimeout(() => {
        setIsLoading(false);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [isLoading, isSuccess]);

  /* ── helpers ── */
  const isEmail  = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhone  = (v) => /^\d{10}$/.test(v) || /^\+\d{10,12}$/.test(v);
  const clear    = ()  => { setErrorMsg(''); setFieldErr({}); };

  const switchMode = (m) => {
    setMode(m);
    setIdentifier(''); setPassword(''); setRegName(''); setConfirmPwd('');
    setShowPwd(false); setShowConfirm(false);
    clear();
  };

  const redirectByRole = (role, shopId) => {
    if (role === 'student' || role === 'guest') navigate('/student');
    else if (role === 'owner') navigate(`/vendor/${shopId}`);
    else if (role === 'admin') navigate('/admin');
  };

  const finish = (role, name, id, shopId = null) => {
    setIsLoading(false);
    setIsSuccess(true);
    const ud = {
      role: role || 'student',
      name: name || 'Student',
      id: id || 'student',
      shopId: shopId || null,
      timestamp: new Date().toISOString(),
      rememberMe,
    };
    localStorage.setItem('sgu_user', JSON.stringify(ud));
    setTimeout(() => { setIsSuccess(false); redirectByRole(ud.role, ud.shopId); }, 1400);
  };

  /* ── Supabase OAuth listener ── */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const meta = session.user.user_metadata || {};
        const role = meta.role || session.user.app_metadata?.role || 'student';
        const name = meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Student';
        const id = session.user.email || session.user.phone || session.user.id;
        const shopId = meta.shopId || null;
        finish(role, name, id, shopId);
      }
    });
    const saved = localStorage.getItem('sgu_user');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p && p.role) {
          const bad = p.role === 'owner' && (!p.shopId || p.shopId === 'undefined' || p.shopId === 'null');
          if (bad) {
            localStorage.removeItem('sgu_user');
          } else if (p.rememberMe) {
            redirectByRole(p.role, p.shopId);
          } else {
            localStorage.removeItem('sgu_user');
          }
        } else {
          localStorage.removeItem('sgu_user');
        }
      } catch (err) {
        localStorage.removeItem('sgu_user');
      }
    }
    return () => subscription.unsubscribe();
  }, [navigate]);

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = identifier.trim();
    const pwd = password.trim();
    const fe = {};
    if (!email) fe.identifier = 'This field is required.';
    if (!pwd) fe.password = 'Password is required.';
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setIsLoading(true); clear();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) throw error;
      const meta = data.user?.user_metadata || {};
      const role = meta.role || data.user?.app_metadata?.role || 'student';
      const name = meta.full_name || meta.name || email.split('@')[0] || 'Student';
      const shopId = meta.shopId || null;
      finish(role, name, email, shopId);
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect email or password.');
      setIsLoading(false);
    }
  };

  /* ── Register ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    const email = identifier.trim();
    const nm = regName.trim();
    const fe = {};
    if (!nm) fe.regName = 'Name is required.';
    if (!email) fe.identifier = 'Email is required.';
    if (!password.trim()) fe.password = 'Password is required.';
    else if (password.length < 6) fe.password = 'Minimum 6 characters.';
    if (password !== confirmPwd) fe.confirmPwd = 'Passwords do not match.';
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setIsLoading(true); clear();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password.trim(),
        options: { data: { full_name: nm, role: 'student' } }
      });
      if (error) throw error;
      if (data.user) {
        finish('student', nm, email, null);
      } else {
        setErrorMsg('Check your email to confirm your account.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Try again.');
      setIsLoading(false);
    }
  };

  /* ── Google OAuth ── */
  const withGoogle = async (isSignUpMode = false) => {
    setIsLoading(true); clear();
    if (isSignUpMode || mode === 'register') {
      localStorage.setItem('sgu_is_signup', 'true');
    } else {
      localStorage.removeItem('sgu_is_signup');
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/login',
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline'
          }
        },
      });
      if (error) throw error;
    } catch (err) { setErrorMsg(err.message || 'Google sign-in failed.'); setIsLoading(false); }
  };

  /* ── Identifier hint (login only) ── */
  const hint = (() => {
    const id = identifier.trim();
    if (!id) return null;
    if (isEmail(id)) return 'Enter your password below to sign in.';
    if (isPhone(id)) return 'Enter your password below to sign in.';
    if (id.toLowerCase().includes('admin')) return 'Admin account. Enter your password below.';
    return 'Shop owner account. Enter your password below.';
  })();

  /* ── Primary button label ── */
  const loginLabel = 'Sign In';

  /* ── Shared: Google button ── */
  const GoogleBtn = ({ label, isSignUp }) => (
    <button
      type="button"
      onClick={() => {
        setIsLoading(true);
        withGoogle(isSignUp);
        setTimeout(() => setIsLoading(false), 4000);
      }}
      disabled={isSuccess}
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
                    onClick={() => navigate('/forgot-password')}
                  >
                    Forgot password?
                  </button>
                </div>

                {errorMsg && (
                  <p className="sb-error-banner" role="alert" aria-live="assertive">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  onClick={() => { if (isLoading) setIsLoading(false); }}
                  disabled={!identifier.trim() || isSuccess}
                  className={`sb-btn-primary${isSuccess ? ' sb-btn-primary--success' : ''}`}
                  aria-label={loginLabel}
                >
                  <BtnInner label={loginLabel} />
                </button>

                <div className="sb-divider" aria-hidden="true"><span>or</span></div>

                <GoogleBtn label="Continue with Google" isSignUp={false} />

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
                  onClick={() => { if (isLoading) setIsLoading(false); }}
                  disabled={!regName.trim() || !identifier.trim() || !password.trim() || !confirmPwd.trim() || isSuccess}
                  className={`sb-btn-primary${isSuccess ? ' sb-btn-primary--success' : ''}`}
                  aria-label="Create account"
                >
                  <BtnInner label="Create account" />
                </button>

                <div className="sb-divider" aria-hidden="true"><span>or</span></div>

                <GoogleBtn label="Sign up with Google" isSignUp={true} />

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
      </div>
    </main>
  );
};

export default LoginPage;
