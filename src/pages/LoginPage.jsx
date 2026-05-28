import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, Store, Mail, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SHOPS } from '../data/foodCourtDB';
import { api } from '../api';
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

  useEffect(() => {
    const savedSession = localStorage.getItem('sgu_user');
    if (savedSession) {
      const parsedUser = JSON.parse(savedSession);
      console.log('Auto-logging in saved user:', parsedUser);
      if (parsedUser.role === 'student' || parsedUser.role === 'guest') {
        navigate('/student');
      } else if (parsedUser.role === 'owner') {
        navigate('/vendor');
      } else if (parsedUser.role === 'admin') {
        navigate('/admin');
      }
    }
  }, [navigate]);

  const isFormValid = () => {
    if (role === 'Student') return studentName.trim() !== '' && studentId.trim() !== '' && password.trim() !== '';
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
        const normalizedRole = role === 'Shop Owner' ? 'owner' : role === 'Student' ? 'student' : 'guest';
        const loginUsername = role === 'Student' ? studentId : (role === 'Guest' ? guestMobile : shopId);
        
        const response = await api.login(loginUsername, password, normalizedRole);
        
        if (response.success) {
          setIsLoading(false);
          setIsSuccess(true);
          
          const userData = {
            role: response.user.role,
            name: role === 'Guest' ? guestName : response.user.name,
            id: response.user.username,
            shopId: response.user.shopId,
            timestamp: new Date().toISOString(),
            rememberMe: rememberMe
          };
          localStorage.setItem('sgu_user', JSON.stringify(userData));
          
          setTimeout(() => {
            setIsSuccess(false);
            if (normalizedRole === 'student' || normalizedRole === 'guest') {
              navigate('/student');
            } else if (normalizedRole === 'owner') {
              navigate('/vendor');
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

  const roles = ['Student', 'Shop Owner', 'Guest'];

  return (
    <div className="login-page-container">
      <div className="login-card">

        {/* Welcome Text */}
        <h1 className="login-heading">Welcome Back</h1>
        <p className="login-subheading">Login to continue your experience</p>

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
          {role !== 'Guest' && (
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

        </form>
      </div>
    </div>
  );
};

export default LoginPage;
