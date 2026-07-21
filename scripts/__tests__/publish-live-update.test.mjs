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

// ADR-030(라이브 업데이트 후속): 배포 버전은 더 이상 CLI 인자로 받지 않는다 — package.json의
// version과 실제 배포 버전이 어긋날 수 있었던 근본 원인이라, package.json에서만 읽도록 통일했다.
describe('parseArgs', () => {
  it('아무 인자가 없으면 isBeta는 false다', () => {
    expect(parseArgs([])).toEqual({ isBeta: false, minNativeVersion: undefined })
  })

  it('--beta를 인식한다', () => {
    expect(parseArgs(['--beta'])).toEqual({ isBeta: true, minNativeVersion: undefined })
  })

  it('--min-native <x.y.z>를 파싱한다', () => {
    expect(parseArgs(['--beta', '--min-native', '2.0.0'])).toEqual({
      isBeta: true,
      minNativeVersion: '2.0.0',
    })
  })

  it('--min-native가 --beta 앞에 와도 위치 무관하게 파싱한다', () => {
    expect(parseArgs(['--min-native', '2.0.0', '--beta'])).toEqual({
      isBeta: true,
      minNativeVersion: '2.0.0',
    })
  })
})
