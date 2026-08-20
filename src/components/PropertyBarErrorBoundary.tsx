import React from 'react';

// Scoped diagnostic error boundary — wraps ONLY the newly-extracted
// SingleSelectPropertyBar so that if it throws, we get the real error
// message + component stack in the console instead of React's generic
// "Consider adding an error boundary" line with no further detail.
//
// Temporary: once the reported crash is diagnosed and fixed, this can
// either be removed or kept permanently (a scoped boundary here is
// reasonable long-term — it means a property-bar bug degrades to
// "property bar is blank" instead of crashing the whole canvas).

interface Props {
  children: React.ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class PropertyBarErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(
      `[PropertyBarErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}] caught:`,
      error,
      '\nComponent stack:',
      info.componentStack
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#f87171' }}>
          Property bar crashed: {this.state.error.message}
          {' '}(see console for full stack)
        </div>
      );
    }
    return this.props.children;
  }
}
