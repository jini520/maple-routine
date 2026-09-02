// 순수 로직(`capacitor-storage-keys.test.ts`)이 지키는 것은 "규칙이 맞는가" 이고, 이 파일이 지키는
// 것은 **어댑터가 그 규칙을 네 연산 모두에 쓰는가** 다. 한쪽만 접두사를 붙이면 규칙 자체는 옳은 채로
// 읽기와 쓰기가 갈린다.
//
// 그래서 목으로 흉내 내는 것은 네이티브 SDK 의 동작이 아니라 **저장소 그 자체**(키→값 맵)다.
// 이 경계는 우리가 정의한 것이라(`modules/capacitor-storage/index.ts`) 상상한 SDK 를 검증하게 되지 않고,
// 대신 "실제로 어떤 키가 저장소에 들어가는가"를 그대로 들여다볼 수 있다.
//
// jest 의 기본 플랫폼은 ios 다(`jest-expo` 프리셋의 `haste.defaultPlatform`). 접두사가 붙는 쪽,
// 즉 틀리면 데이터가 안 보이는 쪽이 검사된다.

// 이름의 `mock` 접두사는 필수다. `jest.mock` 팩토리는 호출부보다 위로 끌어올려지므로,
// babel 이 그 접두사가 붙은 것만 바깥 변수 참조로 허용한다.
const mockStore = new Map<string, string>()

jest.mock('../../../../modules/capacitor-storage', () => ({
  __esModule: true,
  default: {
    getValue: async (key: string) => mockStore.get(key) ?? null,
    setValue: async (key: string, value: string) => {
      mockStore.set(key, value)
    },
    removeValue: async (key: string) => {
      mockStore.delete(key)
    },
    getAllKeys: async () => [...mockStore.keys()],
  },
}))

import { rnPreferencesPort } from '../rn-preferences'

beforeEach(() => {
  mockStore.clear()
})

describe('rnPreferencesPort (iOS)', () => {
  it('쓴 값은 접두사가 붙은 키로 저장소에 들어간다', async () => {
    await rnPreferencesPort.set('apiKey', 'live_abc')

    expect([...mockStore.entries()]).toEqual([['CapacitorStorage.apiKey', 'live_abc']])
  })

  // Capacitor 앱이 남기고 간 값을 읽는 경로 — 이 전환에서 가장 중요한 한 줄이다.
  it('Capacitor 가 저장해 둔 값을 그대로 읽는다', async () => {
    mockStore.set('CapacitorStorage.theme', '혼테일')

    expect(await rnPreferencesPort.get('theme')).toBe('혼테일')
  })

  it('없는 키는 null 이다', async () => {
    expect(await rnPreferencesPort.get('theme')).toBeNull()
  })

  it('지우면 저장소에서 사라진다', async () => {
    mockStore.set('CapacitorStorage.lastAdShownAt', '2026-08-11T00:00:00.000Z')

    await rnPreferencesPort.remove('lastAdShownAt')

    expect(mockStore.size).toBe(0)
  })

  // 이 목록이 곧 캐시 삭제 범위다(ADR-052·ADR-058). 남의 UserDefaults 키가 섞이면 그것까지 지운다.
  it('keys() 는 앱 키만, 접두사를 뗀 채로 돌려준다', async () => {
    mockStore.set('AppleLanguages', '["ko-KR"]')
    mockStore.set('CapacitorStorage.apiKey', 'live_abc')
    mockStore.set('CapacitorStorage.schedulerCache:abc123', '{}')

    expect(await rnPreferencesPort.keys()).toEqual(['apiKey', 'schedulerCache:abc123'])
  })

  it('set → keys → get 이 같은 키를 가리킨다', async () => {
    await rnPreferencesPort.set('trackedCharacters', '["abc123"]')

    const keys = await rnPreferencesPort.keys()
    expect(keys).toEqual(['trackedCharacters'])
    expect(await rnPreferencesPort.get(keys[0])).toBe('["abc123"]')
  })
})
