import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, Mail, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState(''); // email / mobile / shopId
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // OTP flow
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');

  const navigate = useNavigate();

  // ─── detect what type of identifier is being typed ───────────────────────
  const isEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = (val) => /^\d{10}$/.test(val) || /^\+\d{10,12}$/.test(val);
  const looksLikeOwner = (val) => {
    // If user typed something that does NOT look like a student email/phone,
    // we treat it as a potential owner/admin identifier (shopId / text username)
    const v = val.trim().toLowerCase();
    return v.length > 0 && !isEmail(val) && !isPhone(val);
  };
  const showPasswordField = looksLikeOwner(identifier) && identifier.trim().length > 0;

  // ─── Supabase OAuth listener ──────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsLoading(true);
        setErrorMsg('');
        try {
          const { email, full_name, name: metaName, phone } = session.user.user_metadata || {};
          const userEmail = session.user.email || email;
          const userPhone = session.user.phone || phone;
          const loginIdentifier = userEmail || userPhone;
          if (!loginIdentifier) throw new Error('No email or phone number found in authentication session.');

          const pendingName = localStorage.getItem('sgu_pending_name');
          const userName = full_name || metaName || pendingName || (userEmail ? userEmail.split('@')[0] : userPhone);
          localStorage.removeItem('sgu_pending_name');

          const response = await api.googleLogin(loginIdentifier, userName);
          if (response.success) {
            setIsLoading(false);
            setIsSuccess(true);
            const userData = {
              role: response.user.role,
              name: response.user.name,
              id: response.user.username,
              shopId: response.user.shopId || response.user.shopid,
              timestamp: new Date().toISOString(),
              rememberMe: true,
            };
            localStorage.setItem('sgu_user', JSON.stringify(userData));
            await supabase.auth.signOut();
            setTimeout(() => {
              setIsSuccess(false);
              redirectByRole(response.user.role, userData.shopId);
            }, 1500);
          } else {
            setErrorMsg(response.message || 'Google login verification failed.');
            setIsLoading(false);
          }
        } catch (err) {
          setErrorMsg(err.message || 'Could not register Google session in backend.');
          setIsLoading(false);
        }
      }
    });

    // Auto-redirect if session already exists
    const savedSession = localStorage.getItem('sgu_user');
    if (savedSession) {
      const parsedUser = JSON.parse(savedSession);
      const isOwnerSessionCorrupted =
        parsedUser.role === 'owner' &&
        (!parsedUser.shopId || parsedUser.shopId === 'undefined' || parsedUser.shopId === 'null');
      if (isOwnerSessionCorrupted) {
        localStorage.removeItem('sgu_user');
      } else {
        redirectByRole(parsedUser.role, parsedUser.shopId);
      }
    }

    return () => subscription.unsubscribe();
  }, [navigate]);

  const redirectByRole = (role, shopId) => {
    if (role === 'student' || role === 'guest') {
      navigate('/student');
    } else if (role === 'owner') {
      navigate(`/vendor/${shopId}`);
    } else if (role === 'admin') {
      navigate('/admin');
    }
  };

  // ─── Form validation ──────────────────────────────────────────────────────
  const isFormValid = () => {
    const id = identifier.trim();
    if (!id) return false;
    // For email/phone users → OTP flow, password not needed
    if (isEmail(id) || isPhone(id)) return true;
    // For shop owners / admin → password required
    if (!password.trim()) return false;
    return true;
  };

  // ─── Main login handler ───────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;

    const id = identifier.trim();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // ── Student / Guest via email or phone → send OTP ──
      if (isEmail(id) || isPhone(id)) {
        localStorage.setItem('sgu_pending_name', name.trim());

        if (isEmail(id)) {
          const { error } = await supabase.auth.signInWithOtp({ email: id });
          if (error) throw error;
        } else {
          const phone = /^\d{10}$/.test(id) ? `+91${id}` : id;
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (error) throw error;
        }

        setIsLoading(false);
        setOtpSent(true);
        return;
      }

      // ── Owner / Admin → password-based login, auto-detect role ──
      // Try admin first if "admin" is in the identifier
      let guessedRole = id.toLowerCase().includes('admin') ? 'admin' : 'owner';

      const response = await api.login(id, password.trim(), guessedRole, name.trim());

      if (response.success) {
        finishLogin(response);
      } else {
        // If owner failed, retry as student (edge case: old text-based student IDs)
        const retryResponse = await api.login(id, password.trim(), 'student', name.trim());
        if (retryResponse.success) {
          finishLogin(retryResponse);
        } else {
          setErrorMsg('Invalid credentials. Please check your ID and password.');
          setIsLoading(false);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not connect to server.');
      setIsLoading(false);
    }
  };

  const finishLogin = (response) => {
    setIsLoading(false);
    setIsSuccess(true);
    const userData = {
      role: response.user.role,
      name: response.user.name,
      id: response.user.username,
      shopId: response.user.shopId || response.user.shopid,
      timestamp: new Date().toISOString(),
      rememberMe,
    };
    localStorage.setItem('sgu_user', JSON.stringify(userData));
    setTimeout(() => {
      setIsSuccess(false);
      redirectByRole(response.user.role, userData.shopId);
    }, 1500);
  };

  // ─── OTP verify ──────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpToken || otpToken.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit verification code.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const id = identifier.trim();
      let verifyParams = {};
      if (isEmail(id)) {
        verifyParams = { email: id, token: otpToken.trim(), type: 'email' };
      } else {
        const phone = /^\d{10}$/.test(id) ? `+91${id}` : id;
        verifyParams = { phone, token: otpToken.trim(), type: 'sms' };
      }
      const { error } = await supabase.auth.verifyOtp(verifyParams);
      if (error) throw error;
      // onAuthStateChange handles navigation
    } catch (err) {
      setErrorMsg(err.message || 'Failed to verify code.');
      setIsLoading(false);
    }
  };

  // ─── Google Sign-In ───────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (name.trim()) localStorage.setItem('sgu_pending_name', name.trim());
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/login' },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
      setIsLoading(false);
    }
  };

  // ─── Hint text shown below identifier field ───────────────────────────────
  const getHintText = () => {
    const id = identifier.trim();
    if (!id) return null;
    if (isEmail(id)) return { text: '📧 Student / Guest — we\'ll send you an OTP', color: '#2563eb' };
    if (isPhone(id)) return { text: '📱 Student / Guest — we\'ll send you an OTP', color: '#2563eb' };
    if (id.toLowerCase().includes('admin')) return { text: '🔐 Admin — enter your password below', color: '#7c3aed' };
    return { text: '🏪 Shop Owner — enter your password below', color: '#d97706' };
  };

  const hint = getHintText();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="login-page-container">
      <div className="login-card">

        {/* OTP verification screen */}
        {otpSent ? (
          <form onSubmit={handleVerifyOtp}>
            <div className="login-otp-icon">✉️</div>
            <h1 className="login-heading" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              {isEmail(identifier) ? 'Check Your Email' : 'Check Your Phone'}
            </h1>
            <p className="login-subheading" style={{ marginBottom: '24px' }}>
              We sent a 6-digit code to <strong>{identifier}</strong>
            </p>

            <div className="login-form-group">
              <label className="login-label">Verification Code</label>
              <div className="login-input-wrapper">
                <Lock className="login-icon" size={20} />
                <input
                  type="text"
                  maxLength={6}
                  value={otpToken}
                  onChange={(e) => {
                    setOtpToken(e.target.value.replace(/\D/g, ''));
                    setErrorMsg('');
                  }}
                  placeholder="Enter 6-digit OTP"
                  className="login-input"
                  required
                  autoFocus
                  style={{
                    letterSpacing: otpToken ? '8px' : 'normal',
                    textAlign: otpToken ? 'center' : 'left',
                    fontSize: otpToken ? '1.25rem' : '1rem',
                    fontWeight: otpToken ? 'bold' : 'normal',
                    paddingLeft: otpToken ? '12px' : '40px',
                  }}
                />
              </div>
            </div>

            {errorMsg && <div className="login-error">{errorMsg}</div>}

            <button
              type="submit"
              disabled={otpToken.length !== 6 || isLoading || isSuccess}
              className={`login-button ${isSuccess ? 'success' : ''}`}
            >
              {!isLoading && !isSuccess && <span>Verify &amp; Sign In</span>}
              {isLoading && <Loader2 className="animate-spin" size={24} />}
              {isSuccess && <CheckCircle2 size={24} />}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                type="button"
                className="login-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { setOtpSent(false); setOtpToken(''); setErrorMsg(''); }}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Header */}
            <div className="login-logo-area">
              <div className="login-logo-icon">🍽️</div>
              <h1 className="login-heading">Smart Bite</h1>
              <p className="login-subheading">Enter your credentials — we'll figure out the rest</p>
            </div>

            <form onSubmit={handleLogin}>



              {/* Identifier */}
              <div className="login-form-group">
                <label className="login-label">Shop ID / Email / Mobile</label>
                <div className="login-input-wrapper">
                  <Mail className="login-icon" size={20} />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setErrorMsg(''); }}
                    placeholder="Shop ID, email, or mobile number"
                    className="login-input"
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                {/* Role hint */}
                {hint && (
                  <p className="login-hint" style={{ color: hint.color }}>
                    {hint.text}
                  </p>
                )}
              </div>

              {/* Password — always visible */}
              <div className="login-form-group">
                <label className="login-label">Password</label>
                <div className="login-input-wrapper">
                  <Lock className="login-icon" size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="login-input"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-icon-right"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="login-options">
                  <label className="login-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="login-checkbox"
                    />
                    Remember Me
                  </label>
                  <button
                    type="button"
                    onClick={() => alert('Forgot Password feature coming soon!')}
                    className="login-link"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {errorMsg && <div className="login-error">{errorMsg}</div>}

              <button
                type="submit"
                disabled={!isFormValid() || isLoading || isSuccess}
                className={`login-button ${isSuccess ? 'success' : ''}`}
              >
                {!isLoading && !isSuccess && (
                  <span>
                    {isEmail(identifier.trim()) || isPhone(identifier.trim()) ? 'Send OTP' : 'Login'}
                  </span>
                )}
                {isLoading && <Loader2 className="animate-spin" size={24} />}
                {isSuccess && <CheckCircle2 size={24} />}
              </button>

              {/* Google sign-in */}
              <div className="login-divider"><span>or</span></div>
              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isLoading || isSuccess}
                className="login-google-button"
              >
                <svg className="login-google-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <p className="login-footer-note">
                <Sparkles size={13} style={{ display: 'inline', marginRight: 4, color: '#f59e0b' }} />
                Students &amp; guests use email/mobile · Owners use their Shop&nbsp;ID
              </p>

            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
