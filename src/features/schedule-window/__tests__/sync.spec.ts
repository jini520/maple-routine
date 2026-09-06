// 문 하나. 순서가 계약이다.
jest.mock('../window', () => ({ fillScheduleWindow: jest.fn() }))
jest.mock('../records', () => ({ recordBossProfitFromWindow: jest.fn() }))
jest.mock('../../boss-profit/defeat-dates', () => ({ resolveDefeatDates: jest.fn() }))

import { syncScheduleWindow } from '../sync'

const { fillScheduleWindow: fillMock } = jest.requireMock('../window') as Record<string, jest.Mock>
const { recordBossProfitFromWindow: recordMock } = jest.requireMock('../records') as Record<string, jest.Mock>
const { resolveDefeatDates: datesMock } = jest.requireMock('../../boss-profit/defeat-dates') as Record<string, jest.Mock>

const NOW = new Date('2026-09-05T03:00:00.000Z')

beforeEach(() => {
  fillMock.mockReset().mockResolvedValue(undefined)
  recordMock.mockReset().mockResolvedValue(undefined)
  datesMock.mockReset().mockResolvedValue(0)
})

it('채우고 · 굳히고 · 캔다. 이 순서다', async () => {
  const order: string[] = []
  fillMock.mockImplementation(async () => void order.push('fill'))
  recordMock.mockImplementation(async () => void order.push('record'))
  datesMock.mockImplementation(async () => order.push('dates'))

  await syncScheduleWindow(['o1'], NOW)

  expect(order).toEqual(['fill', 'record', 'dates'])
})

// 창이 덜 채워지는 것은 화면이 덜 채워진다 이지 부르는 쪽의 실패가 아니다.
it('중간이 던져도 밖으로 안 던진다', async () => {
  recordMock.mockRejectedValue(new Error('boom'))

  await expect(syncScheduleWindow(['o1'], NOW)).resolves.toBeUndefined()
})

// ⚠️ 실기기에서 실제로 물린 자리.
//
// 셋을 한 try 로 묶었더니 채우기가 던진 순간 굳히기와 캐기가 통째로 안 돌았다. 원장은 13일이
// 다 찼는데 기록은 이번 주 것뿐이었고, 화면은 그것을 `이 기간을 불러오지 못했습니다` 로 그렸다.
it('채우기가 던져도 굳히기와 캐기는 돈다. 원장에 이미 있는 것으로 만들 수 있다', async () => {
  fillMock.mockRejectedValue(new Error('network'))

  await syncScheduleWindow(['o1'], NOW)

  expect(recordMock).toHaveBeenCalledWith(['o1'], NOW)
  expect(datesMock).toHaveBeenCalledWith(['o1'], NOW)
})

it('굳히기가 던져도 캐기는 돈다', async () => {
  recordMock.mockRejectedValue(new Error('sqlite timeout'))

  await syncScheduleWindow(['o1'], NOW)

  expect(datesMock).toHaveBeenCalledWith(['o1'], NOW)
})



// 두 화면이 같은 순간에 부를 수 있다. 그때 같은 날짜가 두 번 나가면 안 된다.
it('겹친 호출은 같은 회차를 나눠 쓴다', async () => {
  await Promise.all([syncScheduleWindow(['o1'], NOW), syncScheduleWindow(['o1'], NOW)])

  expect(fillMock).toHaveBeenCalledTimes(1)
})
