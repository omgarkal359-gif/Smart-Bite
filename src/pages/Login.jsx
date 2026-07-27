import React from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <div className="page-container" style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <div className="food-card">
        <h1 className="page-title" style={{ textAlign: 'center', marginBottom: '1rem' }}>Welcome Back</h1>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
            <input type="email" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
            <input type="password" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Login</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-light)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)' }}>Register</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
