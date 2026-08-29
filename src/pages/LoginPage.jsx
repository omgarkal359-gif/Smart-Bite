import React, { useState, useEffect } from 'react';
import {
  IconMail, IconLock, IconUser, IconEye, IconEyeOff,
  IconLoader2, IconCircleCheck, IconArrowRight,
  IconBrandGoogle, IconShieldCheck, IconBuildingStore
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { setStoredUser, getStoredUser, clearStoredUser } from '../utils/auth';
import { GoogleIcon } from '../components/icons/GoogleIcon';
import { api } from '../api';
import sguLogo from '../assets/sgu-logo.jpg';
import { GoogleMarkIcon } from '../components/icons';
import './LoginPage.css';

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



  const finish = (role, name, id, shopId = null, token = null) => {
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
    if (token) {
      if (rememberMe) {
        localStorage.setItem('sgu_token', token);
      } else {
        sessionStorage.setItem('sgu_token', token);
      }
    }
    setStoredUser(ud, rememberMe);
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
    const saved = getStoredUser();
    if (saved && saved.role) {
      const bad = saved.role === 'owner' && (!saved.shopId || saved.shopId === 'undefined' || saved.shopId === 'null');
      if (bad) {
        clearStoredUser();
      } else {
        redirectByRole(saved.role, saved.shopId);
      }
    }
    return () => subscription.unsubscribe();
  }, [navigate]);

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    const idInput = identifier.trim();
    const pwd = password.trim();
    const fe = {};
    if (!idInput) fe.identifier = 'This field is required.';
    if (!pwd && idInput !== '9876543210') fe.password = 'Password is required.';
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setIsLoading(true); clear();

    // 1. Try Supabase Auth sign-in if identifier is an email
    if (isEmail(idInput)) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: idInput, password: pwd });
        if (!error && data?.user) {
          // Sync login with backend
          const syncRes = await api.loginGoogle(idInput, data.user.user_metadata?.full_name || idInput.split('@')[0]);
          if (syncRes?.success && syncRes?.user) {
            const user = syncRes.user;
            finish(user.role, user.name, user.username, user.shopId, syncRes.token);
            return;
          }
        }
      } catch (err) {
        // Fall back to backend API direct login
      }
    }

    // 2. Direct Backend API Login
    try {
      let assumedRole = 'student';
      const lowerId = idInput.toLowerCase();
      if (lowerId === 'admin' || lowerId.startsWith('admin@')) assumedRole = 'admin';
      else if (['mangales-snacks', 'tea-coffee', 'rohit-vadewale', 'oodles-of-noodles', 'narayana', 'cool-cravings'].includes(lowerId)) assumedRole = 'owner';
      else if (lowerId === '9876543210') assumedRole = 'guest';

      const resData = await api.login(idInput, pwd, assumedRole);
      if (resData?.success && resData?.user) {
        const user = resData.user;
        finish(user.role, user.name, user.username, user.shopId, resData.token);
      } else {
        setErrorMsg('Invalid username or password.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  /* ── Register ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    const emailOrId = identifier.trim();
    const nm = regName.trim();
    const pwd = password.trim();
    const fe = {};
    if (!nm) fe.regName = 'Name is required.';
    if (!emailOrId) fe.identifier = 'Email or User ID is required.';
    if (!pwd) fe.password = 'Password is required.';
    else if (pwd.length < 6) fe.password = 'Minimum 6 characters.';
    if (pwd !== confirmPwd.trim()) fe.confirmPwd = 'Passwords do not match.';
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setIsLoading(true); clear();

    // 1. Try Supabase Auth Sign Up if it's a valid email format
    if (isEmail(emailOrId)) {
      try {
        await supabase.auth.signUp({
          email: emailOrId,
          password: pwd,
          options: { data: { full_name: nm, role: 'student' } }
        });
      } catch (err) {
        // Let backend register
      }
    }

    // 2. Direct Backend API Registration
    try {
      const resData = await api.register(emailOrId, nm, pwd, 'student');
      if (resData?.success && resData?.user) {
        const user = resData.user;
        finish(user.role, user.name, user.username, user.shopId);
      } else {
        setErrorMsg('Registration failed.');
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Username may already be taken.');
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
      <GoogleIcon />
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
                <img src={sguLogo} alt="SGU Logo" className="sb-sgu-logo-img" />
              </div>
              {mode === 'register' && (
                <h1 className="sb-heading">Create account</h1>
              )}
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
