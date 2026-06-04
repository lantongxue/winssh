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

export interface DecodedResult {
  content: string
  encoding: string
}

export function smartDecode(buffer: Buffer): DecodedResult {
  if (buffer.length === 0) return { content: '', encoding: 'utf8' }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { content: iconv.decode(buffer, 'utf8'), encoding: 'utf8' }
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { content: iconv.decode(buffer, 'utf16-le'), encoding: 'utf16-le' }
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { content: iconv.decode(buffer, 'utf16-be'), encoding: 'utf16-be' }
  }

  const utf8Str = buffer.toString('utf8')
  if (!utf8Str.includes('\uFFFD')) {
    return { content: utf8Str, encoding: 'utf8' }
  }

  const detection = jschardet.detect(buffer)
  const rawEncoding = detection.encoding
  const confidence = detection.confidence

  let encoding = 'gbk'
  if (rawEncoding && confidence >= 0.5) {
    const resolved = normalizeEncoding(rawEncoding)
    if (resolved) {
      encoding = resolved
    }
  }

  try {
    const decoded = iconv.decode(buffer, encoding)
    if (decoded) return { content: decoded, encoding }
  } catch {}

  return { content: buffer.toString('utf8'), encoding: 'utf8' }
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
