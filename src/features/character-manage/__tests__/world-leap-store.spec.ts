jest.mock('../../../storage/character-selection', () => ({
  replaceTrackedCharacter: jest.fn(),
  removeTrackedCharacter: jest.fn(),
}))
const {
  replaceTrackedCharacter: replaceTrackedCharacterMock,
  removeTrackedCharacter: removeTrackedCharacterMock,
} = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

import { resetWorldLeapStoreForTests, useWorldLeapStore } from '../world-leap-store'
import type { WorldLeapNotice } from '../world-leap'

const 옛것 = { ocid: 'old', name: '지내우시', world: '챌린저스2', jobClass: '레테', level: 285 }

const 짚음: WorldLeapNotice = {
  kind: 'confirmed',
  from: 옛것,
  to: { ocid: 'new', name: '지내우시', world: '엘리시움', jobClass: '레테', level: 285 },
}

const 모름: WorldLeapNotice = { kind: 'unknown', from: 옛것 }

/** 옮겨간 캐릭터를 이미 관리 중이다. 할 일이 교체가 아니라 옛 것 해제다. */
const 이미관리중: WorldLeapNotice = { ...짚음, kind: 'alreadyTracked' }

beforeEach(() => {
  replaceTrackedCharacterMock.mockReset().mockResolvedValue(undefined)
  removeTrackedCharacterMock.mockReset().mockResolvedValue(undefined)
  resetWorldLeapStoreForTests()
})

it('짚은 것을 들고 있는다', () => {
  useWorldLeapStore.getState().noticeWorldLeap(짚음)
  expect(useWorldLeapStore.getState().notice).toEqual(짚음)
})

// 한 계정이 통째로 이전하면 후보가 여럿이다. 모달을 쌓으면 사용자가 같은 질문에 연달아 답한다.
it('이미 하나를 들고 있으면 둘째를 안 받는다', () => {
  const 둘째: WorldLeapNotice = { ...짚음, from: { ...옛것, ocid: 'old-2' } }
  useWorldLeapStore.getState().noticeWorldLeap(짚음)
  useWorldLeapStore.getState().noticeWorldLeap(둘째)
  expect(useWorldLeapStore.getState().notice?.from.ocid).toBe('old')
})

// 화면을 오갈 때마다 로스터가 다시 돌아 같은 캐릭터를 또 짚는다. 캐릭터 관리로 보낸 직후가
// 특히 그렇다 - 그 화면에 닿는 순간 로스터가 돌아 방금 보낸 화면을 같은 모달이 덮는다.
it('나중에 를 누른 것은 이 실행 동안 다시 안 묻는다', () => {
  useWorldLeapStore.getState().noticeWorldLeap(짚음)
  useWorldLeapStore.getState().dismiss()
  useWorldLeapStore.getState().noticeWorldLeap(짚음)
  expect(useWorldLeapStore.getState().notice).toBeNull()
})

it('변경을 누르면 추적 목록의 ocid 를 갈아끼우고 모달을 닫는다', async () => {
  useWorldLeapStore.getState().noticeWorldLeap(짚음)
  await useWorldLeapStore.getState().confirm()

  expect(replaceTrackedCharacterMock).toHaveBeenCalledWith('old', 'new')
  expect(useWorldLeapStore.getState().notice).toBeNull()
})

// 모달이 화면 밖으로 나가 초안에 손이 안 닿는다. 초안이 이 값을 구독해 자기 목록도 옮긴다.
it('갈아끼운 자리를 남겨 초안이 따라올 수 있게 한다', async () => {
  useWorldLeapStore.getState().noticeWorldLeap(짚음)
  await useWorldLeapStore.getState().confirm()

  expect(useWorldLeapStore.getState().resolved).toEqual({ from: 'old', to: 'new' })
})

// 옮겨간 캐릭터가 이미 목록에 있으므로 더할 것이 없다. 남은 것은 조회할 수 없는 옛 ocid 뿐이다.
describe('옮겨간 캐릭터를 이미 관리 중일 때', () => {
  it('목록에서 빼기 를 누르면 그 ocid 만 빼고 모달을 닫는다', async () => {
    removeTrackedCharacterMock.mockResolvedValue(['new'])
    useWorldLeapStore.getState().noticeWorldLeap(이미관리중)

    await expect(useWorldLeapStore.getState().confirm()).resolves.toEqual(['new'])
    expect(removeTrackedCharacterMock).toHaveBeenCalledWith('old')
    expect(replaceTrackedCharacterMock).not.toHaveBeenCalled()
    expect(useWorldLeapStore.getState().notice).toBeNull()
  })

  it('뺀 자리를 남겨 초안이 따라올 수 있게 한다', async () => {
    useWorldLeapStore.getState().noticeWorldLeap(이미관리중)
    await useWorldLeapStore.getState().confirm()

    expect(useWorldLeapStore.getState().resolved).toEqual({ from: 'old', to: null })
  })

  it('빼기가 실패하면 모달을 안 닫는다', async () => {
    removeTrackedCharacterMock.mockRejectedValue(new Error('저장 실패'))
    useWorldLeapStore.getState().noticeWorldLeap(이미관리중)

    await expect(useWorldLeapStore.getState().confirm()).rejects.toThrow('저장 실패')
    expect(useWorldLeapStore.getState().notice).toEqual(이미관리중)
  })
})

// 목적지를 모르는 것은 바꿀 대상이 없다. 그 모달의 주 버튼은 캐릭터 관리로 이동이다.
it('목적지를 모르면 갈아끼우지 않는다', async () => {
  useWorldLeapStore.getState().noticeWorldLeap(모름)

  await expect(useWorldLeapStore.getState().confirm()).resolves.toBeNull()
  expect(replaceTrackedCharacterMock).not.toHaveBeenCalled()
  expect(useWorldLeapStore.getState().notice).toEqual(모름)
})

// 저장이 실패했는데 모달만 사라지면 사용자는 바뀐 줄 안다.
it('교체가 실패하면 모달을 안 닫는다', async () => {
  replaceTrackedCharacterMock.mockRejectedValue(new Error('저장 실패'))
  useWorldLeapStore.getState().noticeWorldLeap(짚음)

  await expect(useWorldLeapStore.getState().confirm()).rejects.toThrow('저장 실패')
  expect(useWorldLeapStore.getState().notice).toEqual(짚음)
})

it('들고 있는 것이 없으면 확인도 거절도 아무 일을 안 한다', async () => {
  await useWorldLeapStore.getState().confirm()
  useWorldLeapStore.getState().dismiss()

  expect(replaceTrackedCharacterMock).not.toHaveBeenCalled()
  expect(removeTrackedCharacterMock).not.toHaveBeenCalled()
  expect(useWorldLeapStore.getState().dismissedOcids.size).toBe(0)
})
