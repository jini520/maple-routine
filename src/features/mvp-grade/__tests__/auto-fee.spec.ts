jest.mock('../fee-context', () => ({ loadFeeContext: jest.fn() }))

import { loadFeeContext } from '../fee-context'
import { lazyAutoFeePercent, settingSplitFee } from '../auto-fee'

const loadMock = loadFeeContext as jest.Mock

beforeEach(() => {
  loadMock.mockReset().mockResolvedValue({
    histories: new Map([['A', [{ startDate: '2026-08-06', grade: 'silver' }]]]),
    sightings: [{ ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' }],
    fallbackOcid: 'a1',
  })
})

describe('lazyAutoFeePercent', () => {
  it('처음 부를 때 한 번만 읽는다', async () => {
    const autoFee = lazyAutoFeePercent()
    await expect(autoFee('a1', '2026-08-10')).resolves.toBe(3)
    await expect(autoFee('a1', '2026-07-01')).resolves.toBe(5)
    expect(loadMock).toHaveBeenCalledTimes(1)
  })
})

describe('settingSplitFee', () => {
  it('설정이 자동이면 그 기록 날짜의 등급 요율이고 기록도 자동이다', async () => {
    const setting = { splitFeePercent: null, splitFeeAuto: true }
    await expect(settingSplitFee(setting, 'a1', '2026-08-10', lazyAutoFeePercent())).resolves.toEqual({
      splitFeePercent: 3,
      splitFeeAuto: true,
    })
  })

  it('손으로 고른 설정은 그 요율 그대로다', async () => {
    const autoFee = lazyAutoFeePercent()
    await expect(settingSplitFee({ splitFeePercent: 5 }, 'a1', '2026-08-10', autoFee)).resolves.toEqual({
      splitFeePercent: 5,
      splitFeeAuto: false,
    })
    await expect(settingSplitFee(null, 'a1', '2026-08-10', autoFee)).resolves.toEqual({ splitFeePercent: null, splitFeeAuto: false })
    expect(loadMock).not.toHaveBeenCalled()
  })
})
