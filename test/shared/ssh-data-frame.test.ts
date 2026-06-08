import {
  decodeSshDataFrame,
  encodeSshDataFrame,
  SSH_DATA_FRAME_HEADER_BYTES
} from '@shared/ssh-data-frame'

describe('ssh data frame', () => {
  it('round-trips sequence, timestamp, and payload', () => {
    const payload = new TextEncoder().encode('hello')
    const frame = encodeSshDataFrame({ seq: 7, sentAtMs: 1234.5, payload })
    const decoded = decodeSshDataFrame(frame)

    expect(decoded.seq).toBe(7)
    expect(decoded.sentAtMs).toBe(1234.5)
    expect(new TextDecoder().decode(decoded.payload)).toBe('hello')
  })

  it('rejects a truncated frame', () => {
    expect(() => decodeSshDataFrame(new ArrayBuffer(SSH_DATA_FRAME_HEADER_BYTES - 1))).toThrow(
      'Invalid SSH data frame'
    )
  })
})
