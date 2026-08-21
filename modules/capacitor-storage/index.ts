import { requireNativeModule } from 'expo'

/**
 * Capacitor 시절 저장소를 **그대로** 여는 로컬 네이티브 모듈([[ADR-128]] 결정 5,
 * `docs/migration/data.md` 결정 1).
 *
 * 이 앱의 기존 데이터는 "Capacitor 안"이 아니라 **OS 가 앱 번들 ID 마다 주는 표준 저장소**에 있다.
 * 같은 `com.mapleroutine.app` 으로 빌드하면 그냥 읽히므로 마이그레이션 코드가 없다 — 옮기는 코드는
 * 곧 "한 번에 성공해야 하는 코드"이고, 전환 릴리스에는 그것을 고칠 OTA 가 없다.
 *
 * | | 저장소 |
 * |---|---|
 * | Android | `getSharedPreferences("CapacitorStorage", MODE_PRIVATE)` |
 * | iOS | `UserDefaults.standard` |
 *
 * **키는 손대지 않는다.** iOS 의 `"CapacitorStorage."` 접두사는 여기가 아니라
 * `src/storage/adapters/capacitor-storage-keys.ts` 가 붙이고 뗀다 — 문자열 연산이라 TS 에 두면
 * 실기기 없이 검증되고, 그 파일이 이유를 적어 두었다. 그래서 이 모듈이 받는 키는 **저장소에 실제로
 * 들어가는 그대로의 키**다.
 *
 * 네 연산이 전부 `AsyncFunction` 인 것은 `PreferencesPort` 가 비동기이기도 하지만, 무엇보다 첫
 * 접근에서 SharedPreferences 가 XML 을 디스크에서 읽어 들이기 때문이다 — 그 대기를 JS 스레드에
 * 올리지 않는다.
 */
export interface CapacitorStorageNativeModule {
  getValue(key: string): Promise<string | null>
  setValue(key: string, value: string): Promise<void>
  removeValue(key: string): Promise<void>
  /** 저장소의 **날 것 그대로의** 키 전부. iOS 는 남의 `UserDefaults` 키까지 섞여 온다. */
  getAllKeys(): Promise<string[]>
}

export default requireNativeModule<CapacitorStorageNativeModule>('CapacitorStorage')
