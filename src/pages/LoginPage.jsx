import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  IconLoader2, IconBuildingStore, IconLock, IconMail,
  IconBolt, IconShieldCheck, IconToolsKitchen2, IconMailCheck, IconArrowRight,
  IconSchool, IconClock, IconBell
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { setStoredUser, clearStoredUser, isAdminEmail } from '../utils/auth';
import { api } from '../api';
import { addAuditLog } from '../utils/logger';
import './LoginPage.css';

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);

  const [staffId, setStaffId] = useState('');
  const [staffPwd, setStaffPwd] = useState('');

  const navigate = useNavigate();

  // Make body & html transparent so background image is 100% visible
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = 'transparent';
    document.body.style.background = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    document.documentElement.style.background = 'transparent';

    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.body.style.background = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.documentElement.style.background = prevHtmlBg;
    };
  }, []);

  const redirectByRole = useCallback((role, shopId) => {
    if (role === 'student' || role === 'guest') navigate('/student');
    else if (role === 'vendor') navigate(shopId ? `/vendor/${shopId}` : '/vendor');
    else if (role === 'admin') navigate('/admin');
  }, [navigate]);

  const finish = useCallback((role, name, id, shopId = null, token = null) => {
    setIsLoading(false);
    setIsSuccess(true);
    const ud = {
      role: role || 'student',
      name: name || 'Student',
      id: id || 'student',
      shopId: shopId || null,
      timestamp: new Date().toISOString(),
    };
    if (token) {
      localStorage.setItem('sgu_token', token);
      sessionStorage.setItem('sgu_token', token);
    }
    setStoredUser(ud, true);

    try {
      const level = ud.role === 'admin' ? 'SECURITY' : 'INFO';
      addAuditLog({
        level,
        category: 'Auth',
        message: `${ud.role === 'admin' ? 'Super Admin' : ud.role === 'vendor' ? 'Vendor Owner' : 'Student'} login session initialized for "${ud.name}" (${ud.id})`
      });
    } catch (e) {}

    setTimeout(() => {
      setIsSuccess(false);
      redirectByRole(ud.role, ud.shopId);
    }, 1200);
  }, [redirectByRole]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    localStorage.setItem('sgu_google_oauth_started', 'true');

    const timeoutId = setTimeout(() => {
      if (localStorage.getItem('sgu_google_oauth_started') === 'true') {
        localStorage.removeItem('sgu_google_oauth_started');
        setIsLoading(false);
        setErrorMsg('Login failed or was cancelled. Please try again.');
      }
    }, 6000);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: 'select_account', access_type: 'offline' }
        }
      });
      if (error) {
        clearTimeout(timeoutId);
        localStorage.removeItem('sgu_google_oauth_started');
        setIsLoading(false);
        setErrorMsg(error.message || 'Failed to initialize Google Sign In');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      localStorage.removeItem('sgu_google_oauth_started');
      setIsLoading(false);
      setErrorMsg('Unexpected error during sign-in.');
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    if (!staffId.trim() || !staffPwd.trim()) {
      setErrorMsg('Please enter both Staff ID and Password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.loginStaff(staffId.trim(), staffPwd.trim());
      if (res && res.success && res.user) {
        finish(res.user.role, res.user.name, res.user.id, res.user.shopId, res.token || null);
      } else {
        setIsLoading(false);
        setErrorMsg(res?.message || 'Invalid staff credentials.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Invalid staff credentials.');
    }
  };

  useEffect(() => {
    const handleWindowFocus = () => {
      const oauthStarted = localStorage.getItem('sgu_google_oauth_started');
      if (oauthStarted === 'true') {
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            localStorage.removeItem('sgu_google_oauth_started');
            setIsLoading(false);
          }
        }, 1500);
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        localStorage.removeItem('sgu_google_oauth_started');
        const userEmail = session.user.email || '';
        const meta = session.user.user_metadata || {};

        let profile = null;
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          if (!error && data) profile = data;
        } catch (_e) {}

        const role = profile?.role || (isAdminEmail(userEmail) ? 'admin' : (meta.role || 'student'));

        const isAllowedDomain = (email, userRole) => {
          if (userRole === 'admin' || userRole === 'vendor') return true;
          if (isAdminEmail(email)) return true;
          return true;
        };

        if (!isAllowedDomain(userEmail, role)) {
          setErrorMsg('Access Restricted: Only authorized accounts and @sguk.ac.in email addresses are allowed.');
          await supabase.auth.signOut();
          clearStoredUser();
          setIsLoading(false);
          return;
        }

        const name = profile?.full_name || meta.full_name || meta.name || userEmail.split('@')[0] || (role === 'admin' ? 'System Admin' : 'Student');
        const id = userEmail || session.user.phone || session.user.id;
        const shopId = profile?.shop_id || meta.shopId || null;

        try { await api.loginGoogle(id, name).catch(() => null); } catch (_e) {}
        finish(role, name, id, shopId, session.access_token);
      }
    });

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      subscription.unsubscribe();
    };
  }, [finish, redirectByRole]);

  return (
    <>
      {/* Portal: renders background image directly on document.body */}
      {ReactDOM.createPortal(
        <>
          <img
            src="/login-bg.jpg"
            alt="SGU Canteen Background"
            className="sb-bg-image"
            aria-hidden="true"
          />
          <div className="sb-bg-overlay" aria-hidden="true" />
        </>,
        document.body
      )}

      <main className="sb-root">
        <div className="sb-viewport-wrapper">

          {/* LEFT: HERO */}
          <section className="sb-left-hero">
            <h1 className="sb-hero-title">
              Make Your Time Count:<br />
              <span className="sb-hero-accent-red">Eat, Don’t Wait.</span>
            </h1>

            <p className="sb-hero-subtitle">
              Order right from your phone between lectures! Freshly prepared, sizzling hot, and ready for pickup before you even reach the food court.
            </p>

            <div className="sb-highlights-grid">
              <div className="sb-hl-card red">
                <div className="sb-hl-icon-box red">
                  <IconClock size={20} />
                </div>
                <div className="sb-hl-text-wrap">
                  <div className="sb-hl-title">Order in under 2 mins</div>
                  <div className="sb-hl-desc">Instant 1–tap checkout</div>
                </div>
              </div>

              <div className="sb-hl-card amber">
                <div className="sb-hl-icon-box amber">
                  <IconBell size={20} />
                </div>
                <div className="sb-hl-text-wrap">
                  <div className="sb-hl-title">Instant Pickup Alerts</div>
                  <div className="sb-hl-desc">Get notified when ready</div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: LOGIN CARD */}
          <aside className="sb-right-card-wrapper">
            <div className="sb-glass-card-compact" role="region" aria-label="Student Portal Sign-In">

              <div className="sb-card-brand-header">
                <div className="sb-brand-logo-container">
                  <img src="/smartbite-logo.png" alt="Smart Bite Logo" className="sb-brand-logo-img" />
                </div>
                <h2 className="sb-card-title">Sign in to Smart Bite</h2>
                <p className="sb-card-subtext">Order food at SGU canteen</p>
              </div>

              {errorMsg && (
                <div className="sb-error-banner" role="alert" aria-live="assertive">
                  {typeof errorMsg === 'string' && errorMsg !== '{}' ? errorMsg : 'Invalid login credentials.'}
                </div>
              )}

              <div className="sb-cta-area">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading || isSuccess}
                  className="sb-btn-google-glass"
                  aria-label="Sign in with Google"
                >
                  {isLoading ? (
                    <IconLoader2 size={18} className="sb-spin" />
                  ) : (
                    <div className="sb-btn-left">
                      <svg className="sb-google-svg" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>{isSuccess ? 'Signing in...' : 'Continue with Google'}</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Teal left-border access indicator */}
              <div className="sb-security-tag">
                <IconShieldCheck size={15} />
                <span>Verified SGU student access</span>
              </div>

              {/* Informational note */}
              <div className="sb-card-footer-note">
                <IconMailCheck size={15} className="sb-note-icon" />
                <span className="sb-note-text">
                  Sign in with your <strong>authorized university email</strong> to access the canteen portal.
                </span>
              </div>

              {/* Staff / Vendor toggle button & form centered above the last line */}
              <div className="sb-staff-toggle-wrapper">
                {!showStaffLogin ? (
                  <button
                    type="button"
                    onClick={() => setShowStaffLogin(true)}
                    className="sb-btn-staff-visible"
                    aria-label="Staff and vendor portal login"
                  >
                    <IconBuildingStore size={16} />
                    <span>Staff & Vendor Login</span>
                  </button>
                ) : (
                  <div className="sb-staff-section">
                    <form onSubmit={handleStaffLogin} className="sb-staff-form">
                      <div className="sb-field">
                        <label className="sb-field-label" htmlFor="staff-id">Email or Username</label>
                        <div className="sb-field-wrap">
                          <IconMail className="sb-field-icon" size={15} />
                          <input
                            id="staff-id"
                            type="text"
                            value={staffId}
                            onChange={(e) => setStaffId(e.target.value)}
                            placeholder="vendor@sgu.edu or admin"
                            className="sb-field-input"
                          />
                        </div>
                      </div>

                      <div className="sb-field">
                        <label className="sb-field-label" htmlFor="staff-pwd">Password</label>
                        <div className="sb-field-wrap">
                          <IconLock className="sb-field-icon" size={15} />
                          <input
                            id="staff-pwd"
                            type="password"
                            value={staffPwd}
                            onChange={(e) => setStaffPwd(e.target.value)}
                            placeholder="Enter password"
                            className="sb-field-input"
                          />
                        </div>
                      </div>

                      <button type="submit" disabled={isLoading} className="sb-btn-primary">
                        <span>Sign in</span>
                        <IconArrowRight size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowStaffLogin(false); setStaffId(''); setStaffPwd(''); setErrorMsg(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--sb-txt-lo)', fontSize: '0.73rem', cursor: 'pointer', marginTop: 8, display: 'block', margin: '8px auto 0' }}
                      >
                        Back to student sign-in
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Perks / Trust footer row */}
              <div className="sb-perks-row">
                <div className="sb-perk-item">
                  <IconBolt size={14} />
                  <span>Ready on arrival</span>
                </div>
                <div className="sb-perk-item teal">
                  <IconShieldCheck size={14} />
                  <span>Secure payment</span>
                </div>
                <div className="sb-perk-item">
                  <IconToolsKitchen2 size={14} />
                  <span>Freshly prepared</span>
                </div>
              </div>

            </div>
          </aside>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
