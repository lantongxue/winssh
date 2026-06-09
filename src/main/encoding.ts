import iconv from 'iconv-lite'
import jschardet from 'jschardet'

const ENCODING_MAP: Record<string, string> = {
  GB2312: 'gbk',
  GB18030: 'gb18030',
  Big5: 'big5',
  'EUC-TW': 'gbk',
  'HZ-GB-2312': 'gbk',
  ascii: 'utf8',
  'windows-1252': 'windows-1252',
  'ISO-8859-1': 'iso-8859-1'
}

function normalizeEncoding(raw: string): string | null {
  if (ENCODING_MAP[raw]) return ENCODING_MAP[raw]
  const lower = raw.toLowerCase()
  if (iconv.encodingExists(lower)) return lower
  return null
}

function utf8ValidationSample(buffer: Buffer): Buffer {
  let leadIndex = buffer.length - 1
  while (leadIndex >= 0 && (buffer[leadIndex] & 0xc0) === 0x80) {
    leadIndex -= 1
  }

  if (leadIndex < 0) return buffer

  const lead = buffer[leadIndex]
  const continuationCount = buffer.length - leadIndex - 1
  let expectedContinuations = 0

  if (lead >= 0xc2 && lead <= 0xdf) {
    expectedContinuations = 1
  } else if (lead >= 0xe0 && lead <= 0xef) {
    expectedContinuations = 2
  } else if (lead >= 0xf0 && lead <= 0xf4) {
    expectedContinuations = 3
  }

  if (expectedContinuations > continuationCount) {
    return buffer.subarray(0, leadIndex)
  }

  return buffer
}

function detectEncoding(buffer: Buffer): string {
  if (buffer.length === 0) return 'utf8'

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf8'
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'utf16-le'
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return 'utf16-be'
  }

  const utf8Str = buffer.toString('utf8')
  if (!utf8Str.includes('\uFFFD')) {
    return 'utf8'
  }

  const detection = jschardet.detect(buffer)
  const rawEncoding = detection.encoding
  const confidence = detection.confidence

  if (rawEncoding && confidence >= 0.5) {
    return normalizeEncoding(rawEncoding) ?? 'gbk'
  }

  return 'gbk'
}

function detectIncrementalEncoding(initialSample: Buffer): string {
  if (initialSample.length === 0) return 'utf8'

  if (
    initialSample.length >= 3 &&
    initialSample[0] === 0xef &&
    initialSample[1] === 0xbb &&
    initialSample[2] === 0xbf
  ) {
    return 'utf8'
  }

  if (initialSample.length >= 2 && initialSample[0] === 0xff && initialSample[1] === 0xfe) {
    return 'utf16-le'
  }

  if (initialSample.length >= 2 && initialSample[0] === 0xfe && initialSample[1] === 0xff) {
    return 'utf16-be'
  }

  const utf8Str = utf8ValidationSample(initialSample).toString('utf8')
  if (!utf8Str.includes('\uFFFD')) {
    return 'utf8'
  }

  const detection = jschardet.detect(initialSample)
  const rawEncoding = detection.encoding
  const confidence = detection.confidence

  if (rawEncoding && confidence >= 0.5) {
    return normalizeEncoding(rawEncoding) ?? 'gbk'
  }

  return 'gbk'
}

export interface DecodedResult {
  content: string
  encoding: string
}

export interface IncrementalTextDecoder {
  readonly encoding: string
  write(buffer: Buffer): string
  end(): string
}

export function smartDecode(buffer: Buffer): DecodedResult {
  if (buffer.length === 0) return { content: '', encoding: 'utf8' }

  const encoding = detectEncoding(buffer)

  try {
    const decoded = iconv.decode(buffer, encoding)
    if (decoded || encoding !== 'gbk') return { content: decoded, encoding }
  } catch {}

  return { content: buffer.toString('utf8'), encoding: 'utf8' }
}

export function createIncrementalTextDecoder(initialSample: Buffer): IncrementalTextDecoder {
  const encoding = detectIncrementalEncoding(initialSample)
  const decoder = iconv.getDecoder(encoding)

  return {
    encoding,
    write(buffer) {
      return decoder.write(buffer)
    },
    end() {
      return decoder.end() ?? ''
    }
  }
}

export function smartDecodeBuffer(buffer: Buffer): string {
  return smartDecode(buffer).content
}

export function encodeContent(contents: string, encoding = 'utf8'): Buffer {
  try {
    if (iconv.encodingExists(encoding)) {
      return iconv.encode(contents, encoding)
    }
  } catch {}
  return iconv.encode(contents, 'utf8')
}
