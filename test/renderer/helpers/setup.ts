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

if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined
}

if (typeof HTMLDocument !== 'undefined' && !HTMLDocument.prototype.queryCommandSupported) {
  HTMLDocument.prototype.queryCommandSupported = (_command: string) => false
}
