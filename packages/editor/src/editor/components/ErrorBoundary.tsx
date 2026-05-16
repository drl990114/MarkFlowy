import type { ErrorInfo, PropsWithChildren } from 'react'
import React from 'react'
import styled from 'styled-components'

const Title = styled.h1`
  color: ${({ theme }) => theme.dangerColor};
`

const ErrorBlock = styled.div`
  display: grid;
  gap: 12px;
`

const DetailBlock = styled.div`
  display: grid;
  gap: 8px;
`

const Label = styled.div`
  font-weight: 600;
`

const CodeBlock = styled.pre`
  background: ${({ theme }) => theme.preBgColor};
  border-radius: 6px;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
`

export interface ErrorBoundaryProps {
  hasError?: boolean
  error?: unknown
  fallback?: React.ComponentType<{ error: Error; errorInfo?: ErrorInfo }>
  onError?: (params: { error: Error; errorInfo?: ErrorInfo }) => void
}

const DefaultFallback = (props: { error: Error; errorInfo?: ErrorInfo }) => {
  const errorName = props.error?.name || 'Error'
  const errorMessage = props.error?.message || String(props.error)
  const errorStack = props.error?.stack
  const componentStack = props.errorInfo?.componentStack

  return (
    <ErrorBlock>
      <Title>Sorry, something went wrong!</Title>
      <DetailBlock>
        <Label>Message</Label>
        <CodeBlock>{`${errorName}: ${errorMessage}`}</CodeBlock>
      </DetailBlock>
      {errorStack ? (
        <DetailBlock>
          <Label>Stack</Label>
          <CodeBlock>{errorStack}</CodeBlock>
        </DetailBlock>
      ) : null}
      {componentStack ? (
        <DetailBlock>
          <Label>Component Stack</Label>
          <CodeBlock>{componentStack.trim()}</CodeBlock>
        </DetailBlock>
      ) : null}
    </ErrorBlock>
  )
}

class ErrorBoundary extends React.Component<
  PropsWithChildren<ErrorBoundaryProps>,
  { hasError: boolean; error?: Error; errorInfo?: ErrorInfo }
> {
  constructor(props: PropsWithChildren<ErrorBoundaryProps>) {
    super(props)
    this.state = { hasError: this.props.hasError ?? false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    const Fallback = this.props.fallback ?? DefaultFallback

    if (this.state.hasError) {
      const error = (this.props.error as Error) ?? this.state.error ?? new Error('Unknown error')
      console.error(error)
      this.props.onError?.({ error, errorInfo: this.state.errorInfo })

      return <Fallback error={error} errorInfo={this.state.errorInfo} />
    }

    return this.props.children
  }
}

export default ErrorBoundary
