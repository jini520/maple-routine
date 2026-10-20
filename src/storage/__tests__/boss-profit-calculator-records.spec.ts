import { installFakePreferences } from './fake-preferences'
import {
  getBossProfitCalculatorRecords,
  setBossProfitCalculatorRecords,
  type BossProfitCalculatorRecord,
} from '../boss-profit-calculator-records'

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }

const 기록: BossProfitCalculatorRecord = {
  id: '6f1c2b0e-8d4a-4c1e-9b7a-2f3d4e5a6b7c',
  savedAt: '2026-10-20T03:00:00.000Z',
  characters: [
    {
      ocid: 'ocid-1',
      bosses: [
        { bossKey: 'kaling', difficulty: 'normal', partySize: 3, shares: EVEN },
        { bossKey: 'lotus', difficulty: 'hard', partySize: 2, shares: { myShare: 2, sharesTotal: 5, splitFeePercent: 3 } },
      ],
    },
  ],
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('적은 기록을 그대로 읽는다', async () => {
  await setBossProfitCalculatorRecords([기록])

  expect(await getBossProfitCalculatorRecords()).toEqual([기록])
})

it('깨진 JSON 이면 빈 목록이다', async () => {
  await prefs.set('bossProfitCalculatorRecords', '{not json')

  expect(await getBossProfitCalculatorRecords()).toEqual([])
})

// 한 기록 때문에 목록 전체를 잃으면 사용자가 남긴 기록이 한꺼번에 사라진다.
it('모양이 틀린 기록은 그 기록만 버린다', async () => {
  const 시각없음 = { ...기록, id: 'r2', savedAt: undefined }
  const 인원틀림 = {
    ...기록,
    id: 'r3',
    characters: [{ ocid: 'ocid-1', bosses: [{ bossKey: 'kaling', difficulty: 'normal', partySize: 0, shares: EVEN }] }],
  }
  const 몫없음 = {
    ...기록,
    id: 'r4',
    characters: [{ ocid: 'ocid-1', bosses: [{ bossKey: 'kaling', difficulty: 'normal', partySize: 1 }] }],
  }
  await prefs.set('bossProfitCalculatorRecords', JSON.stringify([기록, 시각없음, 인원틀림, 몫없음]))

  expect((await getBossProfitCalculatorRecords()).map((one) => one.id)).toEqual([기록.id])
})

// 보스를 다 뺀 캐릭터도 기록의 일부다. 버리면 그 캐릭터가 다음에 보스 관리 값으로 채워진 것처럼 보인다.
it('보스가 없는 캐릭터도 읽는다', async () => {
  const 빈캐릭터 = { ...기록, characters: [{ ocid: 'ocid-2', bosses: [] }] }
  await setBossProfitCalculatorRecords([빈캐릭터])

  expect(await getBossProfitCalculatorRecords()).toEqual([빈캐릭터])
})
