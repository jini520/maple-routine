import { setPreferencesPort } from '../../storage/ports'

/**
 * 인메모리 `PreferencesPort` 를 꽂는다. **step 4 부터 필요해졌다.**
 *
 * 자리표시자만 있을 때는 화면이 저장소를 안 건드렸는데, 진짜 탭 화면은 마운트하며 추적 목록을
 * 읽는다(— 빈 상태는 저장소를 읽고 확인한 뒤에만 그린다). 포트가 없으면
 * `getPreferencesPort()` 가 **던지고**(`core/storage/ports.ts` 의 의도된 설계), 그 거부가
 * 내비게이션 테스트를 화면 내용과 무관한 이유로 빨갛게 만든다.
 *
 * 스토어를 목으로 덮지 않는 이유는 이 테스트들이 보는 것이 **배선**이라서다. 목을 쓰면 step 5·7
 * 이 화면을 붙일 때마다 목 목록이 늘고, 그 목록이 곧 "무엇이 실제로 도는지 모른다"가 된다.
 * 값이 전부 비어 있으므로 화면은 추적 캐릭터 0명 가지를 그린다(네트워크 0회).
 */
export function installMemoryPreferences(): void {
  const store = new Map<string, string>()
  setPreferencesPort({
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value)
    },
    remove: async (key) => {
      store.delete(key)
    },
    keys: async () => [...store.keys()],
  })
}
