// `/latest` 판정. 프로토콜이 204 로 삼킨 **스토어 업데이트 필요** 를 되살리는 자리다.
//
// 이 스위트가 지키는 것은 **심사 담당자가 잠기지 않는 것**이다. 판정이 값 하나와 같은가 였을 때,
// 새 바이너리는 `latest-*.json` 이 갱신되기 전까지 자기 지문이 안 맞아 스토어 업데이트 필요로
// 떨어졌다. 모달에 `나중에` 가 있던 동안은 닫고 쓸 수 있어 아무도 안 밟았는데,
// 잠금으로 바꾸면 그 사람은 켜자마자 못 쓰는 앱을 본다.
//
// 변수 이름이 `mock` 으로 시작하는 것은 취향이 아니다. jest 가 `jest.mock` 팩토리에서 바깥 변수를
// 참조하는 것을 막는데(호이스팅 때문에 초기화 전 접근이 될 수 있다) 그 접두사만 예외로 둔다.
// 게터로 감싸는 것도 같은 이유다: 팩토리는 모듈 평가보다 먼저 돈다.
let mockRuntimeVersion = 'NEW'
let mockCheckResult: { isAvailable: boolean } = { isAvailable: false }
let mockManifest: unknown = {}
let mockExpoConfig: { version?: string } | null = null

jest.mock('expo-updates', () => ({
  __esModule: true,
  get runtimeVersion() {
    return mockRuntimeVersion
  },
  isEnabled: true,
  channel: 'production',
  get manifest() {
    return mockManifest
  },
  checkForUpdateAsync: jest.fn(async () => mockCheckResult),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  addUpdatesStateChangeListener: jest.fn(() => ({ remove: jest.fn() })),
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig
    },
  },
}))

import packageJson from '../../../../package.json'
import { rnLiveUpdatePort } from '../rn-live-update'

const OLD = 'OLD'

/** `/latest` 응답 한 벌. 없는 필드를 안 지어내려고 호출부가 통째로 준다. */
function serveLatest(body: unknown, ok = true): jest.Mock {
  const fetchMock = jest.fn(async () => ({ ok, json: async () => body }))
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

beforeEach(() => {
  mockRuntimeVersion = 'NEW'
  mockCheckResult = { isAvailable: false }
  mockManifest = {}
  mockExpoConfig = null
})

describe('check: 받는 지문 목록으로 스토어 업데이트 필요를 가른다', () => {
  it('목록에 내 지문이 있으면 최신이다', async () => {
    serveLatest({
      runtimeVersion: OLD,
      acceptedRuntimeVersions: [OLD, 'NEW'],
      appVersion: '1.0.8',
    })

    // 심사 기간의 상태다. 정당한 바이너리가 둘이라 둘 다 통과해야 한다.
    await expect(rnLiveUpdatePort.check()).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('옛 바이너리는 같은 목록에서 갈린다', async () => {
    mockRuntimeVersion = OLD
    serveLatest({ runtimeVersion: 'NEW', acceptedRuntimeVersions: ['NEW'], appVersion: '1.0.8' })

    // 출시 후의 상태다. 목록에서 옛 지문을 뺀 것이 곧 잠금 스위치다.
    await expect(rnLiveUpdatePort.check()).resolves.toEqual({
      kind: 'store-required',
      version: '1.0.8',
    })
  })

  it('목록이 없으면 `runtimeVersion` 하나로 판정한다', async () => {
    // 옛 발행이 만든 파일에는 이 필드가 없다. 폴백이 곧 지금 동작이라야 그 파일을 읽는 기기가
    // 거짓으로 잠기지 않는다.
    serveLatest({ runtimeVersion: 'NEW', appVersion: '1.0.8' })

    await expect(rnLiveUpdatePort.check()).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('목록이 비어 있어도 `runtimeVersion` 하나로 판정한다', async () => {
    // 빈 배열을 **아무도 못 받는다** 로 읽으면 그 파일 하나로 전원이 잠긴다.
    serveLatest({ runtimeVersion: 'NEW', acceptedRuntimeVersions: [], appVersion: '1.0.8' })

    await expect(rnLiveUpdatePort.check()).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('목록이 문자열 배열이 아니면 무시하고 `runtimeVersion` 으로 판정한다', async () => {
    serveLatest({ runtimeVersion: 'NEW', acceptedRuntimeVersions: 'NEW', appVersion: '1.0.8' })

    await expect(rnLiveUpdatePort.check()).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('조회가 실패하면 삼킨다. 확인 안 된 것을 근거로 막지 않는다', async () => {
    serveLatest({}, false)

    await expect(rnLiveUpdatePort.check()).resolves.toEqual({ kind: 'up-to-date' })
  })

  it('받을 업데이트가 있으면 `/latest` 를 묻지 않는다', async () => {
    mockCheckResult = { isAvailable: true }
    const fetchMock = serveLatest({ runtimeVersion: 'NEW', appVersion: '1.0.8' })

    await rnLiveUpdatePort.check()

    // 최신으로 떨어졌을 때만 묻는 것이 계약이다. 매번 물으면 곁가지 실패가 본 확인을 뒤집는다.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// 설정의 `현재 버전`. 스토어 1.0.8 바이너리가 1.0.7 로 보였던 자리다. 내장 번들의 매니페스트에는
// `extra` 가 없어 `package.json` 으로 떨어졌고, 스토어 릴리스는 `app.json` 만 올렸다.
describe('getCurrentVersion: 도는 번들이 말하는 버전', () => {
  it('OTA 번들이면 매니페스트의 버전이다. 바이너리 버전보다 앞선다', async () => {
    mockManifest = { extra: { appVersion: '1.0.9' } }
    mockExpoConfig = { version: '1.0.8' }

    await expect(rnLiveUpdatePort.getCurrentVersion()).resolves.toBe('1.0.9')
  })

  it('내장 번들이면 매니페스트에 버전이 없어 바이너리에 박힌 버전이다', async () => {
    mockManifest = { id: 'embedded', commitTime: 0, assets: [] }
    mockExpoConfig = { version: '1.0.8' }

    await expect(rnLiveUpdatePort.getCurrentVersion()).resolves.toBe('1.0.8')
  })

  it('둘 다 못 읽으면 package.json 버전이다', async () => {
    mockManifest = {}
    mockExpoConfig = null

    await expect(rnLiveUpdatePort.getCurrentVersion()).resolves.toBe(packageJson.version)
  })
})
