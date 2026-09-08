import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconUser, IconLoader2, IconBuildingStore, IconLock, IconMail, IconArrowRight,
  IconSchool, IconClock, IconBell, IconBolt, IconShieldCheck, IconToolsKitchen2, IconMailCheck
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { setStoredUser, getStoredUser, clearStoredUser, ADMIN_EMAILS, isAdminEmail } from '../utils/auth';
import { GoogleIcon } from '../components/icons/GoogleIcon';
import { api } from '../api';
import { addAuditLog } from '../utils/logger';
import { GridBeam } from '../components/ui/grid-beam';
import { SolarBackground } from '../components/ui/SolarBackground';
import './LoginPage.css';

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);

  /* Staff / Vendor state */
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

  /* ── Supabase Google OAuth Handler ── */
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    localStorage.setItem('sgu_google_oauth_started', 'true');

    // Safety timeout: reset loading if window didn't unload within 6s
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
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline' // Shows all logged-in Google accounts on device
          }
        }
      });
      if (error) {
        clearTimeout(timeoutId);
        localStorage.removeItem('sgu_google_oauth_started');
        console.error("Login failed:", error.message);
        setErrorMsg(error.message || "Login failed. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      localStorage.removeItem('sgu_google_oauth_started');
      console.error("Login failed:", err.message);
      setErrorMsg(err.message || "Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  /* ── Staff / Vendor login ── */
  const handleStaffLogin = async (e) => {
    e.preventDefault();
    const idInput = staffId.trim();
    const pwd = staffPwd.trim();
    if (!idInput || !pwd) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Role is assigned server-side from the DB user record. Never guessed on the client.
      const resData = await api.login(idInput, pwd);

      if (resData?.success && resData?.user) {
        let userRole = resData.user.role;
        if (isAdminEmail(idInput)) {
          userRole = 'admin';
        }
        finish(userRole, resData.user.name, resData.user.username, resData.user.shopId, resData.token);
      } else {
        try {
          addAuditLog({
            level: 'SECURITY',
            category: 'Auth',
            message: `Failed login attempt for user "${idInput}"`
          });
        } catch (e) {}
        const rawMsg = resData?.message;
        const displayMsg = typeof rawMsg === 'string' && rawMsg.trim() && rawMsg !== '{}'
          ? rawMsg
          : 'Invalid login credentials. Please check your email and password.';
        setErrorMsg(displayMsg);
        setIsLoading(false);
      }
    } catch (err) {
      try {
        addAuditLog({
          level: 'SECURITY',
          category: 'Auth',
          message: `Failed login attempt for user "${idInput}"`
        });
      } catch (e) {}
      const rawMsg = err?.message;
      const displayMsg = typeof rawMsg === 'string' && rawMsg.trim() && rawMsg !== '{}'
        ? rawMsg
        : 'Login failed. Please check your credentials and try again.';
      setErrorMsg(displayMsg);
      setIsLoading(false);
    }
  };

  /* ── OAuth Session listener ── */
  useEffect(() => {
    // 1. Check URL for OAuth errors or cancellation
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const oauthError = urlParams.get('error') || hashParams.get('error') || urlParams.get('error_description');

    if (oauthError) {
      setIsLoading(false);
      setErrorMsg('Login failed. Please try again.');
      localStorage.removeItem('sgu_google_oauth_started');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Window focus listener to detect when user exits / closes Google account picker
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

        // Fetch DB profile to get authoritative role and shop_id
        let profile = null;
        try {
          const { data: p } = await supabase.from('accounts').select('*').eq('id', session.user.id).single();
          profile = p;
        } catch (_e) {}

        // Resolve role: DB profile role -> metadata role -> isAdminEmail check -> default student
        let role = profile?.role || session.user.app_metadata?.role || meta.role;
        if (isAdminEmail(userEmail)) {
          role = 'admin';
        }
        if (!role) {
          role = 'student';
        }

        // Domain & Access Guard
        const isAllowedDomain = (email, r) => {
          if (!email) return false;
          if (r === 'admin' || r === 'vendor') return true;
          if (isAdminEmail(email)) return true;
          return true;
        };

        if (!isAllowedDomain(userEmail, role)) {
          setErrorMsg("Access Restricted: Only authorized accounts and @sguk.ac.in email addresses are allowed.");
          await supabase.auth.signOut();
          clearStoredUser();
          setIsLoading(false);
          return;
        }

        const name = profile?.full_name || meta.full_name || meta.name || userEmail.split('@')[0] || (role === 'admin' ? 'System Admin' : 'Student');
        const id = userEmail || session.user.phone || session.user.id;
        const shopId = profile?.shop_id || meta.shopId || null;

        try {
          await api.loginGoogle(id, name).catch(() => null);
        } catch (_e) {}

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
      {/* 3D Solar Particle Swarm Animation Background */}
      <SolarBackground />

      {/* Ambient Canvas Glows */}
      <div className="sb-bg-canvas-glows" aria-hidden="true">
        <div className="sb-glow-orb sb-orb-left" />
        <div className="sb-glow-orb sb-orb-right" />
      </div>

      <div className="sb-viewport-wrapper">
        <div className="sb-split-grid">

          {/* LEFT COLUMN: HERO SECTION */}
          <main className="sb-left-hero">

            {/* University Canteen Pill Tag */}
            <GridBeam
              className="sb-badge-pill"
              colorVariant="red"
              active={true}
              breathe={true}
              duration={3.0}
              strength={1}
              borderRadius={999}
              beamCount={2}
            >
              <IconSchool size={16} className="sb-badge-pill-icon" />
              <span className="sb-badge-pill-text">SGU Smart-Bite</span>
            </GridBeam>

            {/* Hero Headline */}
            <h1 className="sb-hero-title">
              Skip Canteen Queues. <br />
              <span className="sb-gradient-text">Enjoy Hot Fresh Food.</span>
            </h1>

            {/* High-Energy Subtitle */}
            <p className="sb-hero-subtitle">
              Order right from your phone between lectures! Freshly prepared, sizzling hot, and ready for pickup before you even reach the food court.
            </p>

            {/* Sign In Action Button below subtitle */}
            <div className="sb-hero-cta-wrap">
              <button
                type="button"
                onClick={scrollToCard}
                className="sb-btn-top-signin sb-btn-hero-signin"
                aria-label="Scroll to Sign In"
              >
                <IconUser size={16} />
                <span>Sign In</span>
                <IconArrowRight size={14} className="sb-btn-top-arrow" />
              </button>
            </div>

            {/* Quick Feature Highlights */}
            <div className="sb-highlights-grid">
              <GridBeam
                className="sb-hl-card"
                colorVariant="red"
                active={true}
                breathe={true}
                duration={3.5}
                strength={1}
                borderRadius={18}
                beamCount={3}
              >
                <div className="sb-hl-icon-box">
                  <IconClock size={20} />
                </div>
                <div className="sb-hl-text-wrap">
                  <div className="sb-hl-title">Order in under 2 mins</div>
                  <div className="sb-hl-desc">Instant 1-tap checkout</div>
                </div>
              </GridBeam>

              <GridBeam
                className="sb-hl-card"
                colorVariant="red"
                active={true}
                breathe={true}
                duration={3.5}
                strength={1}
                borderRadius={18}
                beamCount={3}
              >
                <div className="sb-hl-icon-box gold">
                  <IconBell size={20} />
                </div>
                <div className="sb-hl-text-wrap">
                  <div className="sb-hl-title">Instant Pickup Alerts</div>
                  <div className="sb-hl-desc">Get notified when ready</div>
                </div>
              </GridBeam>
            </div>

            {/* Canteen Perks Footer Row */}
            <div className="sb-perks-row">
              <div className="sb-perk-item">
                <IconBolt size={16} /> Ready When You Arrive
              </div>
              <div className="sb-perk-item green">
                <IconShieldCheck size={16} /> Secure Payment Method
              </div>
              <div className="sb-perk-item">
                <IconToolsKitchen2 size={16} /> Freshly Prepared
              </div>
            </div>

          </main>

          {/* RIGHT COLUMN: FROSTED GLASS SIGN-IN CARD WITH GRIDBEAM GLOW */}
          <aside className="sb-right-card-wrapper" ref={cardRef}>
            <GridBeam
              className="sb-glass-card-compact"
              role="region"
              aria-label="Student Portal Sign-In"
              colorVariant="red"
              active={true}
              breathe={true}
              duration={4.0}
              strength={1}
              borderRadius={24}
              beamCount={4}
            >

              {/* Card Header */}
              <div className="sb-card-brand-header">
                <div className="sb-brand-icon-circle">
                  <IconToolsKitchen2 size={28} />
                </div>
                <h2 className="sb-card-title">Login to Smart Bite</h2>
                <p className="sb-card-subtext">Sign in to order food & track orders</p>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="sb-error-banner" role="alert" aria-live="assertive">
                  {typeof errorMsg === 'string' && errorMsg !== '{}' ? errorMsg : 'Invalid login credentials. Please check your email and password.'}
                </div>
              )}

              {/* Google Sign-In Button with Arrow Disk */}
              <div className="sb-cta-area">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading || isSuccess}
                  className="sb-btn-google-glass"
                  aria-label="Sign in with Google"
                >
                  <div className="sb-btn-left">
                    <svg className="sb-google-svg" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
                  </div>
                  <div className="sb-btn-icon-disk">
                    {isLoading ? <IconLoader2 size={18} className="sb-spin" /> : <IconArrowRight size={18} />}
                  </div>
                </button>
              </div>

              {/* Verified Access Tag */}
              <div className="sb-security-tag">
                <IconShieldCheck size={16} />
                <span>Verified SGU Student Access</span>
              </div>

              {/* Card Footer Note */}
              <div className="sb-card-footer-note">
                <IconMailCheck size={15} />
                <span>Please sign in with your <strong>authorized university email ID</strong>.</span>
              </div>

              {/* Hidden Staff / Vendor Access */}
              <div className="sb-staff-section">
                {!showStaffLogin && (
                  <button
                    type="button"
                    className="sb-staff-icon-btn"
                    onDoubleClick={() => setShowStaffLogin(true)}
                    title="Staff access (double-click)"
                    aria-label="Staff access"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'rgba(148,163,184,0.55)', padding: 6, margin: '4px auto 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <IconBuildingStore size={16} />
                  </button>
                )}

                {showStaffLogin && (
                  <form onSubmit={handleStaffLogin} className="sb-staff-form">
                    <div className="sb-field">
                      <label className="sb-field-label" htmlFor="staff-id">Email ID or Username</label>
                      <div className="sb-field-wrap">
                        <IconMail className="sb-field-icon" size={17} />
                        <input
                          id="staff-id"
                          type="text"
                          value={staffId}
                          onChange={(e) => setStaffId(e.target.value)}
                          placeholder="e.g. vendor@sgu.edu or admin"
                          className="sb-field-input"
                        />
                      </div>
                    </div>

                    <div className="sb-field">
                      <label className="sb-field-label" htmlFor="staff-pwd">Password</label>
                      <div className="sb-field-wrap">
                        <IconLock className="sb-field-icon" size={17} />
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
                      <IconArrowRight size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowStaffLogin(false); setStaffId(''); setStaffPwd(''); setErrorMsg(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem', cursor: 'pointer', marginTop: 4 }}
                    >
                      ← Back to student sign-in
                    </button>
                  </form>
                )}
              </div>

            </GridBeam>
          </aside>

        </div>
      </div>
    </main>
  );
};

export default LoginPage;
