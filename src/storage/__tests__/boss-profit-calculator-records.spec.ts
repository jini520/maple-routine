import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { installFakePreferences } from './fake-preferences'
import {
  getBossProfitCalculatorRecords,
  moveBossProfitCalculatorRecordsToOcid,
  setBossProfitCalculatorRecords,
  type BossProfitCalculatorRecord,
  type StoredCalculatorRecord,
} from '../boss-profit-calculator-records'

/** 균등 분배. 요율이 비어 등급을 따른다. */
const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null, splitFeeAuto: true }

const 기록: BossProfitCalculatorRecord = {
  id: '6f1c2b0e-8d4a-4c1e-9b7a-2f3d4e5a6b7c',
  savedAt: '2026-10-20T03:00:00.000Z',
  characters: [
    {
      ocid: 'ocid-1',
      bosses: [
        { bossKey: 'kaling', difficulty: 'normal', partySize: 3, shares: EVEN },
        {
          bossKey: 'lotus',
          difficulty: 'hard',
          partySize: 2,
          shares: { myShare: 40_000, sharesTotal: 100_000, splitFeePercent: 3, splitFeeAuto: false },
        },
      ],
    },
  ],
}

/** `기록` 을 저장한 모양. */
const 저장한기록: StoredCalculatorRecord = {
  id: 기록.id,
  savedAt: 기록.savedAt,
  characters: [
    {
      ocid: 'ocid-1',
      bosses: [
        {
          bossDifficultyId: bossDifficultyIdOf('kaling', 'normal')!,
          splitType: 'even',
          partySize: 3,
          splitShareMillipercent: null,
          splitFeePercent: null,
          splitFeeFollowsMvpGrade: true,
        },
        {
          bossDifficultyId: bossDifficultyIdOf('lotus', 'hard')!,
          splitType: 'ratio',
          partySize: 2,
          splitShareMillipercent: 40_000,
          splitFeePercent: 3,
          splitFeeFollowsMvpGrade: false,
        },
      ],
    },
  ],
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

// 저장은 서버 `boss_profit_calculator_record_bosses` 와 같은 칸이고, 분배는 분배 설정과 같은 규칙이다.
it('보스를 난이도 줄 id 와 분배 칸 다섯으로 적고 계산기가 드는 모양으로 되읽는다', async () => {
  await setBossProfitCalculatorRecords([기록])

  expect(JSON.parse((await prefs.get('bossProfitCalculatorRecords'))!)).toEqual([저장한기록])
  expect(await getBossProfitCalculatorRecords()).toEqual([기록])
})

// 비율은 % 의 1000 배로 반올림하고, 계산기 화면은 수수료 자동을 저장하지 않아 요율이 있으면 손으로 고른 값이다.
it('비율 2 : 5 는 40000 으로, 요율이 빈 균등은 등급을 따르는 것으로 적는다', async () => {
  await setBossProfitCalculatorRecords([
    {
      ...기록,
      characters: [
        {
          ocid: 'ocid-1',
          bosses: [
            { bossKey: 'kaling', difficulty: 'normal', partySize: 3, shares: { myShare: null, sharesTotal: null, splitFeePercent: null } },
            { bossKey: 'lotus', difficulty: 'hard', partySize: 2, shares: { myShare: 2, sharesTotal: 5, splitFeePercent: 3 } },
          ],
        },
      ],
    },
  ])

  expect(JSON.parse((await prefs.get('bossProfitCalculatorRecords'))!)).toEqual([저장한기록])
})

// 게임 데이터에서 빠진 보스는 key 로 되돌릴 수 없다.
it('게임 데이터에 없는 난이도 줄 id 의 보스는 건너뛴다', async () => {
  const [character] = 저장한기록.characters
  await prefs.set(
    'bossProfitCalculatorRecords',
    JSON.stringify([{ ...저장한기록, characters: [{ ...character, bosses: [...character!.bosses, { ...character!.bosses[0], bossDifficultyId: '없는-id' }] }] }]),
  )

  expect(await getBossProfitCalculatorRecords()).toEqual([기록])
})

it('깨진 JSON 이면 빈 목록이다', async () => {
  await prefs.set('bossProfitCalculatorRecords', '{not json')

  expect(await getBossProfitCalculatorRecords()).toEqual([])
})

// 한 기록 때문에 목록 전체를 잃으면 사용자가 남긴 기록이 한꺼번에 사라진다.
it('모양이 틀린 기록은 그 기록만 버린다', async () => {
  const boss = 저장한기록.characters[0]!.bosses[0]!
  const 시각없음 = { ...저장한기록, id: 'r2', savedAt: undefined }
  const 인원틀림 = { ...저장한기록, id: 'r3', characters: [{ ocid: 'ocid-1', bosses: [{ ...boss, partySize: 0 }] }] }
  const 제외 = { ...저장한기록, id: 'r4', characters: [{ ocid: 'ocid-1', bosses: [{ ...boss, splitType: 'excluded' }] }] }
  await prefs.set('bossProfitCalculatorRecords', JSON.stringify([저장한기록, 시각없음, 인원틀림, 제외]))

  expect((await getBossProfitCalculatorRecords()).map((one) => one.id)).toEqual([기록.id])
})

// 보스를 다 뺀 캐릭터도 기록의 일부다. 버리면 그 캐릭터가 다음에 보스 관리 값으로 채워진 것처럼 보인다.
it('보스가 없는 캐릭터도 읽는다', async () => {
  const 빈캐릭터 = { ...기록, characters: [{ ocid: 'ocid-2', bosses: [] }] }
  await setBossProfitCalculatorRecords([빈캐릭터])

  expect(await getBossProfitCalculatorRecords()).toEqual([빈캐릭터])
})

describe('월드 리프 옮기기', () => {
  const keepAll = (): boolean => true

  it('기록 속 옛 ocid 를 새 ocid 로 바꾼다', async () => {
    await setBossProfitCalculatorRecords([기록])

    await moveBossProfitCalculatorRecordsToOcid('ocid-1', 'ocid-9', keepAll)

    const [moved] = await getBossProfitCalculatorRecords()
    expect(moved!.characters.map((each) => each.ocid)).toEqual(['ocid-9'])
    expect(moved!.characters[0]!.bosses).toEqual(기록.characters[0]!.bosses)
  })

  // 새 캐릭터가 잡을 수 없는 보스(일반 월드로 리프한 캐릭터의 시즌 보스)는 넘기지 않는다. 어느 보스인지는 부르는 쪽이 고른다.
  it('넘길 보스 줄만 새 캐릭터로 옮긴다', async () => {
    await setBossProfitCalculatorRecords([기록])

    await moveBossProfitCalculatorRecordsToOcid('ocid-1', 'ocid-9', (boss) => boss.bossKey !== 'lotus')

    const [moved] = await getBossProfitCalculatorRecords()
    expect(moved!.characters).toEqual([{ ocid: 'ocid-9', bosses: [기록.characters[0]!.bosses[0]] }])
  })

  // 기록을 열면 추적 중인 캐릭터만 보이는데 목록 금액은 기록의 캐릭터를 모두 더한다. 옛 캐릭터를 남기면 두 금액이 갈린다.
  it('새 캐릭터가 이미 든 기록에서는 옛 캐릭터 항목을 지우고 새 캐릭터 값을 둔다', async () => {
    const fresh = [{ bossKey: 'kaling', difficulty: 'normal' as const, partySize: 1, shares: EVEN }]
    const both: BossProfitCalculatorRecord = {
      ...기록,
      id: '7a2d3c1f-9e5b-4d2f-8c8b-3a4e5f6a7b8c',
      characters: [...기록.characters, { ocid: 'ocid-9', bosses: fresh }],
    }
    await setBossProfitCalculatorRecords([기록, both])

    await moveBossProfitCalculatorRecordsToOcid('ocid-1', 'ocid-9', keepAll)

    const records = await getBossProfitCalculatorRecords()
    expect(records.find((one) => one.id === 기록.id)!.characters.map((each) => each.ocid)).toEqual(['ocid-9'])
    expect(records.find((one) => one.id === both.id)!.characters).toEqual([{ ocid: 'ocid-9', bosses: fresh }])
  })
})
