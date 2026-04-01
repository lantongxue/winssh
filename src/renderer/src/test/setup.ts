import '@testing-library/jest-dom/vitest'

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {
      return undefined
    }

    observe() {
      return undefined
    }

    unobserve() {
      return undefined
    }
  }
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined
}
