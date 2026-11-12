// 메이플 ID 이름은 사용자가 바꾼 것만 저장하고, 기본 이름은 그릴 때 짓는다. 기본 이름까지 저장하면 기본 이름의 규칙을 바꿔도
// 저장된 옛 이름이 남는다.
import { mapleIdNameOf } from '../../../lib/maple-id-name'

jest.mock('../../../storage/maple-id-names', () => ({
  getMapleIdNames: jest.fn(),
  setMapleIdNames: jest.fn(async () => undefined),
}))
const { getMapleIdNames, setMapleIdNames } = jest.requireMock('../../../storage/maple-id-names') as Record<string, jest.Mock>

const { useMapleIdNamesStore } = require('../names') as typeof import('../names')

beforeEach(() => {
  jest.clearAllMocks()
  useMapleIdNamesStore.setState({ names: {} })
})

it('바꾼 이름이 있으면 그 이름, 없으면 메이플ID- 와 ID 앞 8자다', () => {
  expect(mapleIdNameOf('da9b2f21c3e4', { da9b2f21c3e4: '본캐' })).toBe('본캐')
  expect(mapleIdNameOf('4f1c08abff', { da9b2f21c3e4: '본캐' })).toBe('메이플ID-4f1c08ab')
})

it('저장하면 고친 이름만 바꾸고, 빈 칸이면 저장한 이름을 지워 기본 이름으로 돌아간다', async () => {
  useMapleIdNamesStore.setState({ names: { a: '본캐', b: '부캐' } })

  await useMapleIdNamesStore.getState().save({ a: '  ', c: ' 창고 ' })

  expect(useMapleIdNamesStore.getState().names).toEqual({ b: '부캐', c: '창고' })
  expect(setMapleIdNames).toHaveBeenCalledWith({ b: '부캐', c: '창고' })
})

it('다른 메이플 ID 와 같은 이름도 저장한다', async () => {
  useMapleIdNamesStore.setState({ names: { a: '본캐' } })

  await useMapleIdNamesStore.getState().save({ b: '본캐' })

  expect(useMapleIdNamesStore.getState().names).toEqual({ a: '본캐', b: '본캐' })
})

it('복원은 기기에 적힌 이름을 읽고, 못 읽으면 빈 값이다', async () => {
  getMapleIdNames.mockResolvedValueOnce({ a: '본캐' })
  await useMapleIdNamesStore.getState().restoreFromStorage()
  expect(useMapleIdNamesStore.getState().names).toEqual({ a: '본캐' })

  useMapleIdNamesStore.setState({ names: {} })
  getMapleIdNames.mockRejectedValueOnce(new Error('읽기 실패'))
  await useMapleIdNamesStore.getState().restoreFromStorage()
  expect(useMapleIdNamesStore.getState().names).toEqual({})
})
