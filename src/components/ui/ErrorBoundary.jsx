import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SGU Smart-Bite Application Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleResetSession = () => {
    try {
      localStorage.removeItem('sgu_user');
      sessionStorage.removeItem('sgu_user');
      localStorage.removeItem('sgu_cart');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          fontFamily: "'Inter', sans-serif",
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(228, 0, 43, 0.3)',
            borderRadius: '20px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(228, 0, 43, 0.12)',
              border: '2px solid #E4002B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              fontSize: '28px'
            }}>
              🍱
            </div>

            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: '0 0 10px 0',
              letterSpacing: '-0.02em'
            }}>
              SGU Smart-Bite
            </h2>

            <p style={{
              fontSize: '0.95rem',
              color: '#94A3B8',
              lineHeight: 1.5,
              margin: '0 0 16px 0'
            }}>
              We hit a slight bump. Please refresh or reset your session below.
            </p>

            {this.state.error?.message && (
              <p style={{
                fontSize: '0.78rem',
                color: '#F87171',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '8px 12px',
                borderRadius: '8px',
                margin: '0 0 20px 0',
                wordBreak: 'break-word',
                textAlign: 'left',
                fontFamily: 'monospace'
              }}>
                {this.state.error.message}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #E4002B 0%, #CC0026 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(228, 0, 43, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                Refresh Page
              </button>

              <button
                type="button"
                onClick={this.handleResetSession}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#94A3B8',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Reset Session & Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
