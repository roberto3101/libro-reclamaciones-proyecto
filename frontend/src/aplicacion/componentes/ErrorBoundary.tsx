import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { UiIcono } from '@/ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleBack = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--ui-fondo, #faf8f4)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          padding: '40px 32px',
          borderRadius: 'var(--ui-r-xl)',
          backgroundColor: 'var(--ui-superficie, #fff)',
          border: '1px solid var(--ui-borde, #e5e0d4)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <UiIcono nombre="report" tamano={38} sx={{ display: "block", marginBottom: "16px", color: "var(--ui-peligro-texto)" }} />
          <h2 style={{
            margin: '0 0 8px',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--ui-texto, #302d27)',
          }}>
            Algo salió mal
          </h2>
          <p style={{
            margin: '0 0 24px',
            fontSize: '0.9rem',
            color: 'var(--ui-texto-2, #857e70)',
            lineHeight: 1.5,
          }}>
            Ocurrió un error inesperado. Puedes intentar recargar la página o volver al inicio.
          </p>

          {this.state.error && (
            <pre style={{
              margin: '0 0 24px',
              padding: '12px 16px',
              borderRadius: 'var(--ui-r-lg)',
              backgroundColor: 'var(--ui-peligro-suave, #fbf0ee)',
              color: 'var(--ui-peligro-texto, #7a251f)',
              fontSize: '0.75rem',
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: 120,
              border: '1px solid var(--ui-peligro-borde, #e5c2bc)',
            }}>
              {this.state.error.message}
            </pre>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--ui-r-lg)',
                border: 'none',
                backgroundColor: 'var(--ui-primario, #9a4a24)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recargar página
            </button>
            <button
              onClick={this.handleBack}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--ui-r-lg)',
                border: '1px solid var(--ui-borde, #e5e0d4)',
                backgroundColor: 'transparent',
                color: 'var(--ui-texto, #302d27)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
