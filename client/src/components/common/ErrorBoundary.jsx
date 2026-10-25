import React from 'react';

/**
 * Global React Error Boundary
 * Catches runtime errors anywhere in the child component tree and displays a fallback UI
 * rather than unmounting the entire app and showing a blank screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TaskPilot caught an uncaught rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="panel" style={{ maxWidth: '520px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <div className="brand-mark" style={{ fontSize: '32px', marginBottom: '16px' }}>✦</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-muted, #666)', fontSize: '14px', marginBottom: '20px' }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering the workspace.'}
            </p>
            <button
              type="button"
              className="primary-btn"
              style={{ margin: '0 auto' }}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
