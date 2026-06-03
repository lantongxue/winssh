import { describe, expect, it } from 'vitest'
import { createOscScannerState, scanOscChunk } from '@main/osc-scanner'

interface CapturedEvents {
  promptStart: number
  commandPre: number
  commandDone: Array<number | null>
  commandText: string[]
  cwd: string[]
}

function makeHandlers() {
  const events: CapturedEvents = {
    promptStart: 0,
    commandPre: 0,
    commandDone: [],
    commandText: [],
    cwd: []
  }
  const handlers = {
    onPromptStart: () => {
      events.promptStart++
    },
    onCommandPre: () => {
      events.commandPre++
    },
    onCommandDone: (code: number | null) => {
      events.commandDone.push(code)
    },
    onCommandText: (text: string) => {
      events.commandText.push(text)
    },
    onCwd: (cwd: string) => {
      events.cwd.push(cwd)
    }
  }
  return { events, handlers }
}

function encodeBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

function osc(payload: string): string {
  return `\x1b]${payload}\x07`
}

describe('scanOscChunk', () => {
  it('passes raw text through unchanged when no markers are present', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const out = scanOscChunk(state, 'hello world', handlers)
    expect(out).toBe('hello world')
    expect(events.promptStart).toBe(0)
    expect(events.commandDone).toEqual([])
  })

  it('strips OSC 133 markers and dispatches handlers', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const input = `prefix${osc('133;A')}body${osc('133;C')}mid${osc('133;D;0')}suffix`
    const out = scanOscChunk(state, input, handlers)
    expect(out).toBe('prefixbodymidsuffix')
    expect(events.promptStart).toBe(1)
    expect(events.commandPre).toBe(1)
    expect(events.commandDone).toEqual([0])
  })

  it('decodes base64 command text from OSC 633;E', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const cmd = 'echo "hello world"\nls -la'
    const input = osc(`633;E;${encodeBase64(cmd)}`)
    const out = scanOscChunk(state, input, handlers)
    expect(out).toBe('')
    expect(events.commandText).toEqual([cmd])
  })

  it('captures exit code 130 (Ctrl-C)', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    scanOscChunk(state, osc('133;D;130'), handlers)
    expect(events.commandDone).toEqual([130])
  })

  it('handles ST (ESC \\) terminator equivalently to BEL', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const cmd = 'whoami'
    const input = `pre\x1b]633;E;${encodeBase64(cmd)}\x1b\\post`
    const out = scanOscChunk(state, input, handlers)
    expect(out).toBe('prepost')
    expect(events.commandText).toEqual([cmd])
  })

  it('extracts working directory from OSC 133;P;Cwd and OSC 633;P;Cwd', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const out = scanOscChunk(state, `prefix${osc('133;P;Cwd=/var/log')}suffix`, handlers)
    expect(out).toBe('prefixsuffix')
    expect(events.cwd).toEqual(['/var/log'])
  })

  it('forwards unknown OSC sequences verbatim', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const unknown = '\x1b]999;weird\x07'
    const out = scanOscChunk(state, `pre${unknown}post`, handlers)
    expect(out).toBe(`pre${unknown}post`)
    expect(events.promptStart).toBe(0)
  })

  it('reassembles sequences split across chunk boundaries', () => {
    const cmd = 'cat /etc/hosts'
    const full = `prefix${osc(`633;E;${encodeBase64(cmd)}`)}${osc('133;C')}suffix`
    for (let split = 1; split < full.length; split++) {
      const state = createOscScannerState()
      const { handlers, events } = makeHandlers()
      const a = scanOscChunk(state, full.slice(0, split), handlers)
      const b = scanOscChunk(state, full.slice(split), handlers)
      expect(a + b).toBe('prefixsuffix')
      expect(events.commandText).toEqual([cmd])
      expect(events.commandPre).toBe(1)
    }
  })

  it('passes through trailing ESC if no continuation arrives within limit', () => {
    const state = createOscScannerState()
    const { handlers } = makeHandlers()
    // First chunk holds only ESC. It should be parked.
    const first = scanOscChunk(state, 'pre\x1b', handlers)
    expect(first).toBe('pre')
    // Send a second chunk that doesn't continue the OSC — it should resolve as
    // an ESC-followed-by-non-]: passed through verbatim, then 'X'.
    const second = scanOscChunk(state, 'X', handlers)
    expect(second).toBe('\x1bX')
  })

  it('records a command-done with null exit code if no code is supplied', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    scanOscChunk(state, osc('133;D'), handlers)
    expect(events.commandDone).toEqual([null])
  })

  it('handles a full session-like stream with interleaved markers', () => {
    const state = createOscScannerState()
    const { handlers, events } = makeHandlers()
    const cmd = 'ls -la'
    const input = [
      osc('133;A'),
      'user@host:~$ ',
      osc(`633;E;${encodeBase64(cmd)}`),
      osc('133;C'),
      'total 0\n',
      osc('133;D;0'),
      osc('133;A')
    ].join('')
    const out = scanOscChunk(state, input, handlers)
    expect(out).toBe('user@host:~$ total 0\n')
    expect(events.promptStart).toBe(2)
    expect(events.commandText).toEqual([cmd])
    expect(events.commandPre).toBe(1)
    expect(events.commandDone).toEqual([0])
  })
})
