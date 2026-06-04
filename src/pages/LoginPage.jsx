import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, Store, Mail, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SHOPS } from '../data/foodCourtDB';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import './LoginPage.css'; // Importing pure CSS

const LoginPage = () => {
  const [role, setRole] = useState('Student');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [shopId, setShopId] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [customBackend, setCustomBackend] = useState(localStorage.getItem('sgu_backend_url') || '');

  useEffect(() => {
    // Listen for Supabase OAuth redirects and login automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsLoading(true);
        setErrorMsg('');
        try {
          const { email, full_name, name } = session.user.user_metadata;
          const userEmail = session.user.email || email;
          const userName = full_name || name || userEmail.split('@')[0];

          // Authenticate/Register Google user dynamically in our database
          const response = await api.googleLogin(userEmail, userName);
          
          if (response.success) {
            setIsLoading(false);
            setIsSuccess(true);

            const userData = {
              role: response.user.role,
              name: response.user.name,
              id: response.user.username,
              shopId: response.user.shopId || response.user.shopid,
              timestamp: new Date().toISOString(),
              rememberMe: true
            };
            localStorage.setItem('sgu_user', JSON.stringify(userData));

            // Clean up Supabase auth session so next logins fire clean redirects
            await supabase.auth.signOut();

            setTimeout(() => {
              setIsSuccess(false);
              const finalRole = response.user.role;
              if (finalRole === 'student' || finalRole === 'guest') {
                navigate('/student');
              } else if (finalRole === 'owner') {
                navigate(`/vendor/${userData.shopId}`);
              } else if (finalRole === 'admin') {
                navigate('/admin');
              }
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

    const savedSession = localStorage.getItem('sgu_user');
    if (savedSession) {
      const parsedUser = JSON.parse(savedSession);
      console.log('Auto-logging in saved user:', parsedUser);
      
      // Auto-clear corrupted sessions from previous case-sensitivity bug
      const isOwnerSessionCorrupted = parsedUser.role === 'owner' && 
        (!parsedUser.shopId || parsedUser.shopId === 'undefined' || parsedUser.shopId === 'null');
        
      if (isOwnerSessionCorrupted) {
        console.warn('Clearing corrupted owner session:', parsedUser);
        localStorage.removeItem('sgu_user');
      } else {
        if (parsedUser.role === 'student' || parsedUser.role === 'guest') {
          navigate('/student');
        } else if (parsedUser.role === 'owner') {
          navigate(`/vendor/${parsedUser.shopId}`);
        } else if (parsedUser.role === 'admin') {
          navigate('/admin');
        }
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const isFormValid = () => {
    if (role === 'Student') {
      const isTryingAdmin = studentId.toLowerCase().includes('admin');
      if (isTryingAdmin) {
        return studentName.trim() !== '' && studentId.trim() !== '' && password.trim() !== '';
      }
      return studentName.trim() !== '' && studentId.trim() !== '';
    }
    if (role === 'Shop Owner') return shopId.trim() !== '' && password.trim() !== '';
    if (role === 'Guest') return guestName.trim() !== '' && guestMobile.trim() !== '';
    return true;
  };

  const validateFormat = () => {
    setErrorMsg('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;

    if (role === 'Student') {
      if (!emailRegex.test(studentId) && !phoneRegex.test(studentId)) {
        setErrorMsg('Invalid format: Please enter a valid Email or 10-digit Mobile Number.');
        return false;
      }
    } else if (role === 'Guest') {
      if (!phoneRegex.test(guestMobile)) {
        setErrorMsg('Invalid format: Please enter a valid 10-digit Mobile Number.');
        return false;
      }
    } else if (role === 'Shop Owner') {
      const isDigitsOnly = /^\d+$/.test(shopId);
      if (isDigitsOnly && shopId.length !== 10 && shopId.length > 5) {
        setErrorMsg('Invalid format: Mobile Number should be 10 digits.');
        return false;
      }
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isFormValid()) {
      if (!validateFormat()) return;

      setIsLoading(true);
      setErrorMsg('');

      try {
        let normalizedRole = role === 'Shop Owner' ? 'owner' : role === 'Student' ? 'student' : 'guest';
        if (role === 'Student' && studentId.toLowerCase().includes('admin')) {
          normalizedRole = 'admin';
        }
        const loginUsername = role === 'Student' ? studentId : (role === 'Guest' ? guestMobile : shopId);
        
        // Trigger Supabase OTP if student logging in via Email
        if (role === 'Student' && normalizedRole === 'student' && loginUsername.includes('@')) {
          const { error } = await supabase.auth.signInWithOtp({
            email: loginUsername,
          });
          if (error) throw error;
          
          setIsLoading(false);
          setOtpSent(true);
          return;
        }

        const response = await api.login(loginUsername, password, normalizedRole, studentName);
        
        if (response.success) {
          setIsLoading(false);
          setIsSuccess(true);
          
          const userData = {
            role: response.user.role,
            name: role === 'Guest' ? guestName : response.user.name,
            id: response.user.username,
            shopId: response.user.shopId || response.user.shopid,
            timestamp: new Date().toISOString(),
            rememberMe: rememberMe
          };
          localStorage.setItem('sgu_user', JSON.stringify(userData));
          
          setTimeout(() => {
            setIsSuccess(false);
            const finalRole = response.user.role;
            if (finalRole === 'student' || finalRole === 'guest') {
              navigate('/student');
            } else if (finalRole === 'owner') {
              navigate(`/vendor/${userData.shopId}`);
            } else if (finalRole === 'admin') {
              navigate('/admin');
            }
          }, 1500);
        } else {
          setErrorMsg(response.message || 'Login failed.');
          setIsLoading(false);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Could not connect to backend server.');
        setIsLoading(false);
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpToken || otpToken.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: studentId,
        token: otpToken.trim(),
        type: 'email'
      });

      if (error) throw error;
      
      // onAuthStateChange in useEffect handles local database sync & navigation
    } catch (err) {
      setErrorMsg(err.message || 'Failed to verify verification code.');
      setIsLoading(false);
    }
  };
 
  const loginWithGoogle = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/login'
        }
      });
      if (error) {
        throw error;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Google Sign-In failed to initialize.');
      setIsLoading(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (customBackend.trim()) {
      localStorage.setItem('sgu_backend_url', customBackend.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem('sgu_backend_url');
    }
    alert('Connection settings saved! Reloading application...');
    window.location.reload();
  };

  const roles = ['Student', 'Shop Owner', 'Guest'];

  return (
    <div className="login-page-container">
      <div className="login-card">
        {otpSent ? (
          <form onSubmit={handleVerifyOtp}>
            <h1 className="login-heading" style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Verify Your Email</h1>
            <p className="login-subheading" style={{ marginBottom: '24px' }}>
              We sent a 6-digit code to <strong>{studentId}</strong>
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
                    const val = e.target.value.replace(/\D/g, '');
                    setOtpToken(val);
                    setErrorMsg('');
                  }}
                  placeholder="Enter 6-digit code"
                  className="login-input"
                  required
                  style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
                />
              </div>
            </div>

            {errorMsg && (
              <div style={{ color: '#E4002B', fontSize: '0.875rem', textAlign: 'center', marginBottom: '16px', fontWeight: '600', backgroundColor: '#FEE2E2', padding: '10px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={otpToken.length !== 6 || isLoading || isSuccess}
              className={`login-button ${isSuccess ? 'success' : ''}`}
            >
              {!isLoading && !isSuccess && <span>Verify Code & Sign In</span>}
              {isLoading && <Loader2 className="animate-spin" size={24} />}
              {isSuccess && <CheckCircle2 size={24} />}
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="login-link bg-transparent border-none p-0 cursor-pointer"
                onClick={() => {
                  setOtpSent(false);
                  setOtpToken('');
                  setErrorMsg('');
                }}
              >
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Welcome Text */}
            <h1 className="login-heading">Welcome Back</h1>
            <p className="login-subheading">Login to continue your experience</p>

            {window.location.hostname.includes('vercel.app') && !localStorage.getItem('sgu_backend_url') && (
              <div style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.8rem',
                color: '#B45309',
                marginBottom: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.4'
              }}>
                ⚠️ Mobile/Cloud Testing: Please configure your Backend Connection URL at the bottom to connect to your database.
              </div>
            )}

            {/* Tab Switcher */}
            <div className="login-tabs">
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    setStudentName('');
                    setStudentId('');
                    setShopId('');
                    setPassword('');
                    setErrorMsg('');
                  }}
                  className={`login-tab ${role === r ? 'active' : 'inactive'}`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Form Container */}
            <form onSubmit={handleLogin}>

              {/* --- STUDENT FIELDS --- */}
              {role === 'Student' && (
                <>
                  <div className="login-form-group">
                    <label className="login-label">Full Name</label>
                    <div className="login-input-wrapper">
                      <User className="login-icon" size={20} />
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => { setStudentName(e.target.value); setErrorMsg(''); }}
                        placeholder="Enter your full name"
                        className="login-input"
                        required
                      />
                    </div>
                  </div>
                  <div className="login-form-group">
                    <label className="login-label">Email / Mobile</label>
                    <div className="login-input-wrapper">
                      <Mail className="login-icon" size={20} />
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => { setStudentId(e.target.value); setErrorMsg(''); }}
                        placeholder="Enter Email / Mobile"
                        className="login-input"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* --- SHOP OWNER FIELDS --- */}
              {role === 'Shop Owner' && (
                <div className="login-form-group">
                  <label className="login-label">Mobile Number OR Shop ID</label>
                  <div className="login-input-wrapper">
                    <Store className="login-icon" size={20} />
                    <input
                      type="text"
                      value={shopId}
                      onChange={(e) => { setShopId(e.target.value); setErrorMsg(''); }}
                      placeholder="Enter Mobile OR Shop ID"
                      className="login-input"
                      required
                    />
                  </div>
                </div>
              )}

              {/* --- PASSWORD FIELD --- */}
              {(role === 'Shop Owner' || (role === 'Student' && studentId.toLowerCase().includes('admin'))) && (
                <>
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
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="login-icon-right"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
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
                    <button type="button" onClick={() => alert('Forgot Password feature is coming soon!')} className="login-link bg-transparent border-none p-0 cursor-pointer">Forgot Password?</button>
                  </div>
                </>
              )}

              {/* --- GUEST FORM --- */}
              {role === 'Guest' && (
                <>
                  <div className="login-form-group">
                    <label className="login-label">Full Name</label>
                    <div className="login-input-wrapper">
                      <User className="login-icon" size={20} />
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Enter your full name"
                        className="login-input"
                        required
                      />
                    </div>
                  </div>
                  <div className="login-form-group">
                    <label className="login-label">Mobile Number</label>
                    <div className="login-input-wrapper">
                      <Phone className="login-icon" size={20} />
                      <input
                        type="text"
                        value={guestMobile}
                        onChange={(e) => { setGuestMobile(e.target.value); setErrorMsg(''); }}
                        placeholder="Enter mobile number"
                        className="login-input"
                        required
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px', textAlign: 'center', fontWeight: '500' }}>
                      For order updates only.
                    </p>
                  </div>
                </>
              )}

              {/* --- ERROR NOTIFICATION --- */}
              {errorMsg && (
                <div style={{ color: '#E4002B', fontSize: '0.875rem', textAlign: 'center', marginBottom: '16px', fontWeight: '600', backgroundColor: '#FEE2E2', padding: '10px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                  {errorMsg}
                </div>
              )}

              {/* --- SUBMIT BUTTON --- */}
              <button
                type="submit"
                disabled={(!isFormValid() && role !== 'Guest') || isLoading || isSuccess}
                className={`login-button ${isSuccess ? 'success' : ''}`}
              >
                {!isLoading && !isSuccess && (
                  <span>{role === 'Guest' ? 'Continue as Guest' : role === 'Shop Owner' ? 'Login as Owner' : 'Sign In'}</span>
                )}
                {isLoading && <Loader2 className="animate-spin" size={24} />}
                {isSuccess && <CheckCircle2 size={24} />}
              </button>

              {/* --- REGISTER LINK --- */}
              {role !== 'Guest' && (
                <div className="login-register-text">
                  Don&apos;t have an account? <button type="button" onClick={() => alert('Registration is currently handled by the administrator.')} className="login-link bg-transparent border-none p-0 cursor-pointer">Register</button>
                </div>
              )}

              {/* --- GOOGLE OAUTH BUTTON (STUDENTS ONLY) --- */}
              {role === 'Student' && (
                <>
                  <div className="login-divider">
                    <span>or</span>
                  </div>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    disabled={isLoading || isSuccess}
                    className="login-google-button"
                  >
                    <svg className="login-google-icon" viewBox="0 0 24 24" width="20" height="20">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </>
              )}

            </form>
            {/* --- CONNECTION SETTINGS --- */}
            <div className="login-settings-section">
              <button
                type="button"
                className="login-settings-toggle"
                onClick={() => setShowSettings(!showSettings)}
              >
                ⚙️ Connection Settings
              </button>
              
              {showSettings && (
                <div className="login-settings-panel">
                  <p className="login-settings-desc">
                    Specify custom backend API URL (e.g. for localtunnel mobile testing):
                  </p>
                  <div className="login-form-group">
                    <input
                      type="text"
                      className="login-input"
                      style={{ height: '36px', fontSize: '14px', paddingLeft: '12px' }}
                      placeholder="e.g. https://your-tunnel.loca.lt"
                      value={customBackend}
                      onChange={(e) => setCustomBackend(e.target.value)}
                    />
                  </div>
                  <div className="login-settings-actions">
                    <button
                      type="button"
                      className="login-settings-btn save"
                      onClick={handleSaveSettings}
                    >
                      Save & Reload
                    </button>
                    <button
                      type="button"
                      className="login-settings-btn reset"
                      onClick={() => {
                        localStorage.removeItem('sgu_backend_url');
                        alert('Connection URL reset to default! Reloading...');
                        window.location.reload();
                      }}
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
