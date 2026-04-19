import { Component, type ErrorInfo, type ReactNode } from 'react'
import { rendererLogger } from '@/lib/logger'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError() {
    return {
      hasError: true
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    rendererLogger.error('Unhandled renderer error', {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      errorInfo
    })
  }

  override render() {
    if (this.state.hasError) {
      return <div className="h-full bg-[var(--workbench-bg)]" />
    }

    return this.props.children
  }
}

