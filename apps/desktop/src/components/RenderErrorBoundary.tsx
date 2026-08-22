import { captureException } from '@/services/error-reporting'
import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface RenderErrorFallbackProps {
  error: unknown
  reset: () => void
}

interface RenderErrorBoundaryProps {
  children: ReactNode
  fallback: (props: RenderErrorFallbackProps) => ReactNode
  onError?: (error: unknown, info: ErrorInfo) => void
  resetKey?: unknown
}

interface RenderErrorBoundaryState {
  hasError: boolean
  error: unknown
}

export class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  state: RenderErrorBoundaryState = { error: undefined, hasError: false }

  static getDerivedStateFromError(error: unknown): RenderErrorBoundaryState {
    return { error, hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    captureException(error)
    this.props.onError?.(error, info)
  }

  componentDidUpdate(previousProps: RenderErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ error: undefined, hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback({ error: this.state.error, reset: this.reset })
    }

    return this.props.children
  }
}
