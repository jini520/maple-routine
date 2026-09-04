import type { MapleAccount } from '../../../types'
import { initialAppEntryState } from '../store'

jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
}))
const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
  setTrackedCharacterOcids: jest.fn(),
}))
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock, setTrackedCharacterOcids: setTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

jest.mock('../../tracking-mode/store', () => ({
  useTrackingModeStore: {
    getState: () => {
      mockTrackingModeRef = mockTrackingModeRef ?? { current: 'auto' }
      return { mode: mockTrackingModeRef.current }
    },
  },
}))

jest.mock('../../tracking-mode/seed', () => ({
  seedManualTrackedContent: jest.fn(),
}))
const { seedManualTrackedContent: seedManualTrackedContentMock } = jest.requireMock('../../tracking-mode/seed') as Record<string, jest.Mock>

import { useAppEntryStore } from '../store'

// 팩토리가 **모듈 평가보다 먼저** 불릴 수 있어(스토어를 import 하는 순간) `var` 로 올리고
// 읽는 자리에서 채운다.
var mockTrackingModeRef: { current: 'auto' | 'manual' } = { current: 'auto' }

function account(accountId: string): MapleAccount {
  return {
    accountId,
    characters: [
      {
        ocid: `ocid-${accountId}`,
        name: `캐릭터-${accountId}`,
        world: '베라',
        jobClass: '렌',
        level: 200,
      },
    ],
  }
}

beforeEach(() => {
  useAppEntryStore.setState(initialAppEntryState)
  setTrackedCharacterOcidsMock.mockResolvedValue(undefined)
  seedManualTrackedContentMock.mockResolvedValue(undefined)
  mockTrackingModeRef.current = 'auto'
  // 기본값 = 앱이 열리는 상태
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })
  getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-acc-1'])
})

afterEach(() => {
  jest.resetAllMocks()
})

// 끝내지 않은 설정은 그 지점부터 이어간다. 전에는 키 하나만 보고 곧바로 앱을 열어, 캐릭터를
// 고르지 않은 채 빈 메인으로 떨어졌다.
describe('useAppEntryStore.resolveFromStorage', () => {
  it('키가 없으면 signIn 이다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await useAppEntryStore.getState().resolveFromStorage()

    expect(useAppEntryStore.getState().stage).toBe('signIn')
  })

  it('추적 캐릭터를 고르지 않았으면(null) characterSetup 이다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await useAppEntryStore.getState().resolveFromStorage()

    expect(useAppEntryStore.getState().stage).toBe('characterSetup')
  })

  it('추적 캐릭터가 빈 배열이어도 미완료로 본다. 0명은 사용자 의도가 아니다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await useAppEntryStore.getState().resolveFromStorage()

    expect(useAppEntryStore.getState().stage).toBe('characterSetup')
  })

  it('키와 목록이 다 있으면 ready 다', async () => {
    await useAppEntryStore.getState().resolveFromStorage()

    expect(useAppEntryStore.getState().stage).toBe('ready')
  })
})

// 대조할 계정 식별자가 없으므로 **같은 목적을 같은 응답으로** 세운다. 막는 것은 "남의 계정 키로
// 이전 계정의 추적 목록을 그대로 쓰는 것" 하나다.
describe('useAppEntryStore.resolveAfterSignIn', () => {
  it('저장된 값이 그대로면 곧바로 ready 로 간다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-acc-1'])

    await useAppEntryStore.getState().resolveAfterSignIn([account('acc-1'), account('acc-2')])

    expect(useAppEntryStore.getState().stage).toBe('ready')
  })

  it('추적 캐릭터가 비어 있으면 characterSetup 으로 재개한다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await useAppEntryStore.getState().resolveAfterSignIn([account('acc-1')])

    expect(useAppEntryStore.getState().stage).toBe('characterSetup')
  })

  // 계정을 넘어 고르는 것이 이 설계의 본론이라, 겹치는 ocid 가 **어느 계정에** 있는지는 묻지 않는다.
  it('겹치는 ocid가 응답의 다른 계정에 있어도 재개한다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-acc-3', '없는-ocid'])

    await useAppEntryStore.getState().resolveAfterSignIn([account('acc-1'), account('acc-3')])

    expect(useAppEntryStore.getState().stage).toBe('ready')
  })

  it('하나도 없으면 재개하지 않고 characterSetup 으로 보낸다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-acc-1'])

    await useAppEntryStore.getState().resolveAfterSignIn([account('acc-9')])

    expect(useAppEntryStore.getState().stage).toBe('characterSetup')
  })

  // 이 가드가 지키는 것은 "지킬 목록" 이다. 목록이 없으면 판정 대상 자체가 없고, 글자 그대로
  // "하나도 없으면 캐릭터 설정"을 적용하면 **처음 키를 넣는 신규 사용자**도 같은 자리로 간다.
  // 결과는 같지만 근거가 다르므로 대조 자체를 건너뛴다.
  it('추적 목록이 없으면(신규 사용자) 대조하지 않고 파생 표 그대로 간다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await useAppEntryStore.getState().resolveAfterSignIn([account('acc-1')])

    expect(useAppEntryStore.getState().stage).toBe('characterSetup')
  })

  // 로그인 직후라 키는 이미 저장돼 있다. 그래도 파생이 signIn 을 돌려주면 갈 곳이 없어지므로
  // 방어적으로 캐릭터 설정에 떨어뜨린다.
  it('파생이 signIn 을 돌려줘도 로그인으로 되돌리지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await useAppEntryStore.getState().resolveAfterSignIn([account('acc-1')])

    expect(useAppEntryStore.getState().stage).toBe('characterSetup')
  })
})

// manual 로 이 단계에 들어오는 길은 캐시 데이터(general) 삭제다. trackedCharacters 만 지워지고
// trackingMode 는 남아, 다음 부팅에 manual 인 채로 여기 도착한다. 분기를 지우면 그 사용자의
// 체크리스트가 빈 채로 완료된다.
describe('useAppEntryStore.completeCharacterSetup', () => {
  it('추적 캐릭터를 저장하고, auto 모드면 시드 없이 바로 ready 로 전이한다', async () => {
    mockTrackingModeRef.current = 'auto'

    await useAppEntryStore.getState().completeCharacterSetup(['ocid-a', 'ocid-b'])

    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-a', 'ocid-b'])
    expect(seedManualTrackedContentMock).not.toHaveBeenCalled()
    expect(useAppEntryStore.getState().stage).toBe('ready')
  })

  it('manual 모드면 고른 ocid 목록을 한 번에 넘겨 시드한 뒤 ready 로 전이한다', async () => {
    mockTrackingModeRef.current = 'manual'

    await useAppEntryStore.getState().completeCharacterSetup(['ocid-a', 'ocid-b'])

    expect(setTrackedCharacterOcidsMock).toHaveBeenCalledWith(['ocid-a', 'ocid-b'])
    expect(seedManualTrackedContentMock).toHaveBeenCalledWith(['ocid-a', 'ocid-b'])
    expect(useAppEntryStore.getState().stage).toBe('ready')
  })

  it('manual 모드에서도 시드는 추적 저장 이후에 실행된다', async () => {
    mockTrackingModeRef.current = 'manual'
    const callOrder: string[] = []
    setTrackedCharacterOcidsMock.mockImplementation(async () => {
      callOrder.push('setTracked')
    })
    seedManualTrackedContentMock.mockImplementation(async () => {
      callOrder.push('seed')
    })

    await useAppEntryStore.getState().completeCharacterSetup(['ocid-a'])

    expect(callOrder).toEqual(['setTracked', 'seed'])
  })

  // 화면이 대기 표시를 CTA 스피너에서 전체 화면으로 바꾸는 신호다. 시드가 **시작될 때** 와야
  // 하고, 끝난 뒤에 오면 전체 화면 스피너가 한 프레임도 안 보인다.
  it('manual 모드면 시드가 끝나기 전에 onSeedStart 를 부른다', async () => {
    mockTrackingModeRef.current = 'manual'
    const callOrder: string[] = []
    seedManualTrackedContentMock.mockImplementation(async () => {
      callOrder.push('seed')
    })

    await useAppEntryStore
      .getState()
      .completeCharacterSetup(['ocid-a'], () => callOrder.push('onSeedStart'))

    expect(callOrder).toEqual(['onSeedStart', 'seed'])
  })

  // auto 모드는 시드가 없어 대기가 CTA 스피너 한 단으로 끝난다. 부르면 전체 화면 스피너가
  // 할 일도 없이 한 번 번쩍인다.
  it('auto 모드면 onSeedStart 를 안 부른다', async () => {
    mockTrackingModeRef.current = 'auto'
    const onSeedStart = jest.fn()

    await useAppEntryStore.getState().completeCharacterSetup(['ocid-a'], onSeedStart)

    expect(onSeedStart).not.toHaveBeenCalled()
  })
})

describe('useAppEntryStore.reset', () => {
  it('어느 단계에 있든 로그인으로 되돌린다', () => {
    useAppEntryStore.setState({ stage: 'ready' })

    useAppEntryStore.getState().reset()

    expect(useAppEntryStore.getState().stage).toBe('signIn')
  })
})
