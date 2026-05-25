import iconv from 'iconv-lite'
import { describe, expect, it } from 'vitest'
import { smartDecodeBuffer } from '@main/encoding'

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
})
