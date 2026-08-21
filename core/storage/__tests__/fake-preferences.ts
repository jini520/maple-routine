import { vi } from 'vitest'
import { setPreferencesPort, type PreferencesPort } from '../ports'

/**
 * 테스트용 인메모리 `PreferencesPort`([[ADR-128]]).
 *
 * 포트 역전 전에는 각 테스트가 Preferences 플러그인 모듈 자체를 `vi.mock` 으로 가로챘다.
 * 이제 가짜 포트를 주입한다 — 검증 대상(어떤 키로 무엇을 쓰는가, 실패가 어떻게 전파되는가)은
 * 그대로이고 바뀌는 것은 가로채는 지점뿐이다.
 *
 * 네 메서드는 전부 `vi.fn` 이라 호출 인자 단언과 `mockRejectedValueOnce` 가 그대로 된다.
 */
export interface FakePreferences extends PreferencesPort {
  get: ReturnType<typeof vi.fn<(key: string) => Promise<string | null>>>
  set: ReturnType<typeof vi.fn<(key: string, value: string) => Promise<void>>>
  remove: ReturnType<typeof vi.fn<(key: string) => Promise<void>>>
  keys: ReturnType<typeof vi.fn<() => Promise<string[]>>>
  /** 저장된 값 전체를 비운다(플러그인의 `Preferences.clear()` 자리). */
  clear(): void
}

export function installFakePreferences(): FakePreferences {
  const store = new Map<string, string>()
  const fake: FakePreferences = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    keys: vi.fn(async () => [...store.keys()]),
    clear: () => {
      store.clear()
    },
  }
  setPreferencesPort(fake)
  return fake
}
