// OSC sequence scanner for terminal data streams.
//
// Recognised sequences (BEL = 0x07; ST = ESC \ = 0x1b 0x5c):
//   OSC 133 ; A <ST>           prompt start
//   OSC 133 ; C <ST>           command pre-execution
//   OSC 133 ; D <ST>           command finished (no exit code)
//   OSC 133 ; D ; <code> <ST>  command finished with exit code
//   OSC 633 ; E ; <base64> <ST>  command text (base64-encoded, VS Code extension)
//
// All recognised sequences are stripped from the output passed to the renderer.
// Anything that looks like another OSC sequence (different identifier) is passed
// through unchanged so existing terminal features keep working.

const ESC = 0x1b
const BEL = 0x07
const BACKSLASH = 0x5c
const OSC_INTRO = '\x1b]'
const MAX_BUFFER_BYTES = 64 * 1024

export interface OscScannerState {
  /** Bytes withheld because they might be the start of an OSC sequence. */
  pending: string
}

export interface OscHandlers {
  onPromptStart?: () => void
  onCommandPre?: () => void
  onCommandDone?: (exitCode: number | null) => void
  onCommandText?: (command: string) => void
}

export function createOscScannerState(): OscScannerState {
  return { pending: '' }
}

/**
 * Feed a chunk of raw stream bytes; returns the bytes safe to forward to the
 * renderer (recognised OSC sequences stripped). Handlers fire as sequences are
 * resolved.
 */
export function scanOscChunk(state: OscScannerState, chunk: string, handlers: OscHandlers): string {
  const data = state.pending + chunk
  state.pending = ''

  let out = ''
  let i = 0
  const n = data.length

  while (i < n) {
    const escIndex = data.indexOf('\x1b', i)
    if (escIndex === -1) {
      // No ESC anywhere ahead — flush the rest and stop.
      out += data.slice(i)
      break
    }

    // Emit everything before the ESC.
    if (escIndex > i) {
      out += data.slice(i, escIndex)
      i = escIndex
    }

    // We're at ESC. Need at least one more byte to know if it's an OSC introducer.
    if (i + 1 >= n) {
      state.pending = data.slice(i)
      // Cap buffer growth to avoid unbounded memory if a peer dribbles ESC bytes.
      if (state.pending.length > MAX_BUFFER_BYTES) {
        out += state.pending
        state.pending = ''
      }
      return out
    }

    const next = data.charCodeAt(i + 1)
    if (next !== 0x5d /* ']' */) {
      // ESC followed by something other than ']': not an OSC. Pass ESC through
      // and keep scanning from the next byte.
      out += data[i]
      i += 1
      continue
    }

    // Find an OSC terminator (BEL or ESC \).
    const terminatorEnd = findOscTerminator(data, i + 2)
    if (terminatorEnd === -1) {
      // Sequence not complete yet. Park it and wait for more bytes.
      state.pending = data.slice(i)
      if (state.pending.length > MAX_BUFFER_BYTES) {
        // Hopelessly long pending sequence — abandon it and pass through.
        out += state.pending
        state.pending = ''
      }
      return out
    }

    const payloadStart = i + 2
    const payloadEnd = terminatorEnd.payloadEnd
    const payload = data.slice(payloadStart, payloadEnd)
    const consumed = terminatorEnd.consumedEnd

    if (handleOscPayload(payload, handlers)) {
      // Recognised: drop the entire sequence (intro + payload + terminator).
      i = consumed
    } else {
      // Unknown OSC — forward verbatim.
      out += data.slice(i, consumed)
      i = consumed
    }
  }

  return out
}

function findOscTerminator(
  data: string,
  from: number
): { payloadEnd: number; consumedEnd: number } | -1 {
  for (let i = from; i < data.length; i++) {
    const c = data.charCodeAt(i)
    if (c === BEL) {
      return { payloadEnd: i, consumedEnd: i + 1 }
    }
    if (c === ESC && i + 1 < data.length && data.charCodeAt(i + 1) === BACKSLASH) {
      return { payloadEnd: i, consumedEnd: i + 2 }
    }
  }
  return -1
}

function handleOscPayload(payload: string, handlers: OscHandlers): boolean {
  // OSC 133 — shell integration markers.
  if (payload === '133;A') {
    handlers.onPromptStart?.()
    return true
  }
  if (payload === '133;C') {
    handlers.onCommandPre?.()
    return true
  }
  if (payload === '133;D') {
    handlers.onCommandDone?.(null)
    return true
  }
  if (payload.startsWith('133;D;')) {
    const codeStr = payload.slice(6)
    const code = Number.parseInt(codeStr, 10)
    handlers.onCommandDone?.(Number.isFinite(code) ? code : null)
    return true
  }

  // OSC 633;E — command text payload (base64-encoded).
  if (payload.startsWith('633;E;')) {
    const encoded = payload.slice(6)
    const decoded = decodeBase64Safe(encoded)
    if (decoded !== null) {
      handlers.onCommandText?.(decoded)
    }
    return true
  }

  // Also accept OSC 133;B (prompt end / command start) silently to keep streams
  // clean for users whose shell emits it — we just don't act on it.
  if (payload === '133;B') {
    return true
  }

  return false
}

function decodeBase64Safe(encoded: string): string | null {
  const trimmed = encoded.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/=]*$/.test(trimmed)) {
    return null
  }
  try {
    return Buffer.from(trimmed, 'base64').toString('utf8')
  } catch {
    return null
  }
}

// Re-export for tests / external callers that want to construct OSC bytes.
export { OSC_INTRO }
