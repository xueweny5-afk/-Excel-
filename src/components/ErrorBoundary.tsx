import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 全局错误边界。
 * 单组件崩溃时降级显示，而不是整个应用白屏。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 实际项目接入 sentry 等监控
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 32, maxWidth: 720, margin: '40px auto' }}>
          <h2 style={{ color: '#b91c1c' }}>页面出错了</h2>
          <p style={{ color: '#6b7280' }}>工具出现异常，部分功能可能不可用。请刷新页面或重新上传文件。</p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 12,
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#fff',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
