jest.mock('../../../storage/character-selection', () => ({
  replaceTrackedCharacter: jest.fn(),
}))
const { replaceTrackedCharacter: replaceTrackedCharacterMock } = jest.requireMock(
  '../../../storage/character-selection',
) as Record<string, jest.Mock>

import { resetWorldLeapStoreForTests, useWorldLeapStore } from '../world-leap-store'
import type { WorldLeapCandidate } from '../world-leap'

const 후보: WorldLeapCandidate = {
  from: { ocid: 'old', name: '지내우시', world: '챌린저스2', jobClass: '레테', level: 285 },
  to: { ocid: 'new', name: '지내우시', world: '엘리시움', jobClass: '레테', level: 285 },
}

beforeEach(() => {
  replaceTrackedCharacterMock.mockReset().mockResolvedValue(undefined)
  resetWorldLeapStoreForTests()
})

it('짚은 것을 들고 있는다', () => {
  useWorldLeapStore.getState().noticeWorldLeap(후보)
  expect(useWorldLeapStore.getState().candidate).toEqual(후보)
})

// 한 계정이 통째로 이전하면 후보가 여럿이다. 모달을 쌓으면 사용자가 같은 질문에 연달아 답한다.
it('이미 하나를 들고 있으면 둘째를 안 받는다', () => {
  const 둘째: WorldLeapCandidate = { ...후보, from: { ...후보.from, ocid: 'old-2' } }
  useWorldLeapStore.getState().noticeWorldLeap(후보)
  useWorldLeapStore.getState().noticeWorldLeap(둘째)
  expect(useWorldLeapStore.getState().candidate?.from.ocid).toBe('old')
})

// 화면을 오갈 때마다 로스터가 다시 돌아 같은 캐릭터를 또 짚는다.
it('나중에 를 누른 것은 이 실행 동안 다시 안 묻는다', () => {
  useWorldLeapStore.getState().noticeWorldLeap(후보)
  useWorldLeapStore.getState().dismiss()
  useWorldLeapStore.getState().noticeWorldLeap(후보)
  expect(useWorldLeapStore.getState().candidate).toBeNull()
})

it('변경을 누르면 추적 목록의 ocid 를 갈아끼우고 모달을 닫는다', async () => {
  useWorldLeapStore.getState().noticeWorldLeap(후보)
  await useWorldLeapStore.getState().confirm()

  expect(replaceTrackedCharacterMock).toHaveBeenCalledWith('old', 'new')
  expect(useWorldLeapStore.getState().candidate).toBeNull()
})

// 저장이 실패했는데 모달만 사라지면 사용자는 바뀐 줄 안다.
it('교체가 실패하면 모달을 안 닫는다', async () => {
  replaceTrackedCharacterMock.mockRejectedValue(new Error('저장 실패'))
  useWorldLeapStore.getState().noticeWorldLeap(후보)

  await expect(useWorldLeapStore.getState().confirm()).rejects.toThrow('저장 실패')
  expect(useWorldLeapStore.getState().candidate).toEqual(후보)
})

it('들고 있는 것이 없으면 확인도 거절도 아무 일을 안 한다', async () => {
  await useWorldLeapStore.getState().confirm()
  useWorldLeapStore.getState().dismiss()

  expect(replaceTrackedCharacterMock).not.toHaveBeenCalled()
  expect(useWorldLeapStore.getState().dismissedOcids.size).toBe(0)
})
