/**
 * Capacitor 저장소의 키 규칙. 여기 있는 것은 전부 순수 함수다. 네이티브 모듈은 저장소를 열어
 * 주기만 하고, 그 저장소 안에서 키를 어떻게 쓰는가 는 이 파일이 정한다.
 *
 * 두 플랫폼의 네임스페이스 방식이 애초에 다르다.
 *
 * | | 네임스페이스 방식 | TS 로 표현되는가 |
 * |---|---|---|
 * | Android | `CapacitorStorage` 라는 별도 SharedPreferences 파일 | 아니오. 파일을 여는 것은 네이티브만 할 수 있다 |
 * | iOS | 공용 `UserDefaults.standard` 안의 키 접두사 | 예. 문자열 연산이 전부다 |
 *
 * 표현되는 쪽(iOS 접두사)을 TS 에 두면 실기기 없이 검증된다. 접두사가 틀리면 예외도 없이
 * 조용히 아무것도 안 읽히고 사용자에게는 데이터가 전부 사라졌다 로 보인다.
 */

/**
 * iOS `UserDefaults` 키 접두사. **점(`.`)까지가 접두사다.**
 *
 * 원본은 `Preferences.swift` 의 `group + "."` 이고, 그룹 기본값이 `CapacitorStorage` 다
 * (그룹을 바꾼 적이 없다).
 */
export const IOS_KEY_PREFIX = 'CapacitorStorage.'

/** 이 앱이 빌드하는 두 플랫폼. 키 규칙에서 갈리는 것은 "iOS 인가 아닌가" 하나뿐이다. */
export type PreferencesPlatform = 'ios' | 'android'

/** 앱이 쓰는 키 → 저장소에 실제로 들어가는 키. */
export function toNativeKey(key: string, platform: PreferencesPlatform): string {
  return platform === 'ios' ? `${IOS_KEY_PREFIX}${key}` : key
}

/**
 * 저장소가 돌려준 키 목록 → 앱이 쓰는 키 목록. `toNativeKey` 의 정확한 역함수다.
 *
 * iOS 는 `UserDefaults.standard` 를 시스템과 함께 쓰므로 `AppleLanguages` 같은 남의 키가 섞여 온다.
 * 거르지 않으면 `cache-data.ts` 가 그것들까지 삭제 범위·용량에 넣는다.
 */
export function toAppKeys(nativeKeys: string[], platform: PreferencesPlatform): string[] {
  if (platform !== 'ios') {
    return nativeKeys
  }
  return nativeKeys
    .filter((key) => key.startsWith(IOS_KEY_PREFIX))
    .map((key) => key.slice(IOS_KEY_PREFIX.length))
}
