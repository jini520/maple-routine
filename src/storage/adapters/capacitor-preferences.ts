// @capacitor/preferences는 평문 저장이며 Keychain/Keystore 수준 암호화를 보장하지 않는다 — 강화된 보안 저장 도입은 이후 별도 task로 미룬다 (ADR-007).
import { Preferences } from '@capacitor/preferences'
import type { PreferencesPort } from '../ports'

/**
 * `PreferencesPort` 의 Capacitor 구현([[ADR-127]]).
 *
 * 저장 위치는 프레임워크가 아니라 **앱 번들 ID에 귀속된다** — Android `CapacitorStorage`
 * SharedPreferences / iOS `UserDefaults` 의 `"CapacitorStorage."` 접두사(`docs/migration/data.md`
 * 결정 1). 다른 프레임워크의 구현이 같은 저장소를 그대로 읽으면 마이그레이션 자체가 필요 없다.
 */
export const capacitorPreferencesPort: PreferencesPort = {
  async get(key) {
    const { value } = await Preferences.get({ key })
    return value
  },
  async set(key, value) {
    await Preferences.set({ key, value })
  },
  async remove(key) {
    await Preferences.remove({ key })
  },
  async keys() {
    const { keys } = await Preferences.keys()
    return keys
  },
}
