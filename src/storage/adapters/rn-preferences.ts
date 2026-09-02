import { Platform } from 'react-native'

import type { PreferencesPort } from '../ports'

import CapacitorStorage from '../../../modules/capacitor-storage'
import { toAppKeys, toNativeKey, type PreferencesPlatform } from './capacitor-storage-keys'

/**
 * 키 규칙에서 갈리는 것은 "iOS 인가 아닌가" 하나뿐이라(`capacitor-storage-keys.ts`) 여기서 좁힌다.
 * 이 앱이 빌드하는 타깃은 ios·android 둘이고, 그 밖의 플랫폼에서는 네이티브 모듈 자체가 없어
 * `requireNativeModule` 이 먼저 던진다.
 */
const platform: PreferencesPlatform = Platform.OS === 'ios' ? 'ios' : 'android'

/**
 * `PreferencesPort` 의 RN 구현(— 밖으로 나가는 시그니처는 Capacitor 구현과
 * 한 글자도 다르지 않다).
 *
 * **기존 저장소를 그대로 쓴다**(`docs/migration/data.md` 결정 1). 새 백엔드(MMKV 등)를 도입하지
 * 않는 이유는 성능이 아니라 안전이다. 옮기는 코드는 곧 "한 번에 성공해야 하는 코드"이고 전환
 * 릴리스에는 그것을 고칠 OTA 가 없다. MMKV 이관은 RN 이 안정화된 뒤의 별개 결정이다.
 *
 * 네 연산이 전부 같은 저장소를 본다. `capacitor-storage` 모듈 하나만 부르고, 키는 전부
 * `toNativeKey`/`toAppKeys` 를 거친다.
 */
export const rnPreferencesPort: PreferencesPort = {
  async get(key) {
    return await CapacitorStorage.getValue(toNativeKey(key, platform))
  },
  async set(key, value) {
    await CapacitorStorage.setValue(toNativeKey(key, platform), value)
  },
  async remove(key) {
    await CapacitorStorage.removeValue(toNativeKey(key, platform))
  },
  // `cache-data.ts` 가 이 목록을 훑어 캐시 삭제 범위와 용량을 낸다.
  // 빠지거나 빈 배열을 돌려주면 설정의 `캐시 삭제`·`계정 데이터 삭제`가 조용히 아무 일도 안 한다.
  async keys() {
    return toAppKeys(await CapacitorStorage.getAllKeys(), platform)
  },
}
