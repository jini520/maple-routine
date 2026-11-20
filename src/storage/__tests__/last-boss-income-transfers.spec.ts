import { installFakePreferences } from './fake-preferences'
import {
  getLastBossIncomeTransfers,
  moveLastBossIncomeTransfersToOcid,
  setLastBossIncomeTransfer,
} from '../last-boss-income-transfers'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

const 자동 = { receiverOcid: 'ocid-main', feeAuto: true, feePercent: null, fillsWeek: true } as const
const 삼퍼센트 = { receiverOcid: 'ocid-main', feeAuto: false, feePercent: 3, fillsWeek: false } as const

it('보내는 캐릭터마다 적고, 같은 캐릭터를 다시 적으면 그 몫만 바뀐다', async () => {
  await setLastBossIncomeTransfer('ocid-1', 자동)
  await setLastBossIncomeTransfer('ocid-2', 삼퍼센트)
  await setLastBossIncomeTransfer('ocid-1', { ...자동, receiverOcid: 'ocid-other' })

  expect(await getLastBossIncomeTransfers()).toEqual({
    'ocid-1': { ...자동, receiverOcid: 'ocid-other' },
    'ocid-2': 삼퍼센트,
  })
})

// 모양이 틀린 몫을 고르개에 세우면 목록에 없는 값이 줄에 남는다. 한 몫이 상했다고 다른 캐릭터의 기억까지 버리지 않는다.
it('상한 값은 빈 표이고, 모양이 틀린 몫만 뺀다', async () => {
  await prefs.set('lastBossIncomeTransfers', '{')
  expect(await getLastBossIncomeTransfers()).toEqual({})

  await prefs.set('lastBossIncomeTransfers', '[]')
  expect(await getLastBossIncomeTransfers()).toEqual({})

  await prefs.set(
    'lastBossIncomeTransfers',
    JSON.stringify({
      'ocid-1': 자동,
      'ocid-2': { ...삼퍼센트, receiverOcid: '' },
      'ocid-3': { ...삼퍼센트, feePercent: 4 },
      'ocid-4': { ...삼퍼센트, fillsWeek: 'yes' },
      'ocid-5': null,
    }),
  )
  expect(await getLastBossIncomeTransfers()).toEqual({ 'ocid-1': 자동 })
})

describe('월드 리프하면 옛 ocid 를 새 ocid 로 옮긴다', () => {
  it('보내는 캐릭터 몫을 새 ocid 로 옮기고 옛 몫은 지운다', async () => {
    await setLastBossIncomeTransfer('old-1', 자동)

    await moveLastBossIncomeTransfersToOcid('old-1', 'new-1')

    expect(await getLastBossIncomeTransfers()).toEqual({ 'new-1': 자동 })
  })

  // 리프 뒤에 새 캐릭터로 적은 값이다. 옛 값으로 덮지 않는다.
  it('새 ocid 의 몫이 있으면 새 것을 두고 옛 몫은 지운다', async () => {
    await setLastBossIncomeTransfer('old-1', 자동)
    await setLastBossIncomeTransfer('new-1', 삼퍼센트)

    await moveLastBossIncomeTransfersToOcid('old-1', 'new-1')

    expect(await getLastBossIncomeTransfers()).toEqual({ 'new-1': 삼퍼센트 })
  })

  // 그대로 두면 받는 캐릭터가 목록에 없는 ocid 라 빈 칸으로 열린다.
  it('다른 캐릭터 몫의 받는 캐릭터가 옛 ocid 면 새 ocid 로 바꾼다', async () => {
    await setLastBossIncomeTransfer('ocid-2', { ...삼퍼센트, receiverOcid: 'old-1' })

    await moveLastBossIncomeTransfersToOcid('old-1', 'new-1')

    expect(await getLastBossIncomeTransfers()).toEqual({ 'ocid-2': { ...삼퍼센트, receiverOcid: 'new-1' } })
  })

  it('옮길 것이 없으면 쓰지 않는다', async () => {
    await moveLastBossIncomeTransfersToOcid('old-1', 'new-1')

    expect(await prefs.get('lastBossIncomeTransfers')).toBeNull()
  })
})
