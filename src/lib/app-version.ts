/**
 * 앱(OTA) 버전 표기. `package.json` 은 `x.y.z` 이거나, 같은 버전의 버그 수정이면 semver 빌드 메타데이터로
 * 패치 번호를 붙인 `x.y.z+n` 이다. 화면은 `x.y.z(n)` 으로 보인다.
 *
 * 버전 문자열을 글자로 맞대지 말고 이 파일의 함수를 거칠 것. `+n` 을 모르는 비교는 패치를 놓친다.
 */

/** 읽은 버전. 패치 번호가 없으면 `build` 가 0 이다. */
export interface AppVersion {
  major: number
  minor: number
  patch: number
  build: number
}

/** `+0` 은 받지 않는다. 번호 없음과 같은 뜻이 두 표기가 된다. */
const APP_VERSION = /^(\d+)\.(\d+)\.(\d+)(?:\+([1-9]\d*))?$/

/**
 * `x.y.z` · `x.y.z+n` 만 읽고 그 밖은 `null`.
 *
 * `1.0` 두 자리는 OTA 가 한 번도 작동하지 않았던 형식이라 모르는 값으로 닫는다.
 */
export function parseAppVersion(value: string): AppVersion | null {
  const match = APP_VERSION.exec(value)
  if (match === null) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    build: match[4] === undefined ? 0 : Number(match[4]),
  }
}

/** 화면에 보이는 버전. `1.0.10+1` 은 `1.0.10(1)` 이고, 읽지 못하는 값은 그대로다. */
export function formatAppVersion(value: string): string {
  const version = parseAppVersion(value)
  if (version === null) return value
  const base = `${version.major}.${version.minor}.${version.patch}`
  return version.build === 0 ? base : `${base}(${version.build})`
}

/** 패치 번호를 뗀 기본 버전. 릴리스 노트가 이 버전으로 서 있다. 읽지 못하는 값은 그대로다. */
export function baseAppVersion(value: string): string {
  const version = parseAppVersion(value)
  return version === null ? value : `${version.major}.${version.minor}.${version.patch}`
}
