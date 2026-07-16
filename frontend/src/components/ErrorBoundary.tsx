import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';

/**
 * 전역 에러 바운더리 (프론트 CLAUDE.md [5] — try-catch 산발 금지, Query error 경로 + 전역 바운더리).
 * 렌더 단계의 예기치 못한 예외를 잡아 공통 에러 골격으로 대체한다.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 스켈레톤: 콘솔 기록만. 관측(로깅/모니터링) 연동은 후속.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorState error={this.state.error} onRetry={this.handleReset} />;
    }
    return this.props.children;
  }
}
