import { describe, expect, it } from 'vitest'
import { formatBytes } from '../format-bytes'

describe('formatBytes', () => {
  it('1024바이트 미만은 B 단위로 표시한다', () => {
    expect(formatBytes(0)).toBe('0B')
    expect(formatBytes(512)).toBe('512B')
    expect(formatBytes(1023)).toBe('1023B')
  })

  it('1024바이트 이상 1024²바이트 미만은 소수 첫째 자리 KB로 표시한다', () => {
    expect(formatBytes(1024)).toBe('1.0KB')
    expect(formatBytes(1536)).toBe('1.5KB')
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0KB')
  })

  it('1024²바이트 이상은 소수 첫째 자리 MB로 표시한다', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0MB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5MB')
  })
})
