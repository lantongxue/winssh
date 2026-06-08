export const SSH_DATA_FRAME_HEADER_BYTES = 16

export interface SshDataFrameInput {
  seq: number
  sentAtMs: number
  payload: Uint8Array
}

export interface SshDataFrame {
  seq: number
  sentAtMs: number
  payload: Uint8Array
}

export function encodeSshDataFrame(input: SshDataFrameInput): ArrayBuffer {
  const buffer = new ArrayBuffer(SSH_DATA_FRAME_HEADER_BYTES + input.payload.byteLength)
  const view = new DataView(buffer)

  view.setUint32(0, input.seq, false)
  view.setFloat64(4, input.sentAtMs, false)
  view.setUint32(12, input.payload.byteLength, false)
  new Uint8Array(buffer, SSH_DATA_FRAME_HEADER_BYTES).set(input.payload)

  return buffer
}

export function decodeSshDataFrame(buffer: ArrayBuffer): SshDataFrame {
  if (buffer.byteLength < SSH_DATA_FRAME_HEADER_BYTES) {
    throw new Error('Invalid SSH data frame: header is truncated')
  }

  const view = new DataView(buffer)
  const payloadLength = view.getUint32(12, false)
  const expectedLength = SSH_DATA_FRAME_HEADER_BYTES + payloadLength

  if (buffer.byteLength !== expectedLength) {
    throw new Error('Invalid SSH data frame: payload length mismatch')
  }

  return {
    seq: view.getUint32(0, false),
    sentAtMs: view.getFloat64(4, false),
    payload: new Uint8Array(buffer, SSH_DATA_FRAME_HEADER_BYTES, payloadLength)
  }
}
