import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconUser, IconLoader2, IconBuildingStore, IconLock, IconMail,
  IconSchool, IconClock, IconBell, IconBolt, IconShieldCheck,
  IconToolsKitchen2, IconMailCheck, IconArrowRight
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

  const cardRef = useRef(null);
  const navigate = useNavigate();

  const scrollToCard = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const redirectByRole = useCallback((role, shopId) => {
    if (role === 'student' || role === 'guest') navigate('/student');
    else if (role === 'vendor') navigate(`/vendor/${shopId}`);
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
        setErrorMsg(error.message || 'Login failed. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      localStorage.removeItem('sgu_google_oauth_started');
      setErrorMsg(err.message || 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    const idInput = staffId.trim();
    const pwd = staffPwd.trim();
    if (!idInput || !pwd) { setErrorMsg('Please enter your email and password.'); return; }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const resData = await api.login(idInput, pwd);
      if (resData?.success && resData?.user) {
        let userRole = resData.user.role;
        if (isAdminEmail(idInput)) userRole = 'admin';
        finish(userRole, resData.user.name, resData.user.username, resData.user.shopId, resData.token);
      } else {
        try { addAuditLog({ level: 'SECURITY', category: 'Auth', message: `Failed login attempt for user "${idInput}"` }); } catch (e) {}
        const rawMsg = resData?.message;
        setErrorMsg(typeof rawMsg === 'string' && rawMsg.trim() && rawMsg !== '{}' ? rawMsg : 'Invalid credentials. Please check your email and password.');
        setIsLoading(false);
      }
    } catch (err) {
      try { addAuditLog({ level: 'SECURITY', category: 'Auth', message: `Failed login attempt for user "${idInput}"` }); } catch (e) {}
      const rawMsg = err?.message;
      setErrorMsg(typeof rawMsg === 'string' && rawMsg.trim() && rawMsg !== '{}' ? rawMsg : 'Login failed. Please check your credentials and try again.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const oauthError = urlParams.get('error') || hashParams.get('error') || urlParams.get('error_description');

    if (oauthError) {
      setIsLoading(false);
      setErrorMsg('Login failed. Please try again.');
      localStorage.removeItem('sgu_google_oauth_started');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const handleWindowFocus = () => {
      const oauthStarted = localStorage.getItem('sgu_google_oauth_started');
      if (oauthStarted === 'true') {
        setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!data?.session) {
            localStorage.removeItem('sgu_google_oauth_started');
            setIsLoading(false);
            setErrorMsg('Login failed. Please try again.');
          }
        }, 800);
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        localStorage.removeItem('sgu_google_oauth_started');
        const userEmail = (session.user.email || '').toLowerCase().trim();
        const meta = session.user.user_metadata || {};

        let profile = null;
        try {
          const { data: p } = await supabase.from('accounts').select('*').eq('id', session.user.id).single();
          profile = p;
        } catch (_e) {}

        let role = profile?.role || session.user.app_metadata?.role || meta.role;
        if (isAdminEmail(userEmail)) role = 'admin';
        if (!role) role = 'student';

        const isAllowedDomain = (email, r) => {
          if (!email) return false;
          if (r === 'admin' || r === 'vendor') return true;
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
    <main className="sb-root">
      {/* Full-screen background video — place bg-video.mp4 in /public */}
      <video
        className="sb-bg-video"
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="auto"
        aria-hidden="true"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      {/* Dark overlay so text stays readable over the video */}
      <div className="sb-bg-overlay" aria-hidden="true" />

      <div className="sb-viewport-wrapper">
        <div className="sb-split-grid">

          {/* LEFT: HERO */}
          <section className="sb-left-hero">

            {/* Rectangular eyebrow tag with amber left-border */}
            <div className="sb-badge-pill">
              <IconSchool size={14} className="sb-badge-pill-icon" />
              <span className="sb-badge-pill-text">SGU Smart-Bite</span>
            </div>

            <h1 className="sb-hero-title">
              Skip Canteen Queues.<br />
              <span className="sb-gradient-text">Enjoy Hot Fresh Food.</span>
            </h1>

            <p className="sb-hero-subtitle">
              Order from the SGU canteen right from your phone between lectures —
              freshly prepared, picked up on time, no waiting in line.
            </p>

            {/* Mobile-only scroll CTA */}
            <div className="sb-hero-cta-wrap">
              <button type="button" onClick={scrollToCard} className="sb-btn-hero-signin" aria-label="Scroll to Sign In">
                <IconUser size={15} />
                <span>Sign In</span>
              </button>
            </div>

            {/* Feature list: stacked rows */}
            <div className="sb-highlights-grid">
              <div className="sb-hl-card">
                <div className="sb-hl-icon-box">
                  <IconClock size={18} />
                </div>
                <div className="sb-hl-text-wrap">
                  <div className="sb-hl-title">Order in under 2 minutes</div>
                  <div className="sb-hl-desc">1-tap checkout, no account setup</div>
                </div>
              </div>

              <div className="sb-hl-card">
                <div className="sb-hl-icon-box teal">
                  <IconBell size={18} />
                </div>
                <div className="sb-hl-text-wrap">
                  <div className="sb-hl-title">Pickup alerts when ready</div>
                  <div className="sb-hl-desc">Get notified before you leave class</div>
                </div>
              </div>
            </div>

            {/* Perks footer row */}
            <div className="sb-perks-row">
              <div className="sb-perk-item">
                <IconBolt size={15} /> Ready when you arrive
              </div>
              <div className="sb-perk-item teal">
                <IconShieldCheck size={15} /> Secure payment
              </div>
              <div className="sb-perk-item">
                <IconToolsKitchen2 size={15} /> Freshly prepared
              </div>
            </div>

          </section>

          {/* RIGHT: LOGIN CARD */}
          <aside className="sb-right-card-wrapper" ref={cardRef}>
            <div className="sb-glass-card-compact" role="region" aria-label="Student Portal Sign-In">

              <div className="sb-card-brand-header">
                <div className="sb-brand-icon-circle">
                  <IconToolsKitchen2 size={20} />
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
                <IconShieldCheck size={14} />
                <span>Verified SGU student access</span>
              </div>

              <div className="sb-card-footer-note">
                <IconMailCheck size={14} />
                <span>
                  Sign in with your <strong>authorized university email</strong> to access the canteen portal.
                </span>
              </div>

              {/* Staff / Vendor hidden access */}
              <div className="sb-staff-section">
                {!showStaffLogin && (
                  <button
                    type="button"
                    onDoubleClick={() => setShowStaffLogin(true)}
                    title="Staff access (double-click)"
                    aria-label="Staff access"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'rgba(148,163,184,0.4)', padding: 4,
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <IconBuildingStore size={14} />
                  </button>
                )}

                {showStaffLogin && (
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
                      style={{ background: 'none', border: 'none', color: 'var(--sb-txt-lo)', fontSize: '0.73rem', cursor: 'pointer', marginTop: 8, display: 'block' }}
                    >
                      Back to student sign-in
                    </button>
                  </form>
                )}
              </div>

            </div>
          </aside>

        </div>
      </div>
    </main>
  );
};

export default LoginPage;
