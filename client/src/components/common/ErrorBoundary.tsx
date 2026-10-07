import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button/Button';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // In production, would send to error reporting telemetry
    console.error('[CorpVerse ErrorBoundary Caught]:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.iconWrapper}>⚠</div>
            <h1 className={styles.title}>System Exception Detected</h1>
            <p className={styles.message}>
              An unexpected application error interrupted the current view. Your state and
              credentials remain secure.
            </p>
            {this.state.error && <pre className={styles.errorBox}>{this.state.error.message}</pre>}
            <div className={styles.actions}>
              <Button variant="primary" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleReload}>
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
