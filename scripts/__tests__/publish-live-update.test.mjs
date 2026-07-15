import { describe, expect, it } from 'vitest'
import { parseArgs, resolveBuildScript, resolveReleaseTag } from '../publish-live-update.mjs'

describe('resolveReleaseTag', () => {
  it('isBeta가 true면 live-update-beta를 반환한다', () => {
    expect(resolveReleaseTag(true)).toBe('live-update-beta')
  })

  it('isBeta가 false면 live-update-latest를 반환한다', () => {
    expect(resolveReleaseTag(false)).toBe('live-update-latest')
  })
})

describe('resolveBuildScript', () => {
  it('isBeta가 true면 build:beta를 반환한다', () => {
    expect(resolveBuildScript(true)).toBe('build:beta')
  })

  it('isBeta가 false면 build를 반환한다', () => {
    expect(resolveBuildScript(false)).toBe('build')
  })
})

describe('parseArgs', () => {
  it('버전만 주어지면 isBeta는 false다', () => {
    expect(parseArgs(['1.2.3'])).toEqual({ version: '1.2.3', isBeta: false, minNativeVersion: undefined })
  })

  it('--beta가 버전 뒤에 오면 인식한다', () => {
    expect(parseArgs(['1.2.3', '--beta'])).toEqual({ version: '1.2.3', isBeta: true, minNativeVersion: undefined })
  })

  it('--beta가 버전 앞에 와도 인식한다(위치 무관)', () => {
    expect(parseArgs(['--beta', '1.2.3'])).toEqual({ version: '1.2.3', isBeta: true, minNativeVersion: undefined })
  })

  it('인자가 없으면 version은 undefined다', () => {
    expect(parseArgs([])).toEqual({ version: undefined, isBeta: false, minNativeVersion: undefined })
  })

  it('--min-native <x.y.z>를 파싱하고 그 값을 version으로 오인하지 않는다', () => {
    expect(parseArgs(['1.2.3', '--beta', '--min-native', '2.0.0'])).toEqual({
      version: '1.2.3',
      isBeta: true,
      minNativeVersion: '2.0.0',
    })
  })

  it('--min-native가 버전 앞에 와도 위치 무관하게 파싱한다', () => {
    expect(parseArgs(['--min-native', '2.0.0', '1.2.3'])).toEqual({
      version: '1.2.3',
      isBeta: false,
      minNativeVersion: '2.0.0',
    })
  })
})
