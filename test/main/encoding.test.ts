import iconv from 'iconv-lite'
import { describe, expect, it } from 'vitest'
import { createIncrementalTextDecoder, smartDecode, smartDecodeBuffer } from '@main/encoding'

describe('smartDecodeBuffer', () => {
  it('returns empty string for empty buffer', () => {
    expect(smartDecodeBuffer(Buffer.alloc(0))).toBe('')
  })

  it('returns ASCII text correctly', () => {
    expect(smartDecodeBuffer(Buffer.from('hello world'))).toBe('hello world')
  })

  it('decodes valid UTF-8 Chinese text', () => {
    expect(smartDecodeBuffer(Buffer.from('你好世界', 'utf8'))).toBe('你好世界')
  })

  it('decodes mixed ASCII and Chinese UTF-8 text', () => {
    expect(smartDecodeBuffer(Buffer.from('Hello 你好 #123', 'utf8'))).toBe('Hello 你好 #123')
  })

  it('strips UTF-8 BOM and returns decoded text', () => {
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('你好', 'utf8')])
    const result = smartDecodeBuffer(buffer)
    expect(result).toBe('你好')
  })

  it('decodes GBK encoded Chinese text', () => {
    const buffer = iconv.encode('你好世界', 'gbk')
    expect(smartDecodeBuffer(buffer)).toBe('你好世界')
  })

  it('decodes GB18030 encoded Chinese text', () => {
    const text = '这是一段比较长的中文文本用来测试编码检测功能是否正常工作'
    const buffer = iconv.encode(text, 'gb18030')
    expect(smartDecodeBuffer(buffer)).toBe(text)
  })

  it('decodes Big5 encoded Chinese text', () => {
    const text = '這是一段比較長的中文文字用來測試編碼檢測功能是否正常工作'
    const buffer = iconv.encode(text, 'big5')
    expect(smartDecodeBuffer(buffer)).toBe(text)
  })

  it('decodes GBK text mixed with ASCII', () => {
    const buffer = iconv.encode('Hello 你好', 'gbk')
    expect(smartDecodeBuffer(buffer)).toBe('Hello 你好')
  })

  it('preserves legacy smartDecode behavior for ASCII prefixes followed by GBK text', () => {
    const text = `${'a'.repeat(32768)}这是一段比较长的中文文本用来测试编码检测功能是否正常工作`
    const result = smartDecode(iconv.encode(text, 'gbk'))

    expect(result.content).toBe(text)
    expect(result.encoding).toBe('gbk')
  })

  it('decodes UTF-16 LE with BOM', () => {
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode('test', 'utf16-le')])
    expect(smartDecodeBuffer(buffer)).toBe('test')
  })

  it('decodes UTF-16 BE with BOM', () => {
    const buffer = Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode('test', 'utf16-be')])
    expect(smartDecodeBuffer(buffer)).toBe('test')
  })

  it('decodes Windows-1252 text', () => {
    const buffer = iconv.encode('café résumé', 'windows-1252')
    expect(smartDecodeBuffer(buffer)).toBe('café résumé')
  })

  it('does not classify incomplete UTF-8 full buffers as UTF-8', () => {
    expect(smartDecode(Buffer.from([0xe4])).encoding).not.toBe('utf8')
  })
})

describe('createIncrementalTextDecoder', () => {
  it('preserves UTF-8 characters split across chunks', () => {
    const buffer = Buffer.from('Hello 你好世界', 'utf8')
    const decoder = createIncrementalTextDecoder(buffer.subarray(0, 8))

    const parts = [
      decoder.write(buffer.subarray(0, 8)),
      decoder.write(buffer.subarray(8, 10)),
      decoder.write(buffer.subarray(10)),
      decoder.end()
    ].filter(Boolean)

    expect(decoder.encoding).toBe('utf8')
    expect(parts.join('')).toBe('Hello 你好世界')
  })

  it('detects UTF-16 LE from the initial BOM sample', () => {
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode('test', 'utf16-le')])
    const decoder = createIncrementalTextDecoder(buffer.subarray(0, 4))
    const decoded = decoder.write(buffer) + decoder.end()

    expect(decoder.encoding).toBe('utf16-le')
    expect(decoded).toBe('test')
  })

  it('uses the existing charset fallback for non-UTF initial samples', () => {
    const text = 'Hello 你好'
    const buffer = iconv.encode(text, 'gbk')
    const decoder = createIncrementalTextDecoder(buffer)
    const decoded =
      decoder.write(buffer.subarray(0, 5)) + decoder.write(buffer.subarray(5)) + decoder.end()

    expect(decoded).toBe(text)
    expect(decoder.encoding).toBe('gbk')
  })

  it('emits ASCII-only prefixes while later GBK samples determine encoding', () => {
    const text = `${'a'.repeat(32768)}这是一段比较长的中文文本用来测试编码检测功能是否正常工作`
    const buffer = iconv.encode(text, 'gbk')
    expect(smartDecode(buffer)).toMatchObject({ content: text, encoding: 'gbk' })

    const decoder = createIncrementalTextDecoder(buffer.subarray(0, 32768))

    const first = decoder.write(buffer.subarray(0, 32768))
    const second = decoder.write(buffer.subarray(32768))
    const decoded = first + second + decoder.end()

    expect(first).toBe('a'.repeat(32768))
    expect(decoded).toBe(text)
    expect(decoder.encoding).toBe('gbk')
  })

  it('keeps split GBK multibyte bytes pending while streaming safe ASCII prefixes', () => {
    const text = 'Hello 你好'
    const buffer = iconv.encode(text, 'gbk')
    const splitAfterFirstGbkByte = 'Hello '.length + 1
    const decoder = createIncrementalTextDecoder(buffer.subarray(0, splitAfterFirstGbkByte))

    const first = decoder.write(buffer.subarray(0, splitAfterFirstGbkByte))
    const second = decoder.write(buffer.subarray(splitAfterFirstGbkByte))
    const decoded = first + second + decoder.end()

    expect(first).toBe('Hello ')
    expect(decoded).toBe(text)
    expect(decoder.encoding).toBe('gbk')
  })
})
