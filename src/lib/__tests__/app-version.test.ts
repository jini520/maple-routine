// 앱(OTA) 버전 표기. 같은 버전의 버그 수정 OTA 는 semver 빌드 메타데이터로 패치 번호를 든다.
import { baseAppVersion, formatAppVersion, parseAppVersion } from '../app-version'

describe('parseAppVersion', () => {
  it('x.y.z 는 패치 번호 0 이다', () => {
    expect(parseAppVersion('1.0.10')).toEqual({ major: 1, minor: 0, patch: 10, build: 0 })
  })

  it('x.y.z+n 은 n 이 패치 번호다', () => {
    expect(parseAppVersion('1.0.10+2')).toEqual({ major: 1, minor: 0, patch: 10, build: 2 })
  })

  // `1.0` 두 자리는 OTA 가 한 번도 작동하지 않았던 형식이다. 모르는 형식은 읽지 않는다.
  it.each(['1.0', '1.0.10(1)', '1.0.10-1', '1.0.10+0', '1.0.10+', '1.0.10+a', 'v1.0.10', ''])(
    '%s 는 읽지 않는다',
    (value) => {
      expect(parseAppVersion(value)).toBeNull()
    },
  )
})

describe('formatAppVersion', () => {
  it('패치 번호를 괄호로 보인다', () => {
    expect(formatAppVersion('1.0.10+1')).toBe('1.0.10(1)')
  })

  it('번호가 없으면 그대로다', () => {
    expect(formatAppVersion('1.0.10')).toBe('1.0.10')
  })

  it('읽지 못하는 값은 그대로 보인다', () => {
    expect(formatAppVersion('알 수 없음')).toBe('알 수 없음')
  })
})

describe('baseAppVersion', () => {
  it('패치 번호를 뗀 기본 버전이다. 릴리스 노트가 이 버전으로 서 있다', () => {
    expect(baseAppVersion('1.0.10+3')).toBe('1.0.10')
    expect(baseAppVersion('1.0.10')).toBe('1.0.10')
  })

  it('읽지 못하는 값은 그대로다', () => {
    expect(baseAppVersion('1.0')).toBe('1.0')
  })
})
