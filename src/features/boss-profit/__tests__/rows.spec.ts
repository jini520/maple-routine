// 행 도메인 순수 함수 직접 검증. store.ts 에서 분리하며 비로소 가능해진 것이다(5단계).
//
// 그 전에는 export 된 것이 dropRowKey 하나뿐이라, 89개 스토어 테스트가 전부 스토어를 거쳐
// 간접 검증했다. 정렬처럼 "입력을 어떻게 주느냐"가 핵심인 로직은 그 방식으로는 경우를
// 만들기가 번거로워, 실제로 결정적 정렬에 직접 붙은 테스트가 없었다.
import weeklyBossesData from '../../../data/weekly-bosses.json'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/boss-matching'
import type { ManualTrackedItem } from '../../../storage/manual-tracked-content'
import type { BossContent } from '../../../types'
import {
  buildBossProfitRow,
  buildRowFromRecord,
  filterRowsForTab,
  matchesRowKey,
  dropShareSeedOf,
  mergeRecordsIntoRows,
  selectProfitDisplayBosses,
  sortRowsByOcidOrder,
  sumRowsPayout,
  toRecordedDrop,
  type ProfitBoss,
} from '../rows'
import type { BossProfitRow } from '../store'

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: null,
    worldKey: null,
    bossKey: 'zakum',
    bossName: '자쿰',
    difficulty: 'chaos',
    cycle: 'weekly',
    periodKey: '2026-07-09',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 2,
    payoutMeso: 5_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true,
    defeatedOn: null,
    source: 'auto',
    ...overrides,
  }
}

describe('sortRowsByOcidOrder', () => {
  it('sortedOcids 순서를 1차 키로 쓴다', () => {
    const rows = [row({ ocid: 'b' }), row({ ocid: 'a' })]

    const sorted = sortRowsByOcidOrder(rows, ['a', 'b'])

    expect(sorted.map((r) => r.ocid)).toEqual(['a', 'b'])
  })

  // ocid 로만 정렬하고 stable sort 에 기대면 보스 순서가 데이터 소스 순서를 물려받는다.
  // 그 소스 순서는 비결정적이라(ORDER BY 없는 조회· Map 삽입 순서) 로드마다 달라진다.
  it('같은 캐릭터 안에서는 참조 데이터 순서로 보스를 결정적으로 정렬한다', () => {
    const rows = [row({ bossKey: 'lotus', bossName: '스우' }), row({ bossKey: 'zakum', bossName: '자쿰' }), row({ bossKey: 'lucid', bossName: '루시드' })]

    const once = sortRowsByOcidOrder(rows, ['ocid-1']).map((r) => r.bossName)
    const twice = sortRowsByOcidOrder([...rows].reverse(), ['ocid-1']).map((r) => r.bossName)

    // 입력 순서가 달라도 결과가 같아야 "결정적"이다.
    expect(twice).toEqual(once)
  })

  it('sortedOcids 밖의 캐릭터는 뒤로 보내되 서로 섞이지 않는다', () => {
    const rows = [row({ ocid: 'z' }), row({ ocid: 'a' }), row({ ocid: 'y' })]

    const sorted = sortRowsByOcidOrder(rows, ['a'])

    expect(sorted[0].ocid).toBe('a')
    expect(sorted.slice(1).map((r) => r.ocid)).toEqual(['y', 'z'])
  })

  it('원본 배열을 변형하지 않는다', () => {
    const rows = [row({ ocid: 'b' }), row({ ocid: 'a' })]

    sortRowsByOcidOrder(rows, ['a', 'b'])

    expect(rows.map((r) => r.ocid)).toEqual(['b', 'a'])
  })
})

describe('filterRowsForTab', () => {
  // 실제 데이터 회귀. 8월 월간 기록 6건이 날짜가 없었고 주간 기록은 08-20·08-27 에만 있었다.
  // 마지막 주차 규칙은 그것을 08-27 에 세웠는데, 원장은 네 캐릭터가 8/23 에 이미 완료였다고
  // 말한다. 8/23 은 08-20 주 안이라 08-27 에 잡았을 수가 없다.
  it('날짜 모르는 월간 행은 기록이 있는 가장 빠른 주차에 선다', () => {
    const 월간 = row({ cycle: 'monthly', periodKey: '2026-08', defeatedOn: null })
    const 있는주차 = ['2026-08-20', '2026-08-27']
    const 지금 = new Date('2026-09-05T12:00:00+09:00')

    const 스무날주 = filterRowsForTab([월간], 'weekly', '2026-08-20', 지금, 있는주차)
    const 스무이레주 = filterRowsForTab([월간], 'weekly', '2026-08-27', 지금, 있는주차)

    expect(스무날주).toHaveLength(1)
    expect(스무이레주).toHaveLength(0)
  })

  it('탭(cycle)과 기간이 모두 맞는 행만 남긴다', () => {
    const rows = [
      row({ cycle: 'weekly', periodKey: '2026-07-09' }),
      row({ cycle: 'monthly', periodKey: '2026-07-09' }),
      row({ cycle: 'weekly', periodKey: '2026-07-02' }),
    ]

    const kept = filterRowsForTab(rows, 'weekly', '2026-07-09', new Date('2026-07-11T12:00:00+09:00'), [])

    expect(kept).toHaveLength(1)
    expect(kept[0].cycle).toBe('weekly')
    expect(kept[0].periodKey).toBe('2026-07-09')
  })
})

// 아직 기록 안 된 이번 기간 행. 가격은 그 행의 기간의 표에서 찾는다(2026-09-17 패치).
describe('buildBossProfitRow', () => {
  const 자쿰: ProfitBoss = {
    bossKey: 'zakum',
    apiName: '자쿰',
    difficulty: 'chaos',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: true,
    ownComplete: true,
    portraitSlug: null,
    isSeasonBoss: false,
  }
  const 캐릭터 = { characterName: '낟낟', imageUrl: null, world: null, worldKey: null }

  it('09-10 주는 옛 가격, 09-17 주는 새 가격이다', () => {
    expect(buildBossProfitRow('o1', 캐릭터, 자쿰, new Date('2026-09-12T12:00:00+09:00')).priceMeso).toBe(8_080_000)
    expect(buildBossProfitRow('o1', 캐릭터, 자쿰, new Date('2026-09-18T12:00:00+09:00')).priceMeso).toBe(4_040_000)
  })

  it('행의 월드 key 는 캐릭터 프로필의 것이다', () => {
    const row = buildBossProfitRow('o1', { ...캐릭터, world: '엘리시움', worldKey: 'elysium' }, 자쿰, new Date('2026-09-12T12:00:00+09:00'))

    expect([row.world, row.worldKey]).toEqual(['엘리시움', 'elysium'])
  })
})

// 기록의 월드 스냅샷이 이긴다. 이름과 key 는 같은 출처에서 짝으로 온다. 섞으면 이름과 엠블럼 · 한도가 다른 월드를 가리킨다.
describe('buildRowFromRecord 의 월드', () => {
  const 기록 = {
    ocid: 'o1',
    bossKey: 'zakum',
    boss: '자쿰',
    difficulty: 'chaos',
    cycle: 'weekly' as const,
    periodKey: '2026-09-10',
    partySize: 1,
    priceMeso: 1000,
    payoutMeso: 1000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-09-11T00:00:00.000Z',
  }
  const 지금캐릭터 = { characterName: '낟낟', imageUrl: null, world: '엘리시움', worldKey: 'elysium' }
  const now = new Date('2026-09-12T12:00:00+09:00')

  it('기록에 월드가 있으면 기록의 이름과 key 다. 리프 뒤의 지금 월드로 옮기지 않는다', () => {
    const row = buildRowFromRecord({ ...기록, world: '챌린저스2', worldKey: 'challengers_2' }, 지금캐릭터, now)

    expect([row.world, row.worldKey]).toEqual(['챌린저스2', 'challengers_2'])
  })

  it('월드 칸이 없던 기록은 캐릭터의 이름과 key 로 채운다', () => {
    const row = buildRowFromRecord({ ...기록, world: null, worldKey: null }, 지금캐릭터, now)

    expect([row.world, row.worldKey]).toEqual(['엘리시움', 'elysium'])
  })
})

describe('sumRowsPayout', () => {
  it('payoutMeso를 더한다', () => {
    expect(sumRowsPayout([row({ payoutMeso: 100 }), row({ payoutMeso: 250 })])).toBe(350)
  })

  it('빈 배열은 0이다. "기록 없음"과 "0메소"를 호출부가 구분할 수 있게 던지지 않는다', () => {
    expect(sumRowsPayout([])).toBe(0)
  })
})

describe('matchesRowKey', () => {
  const key = {
    ocid: 'ocid-1',
    bossKey: 'zakum',
    difficulty: 'chaos' as const,
    cycle: 'weekly' as const,
    periodKey: '2026-07-09',
  }

  it('다섯 필드가 모두 같아야 같은 행이다', () => {
    expect(matchesRowKey(row(), key)).toBe(true)
  })

  it('난이도만 달라도 다른 행이다. 등록 난이도 ≠ 처치 난이도 오류의 근원', () => {
    expect(matchesRowKey(row({ difficulty: 'hard' }), key)).toBe(false)
  })
})

// ⚠️ 가격이 조용히 사라지는 자리 그 ②
//
// `lib/boss/boss-drops` 쪽 동명 함수보다 **이쪽이 더 자주 터진다**. 저장소 행 → 도메인 변환이라
// 난이도 확정 같은 특수 상황이 아니라 **DB에서 읽을 때마다** 지나간다. 여기서 필드를 빠뜨리면
// 저장은 됐는데 화면은 영영 "미입력"으로 보인다.
describe('toRecordedDrop: 가격 필드', () => {
  const base = {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: '2026-08-06',
    dropIndex: 0,
    category: 'equipment' as const,
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-10T00:00:00.000Z',
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: false,
    splitFeeAuto: false,
  }

  it('저장소의 가격 세 컬럼을 도메인 드롭으로 옮긴다', () => {
    expect(
      toRecordedDrop({ ...base, priceState: 'entered', priceMeso: 15_000_000_000, priceShare: 3 }),
    ).toEqual(
      expect.objectContaining({
        priceState: 'entered',
        priceMeso: 15_000_000_000,
        priceShare: 3,
      }),
    )
  })

  it('NULL 은 undefined 로 정규화한다. 미입력은 상태가 없는 것이다', () => {
    const drop = toRecordedDrop({ ...base, priceState: null, priceMeso: null, priceShare: null })

    expect(drop.priceState).toBeUndefined()
    expect(drop.priceMeso).toBeUndefined()
    expect(drop.priceShare).toBeUndefined()
  })

  it('기록 안함은 금액 없이 상태만 옮긴다', () => {
    const drop = toRecordedDrop({ ...base, priceState: 'excluded', priceMeso: null, priceShare: null })

    expect(drop.priceState).toBe('excluded')
    expect(drop.priceMeso).toBeUndefined()
  })

  // 가격 셋과 같은 사정이다. 여기서 빠지면 다시 쓰는 모든 경로가 기록의 key 를 지운다.
  it('아이템 key 와 상자 key 를 옮긴다', () => {
    const drop = toRecordedDrop({
      ...base,
      category: 'consumable',
      itemKey: 'restraint_ring',
      itemName: '리스트레인트 링',
      slot: null,
      boxOriginKey: 'red_boss_ring_box',
      boxOrigin: '홍옥의 보스 반지 상자',
      priceState: null,
      priceMeso: null,
      priceShare: null,
    })

    expect(drop).toMatchObject({ itemKey: 'restraint_ring', boxOriginKey: 'red_boss_ring_box' })
  })

  it('key 가 없는 옛 기록은 아이템 key 를 null 로 둔다', () => {
    const drop = toRecordedDrop({ ...base, itemKey: null, priceState: null, priceMeso: null, priceShare: null })

    expect(drop.itemKey).toBeNull()
    expect(drop.boxOriginKey).toBeUndefined()
  })
})

// 주간 한도를 채우면 미처치 placeholder 행은 아예 서지 않는다. `마감` 배지를
// 여기까지 들고 오지 않는다: 이 페이지는 정산이라 **벌지 않은 것** 은 줄을 갖지 않는다.
/**
 * 시즌 보스는 챌린저스 월드 캐릭터에만 선다(2026-09-17 사용자 지정).
 *
 * 넥슨 API 는 일반 월드 캐릭터에도 메이린을 보스 목록에 넣어 준다(실기기 캐시 실측). 앞으로 나올 시즌 보스도
 * 같아야 해서 보스 이름이 아니라 `eventWeekly` 분류로 거른다.
 */
describe('selectProfitDisplayBosses: 시즌 보스는 챌린저스 월드에만', () => {
  const SEASON = (weeklyBossesData.eventWeekly as { key: string; name: string }[])[0]
  const WEEKLY = (weeklyBossesData.weekly as { key: string; name: string }[])[0]

  function content(entry: { key: string; name: string }, overrides: Partial<BossContent>): BossContent {
    return {
      bossKey: entry.key,
      apiName: entry.name,
      difficulty: 'hard',
      cycle: 'weekly',
      isRegistered: false,
      isComplete: false,
      ownComplete: false,
      ...overrides,
    }
  }

  const registered = content(SEASON, { isRegistered: true })
  const killed = content(SEASON, { isRegistered: true, isComplete: true, ownComplete: true })
  const keys = (bosses: ReturnType<typeof selectProfitDisplayBosses>): string[] =>
    bosses.map((boss) => boss.bossKey)

  it.each([
    ['엘리시움', 'elysium'],
    ['월드 모름', null],
  ])('%s 캐릭터는 등록 · 처치로 와도 시즌 보스 행이 없다', (_label, worldKey) => {
    expect(keys(selectProfitDisplayBosses([registered], 'auto', [], worldKey))).not.toContain(SEASON.key)
    expect(keys(selectProfitDisplayBosses([killed], 'auto', [], worldKey))).not.toContain(SEASON.key)

    const manual: ManualTrackedItem[] = [{ kind: 'boss', bossKey: SEASON.key, difficulty: 'hard' }]
    expect(keys(selectProfitDisplayBosses([registered], 'manual', manual, worldKey))).not.toContain(SEASON.key)
    expect(keys(selectProfitDisplayBosses([killed], 'manual', [], worldKey))).not.toContain(SEASON.key)
  })

  it('챌린저스 월드 캐릭터는 시즌 보스 행이 그대로 선다', () => {
    expect(keys(selectProfitDisplayBosses([registered], 'auto', [], 'challengers_2'))).toContain(SEASON.key)
    expect(keys(selectProfitDisplayBosses([killed], 'manual', [], 'challengers_2'))).toContain(SEASON.key)
  })

  it('일반 월드에서도 시즌 보스가 아닌 보스는 그대로 선다', () => {
    const weekly = content(WEEKLY, { isRegistered: true, isComplete: true, ownComplete: true })

    expect(keys(selectProfitDisplayBosses([weekly, killed], 'auto', [], 'elysium'))).toEqual([WEEKLY.key])
  })
})

describe('selectProfitDisplayBosses: 주간 한도 마감', () => {
  const WEEKLY = weeklyBossesData.weekly as { key: string; name: string }[]
  const PENDING = WEEKLY[0].key

  function content(overrides: Partial<BossContent> & { bossKey: string | null }): BossContent {
    return {
      apiName: WEEKLY.find((entry) => entry.key === overrides.bossKey)?.name ?? '표에 없는 보스',
      difficulty: 'hard',
      cycle: 'weekly',
      isRegistered: false,
      isComplete: false,
      ownComplete: false,
      ...overrides,
    }
  }

  /** 끝에서부터 한도만큼 실제로 처치한 보스들. `PENDING` 과 겹치지 않게 뒤에서 뽑는다. */
  function cleared(count: number): BossContent[] {
    return WEEKLY.slice(-count).map((entry) =>
      content({ bossKey: entry.key, isRegistered: true, isComplete: true, ownComplete: true }),
    )
  }

  const keys = (bosses: ReturnType<typeof selectProfitDisplayBosses>): string[] =>
    bosses.map((boss) => boss.bossKey)

  it('자동 모드: 한도를 채우면 인게임 등록만 된 미처치 보스는 행이 서지 않는다', () => {
    const contents = [content({ bossKey: PENDING, isRegistered: true }), ...cleared(WEEKLY_BOSS_CLEAR_LIMIT)]

    expect(keys(selectProfitDisplayBosses(contents, 'auto', [], null))).not.toContain(PENDING)
  })

  // 회귀 가드. 한도 전이면 미완료 placeholder 는 그대로 선다.
  it('자동 모드: 한 마리 모자라면 미완료 placeholder 는 그대로 선다', () => {
    const contents = [
      content({ bossKey: PENDING, isRegistered: true }),
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1),
    ]

    expect(keys(selectProfitDisplayBosses(contents, 'auto', [], null))).toContain(PENDING)
  })

  it('수동 모드: 한도를 채우면 추적 중인 미처치 보스도 행이 서지 않는다', () => {
    const contents = cleared(WEEKLY_BOSS_CLEAR_LIMIT)
    const manual: ManualTrackedItem[] = [{ kind: 'boss', bossKey: PENDING, difficulty: 'hard' }]

    expect(keys(selectProfitDisplayBosses(contents, 'manual', manual, null))).not.toContain(PENDING)
  })

  // 마감은 **안 잡은 것** 에만 붙는다. 실제로 번 것은 정산에서 사라지면 안 된다.
  it('실제로 처치한 보스는 한도를 채워도 전부 남는다', () => {
    const contents = cleared(WEEKLY_BOSS_CLEAR_LIMIT)

    expect(keys(selectProfitDisplayBosses(contents, 'auto', [], null))).toHaveLength(WEEKLY_BOSS_CLEAR_LIMIT)
  })

  it('시즌 보스는 한도 밖이라 미처치여도 남는다', () => {
    const contents = [
      content({ bossKey: 'meirin', apiName: '시즌 보스 메이린', difficulty: 'normal', isRegistered: true }),
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT),
    ]

    // 시즌 보스는 챌린저스 월드 캐릭터에만 선다.
    expect(keys(selectProfitDisplayBosses(contents, 'auto', [], 'challengers'))).toContain('meirin')
  })

  it('월간 보스는 한도 밖이라 미처치여도 남는다', () => {
    const contents = [
      content({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly', isRegistered: true }),
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT),
    ]

    expect(keys(selectProfitDisplayBosses(contents, 'auto', [], null))).toContain('black_mage')
  })
})

// API 이름이 보스 표에 없는 보스는 결정석 가격도 기록할 key 도 없다. 처치했어도 수익 행이 되지 않는다.
describe('selectProfitDisplayBosses: 보스 표에 없는 보스', () => {
  const 모르는보스: BossContent = {
    bossKey: null,
    apiName: '새 보스',
    difficulty: 'hard',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: true,
    ownComplete: true,
  }

  it('자동 모드에서 처치했어도 행이 되지 않는다', () => {
    expect(selectProfitDisplayBosses([모르는보스], 'auto', [], null)).toEqual([])
  })

  it('수동 모드에서도 처치 행이 되지 않는다', () => {
    expect(selectProfitDisplayBosses([모르는보스], 'manual', [], null)).toEqual([])
  })
})

// 동기화가 만든 행은 날짜를 모른다(`buildBossProfitRow` 가 `null` 을 박는다). 기록이 아는 날짜를
// 여기서 안 실으면, 이번 주에 잡은 월간 보스가 **이번 주 목록에서 사라지고** 그 달 첫 주차로
// 옮겨간다. `isMonthlyRowInWeek` 이 날짜 모름을 첫 주차로 읽기 때문이다.
it('mergeRecordsIntoRows 는 기록의 처치 날짜도 행에 싣는다', () => {
  const target = row({ cycle: 'monthly', periodKey: '2026-09', defeatedOn: null })
  const record = {
    ocid: target.ocid,
    bossKey: target.bossKey,
    boss: target.bossName,
    difficulty: target.difficulty,
    cycle: 'monthly' as const,
    periodKey: '2026-09',
    partySize: 2,
    priceMeso: 100,
    payoutMeso: 50,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-09-20T00:00:00.000Z',
    world: null,
    worldKey: null,
    defeatedOn: '2026-09-19',
  }

  expect(mergeRecordsIntoRows([target], [record])[0].defeatedOn).toBe('2026-09-19')
})

// 이번 기간의 행은 동기화가 만들고 비율을 모른다. 안 실으면 보스 수익 행에서 비율로 저장한 기록이
// 화면을 떠났다 오는 순간 균등으로 보이고(`파티 2인`), 파티 모달도 균등으로 열린다.
it('mergeRecordsIntoRows 는 기록의 비율과 송금 수수료도 행에 싣는다', () => {
  const target = row({ crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null })
  const record = {
    ocid: target.ocid,
    bossKey: target.bossKey,
    boss: target.bossName,
    difficulty: target.difficulty,
    cycle: 'weekly' as const,
    periodKey: target.periodKey,
    partySize: 2,
    priceMeso: 300,
    payoutMeso: 200,
    crystalMyShare: 2,
    crystalSharesTotal: 3,
    splitFeePercent: 5,
    splitFeeAuto: true,
    recordedAt: '2026-07-10T00:00:00.000Z',
    world: null,
    worldKey: null,
    defeatedOn: null,
  }

  expect(mergeRecordsIntoRows([target], [record])[0]).toMatchObject({
    crystalMyShare: 2,
    crystalSharesTotal: 3,
    splitFeePercent: 5,
    splitFeeAuto: true,
  })
})

// 드롭 가격 카드의 씨앗. 비율은 결정석에만 있어 여기서는 그 행의 파티 인원으로 균등하다.
describe('dropShareSeedOf', () => {
  it('그 행의 파티 인원으로 균등하다', () => {
    expect(dropShareSeedOf(row({ partySize: 4 }))).toEqual({
      myShare: 1,
      sharesTotal: 4,
    })
  })

  it('인원이 없으면 혼자다', () => {
    expect(dropShareSeedOf(row({ partySize: null }))).toEqual({
      myShare: 1,
      sharesTotal: 1,
    })
  })
})

// 직접 적은 완료는 넥슨 응답에 없다. 기록에서 뽑은 열쇠를 행 고르기와 병합 둘이 함께 봐야
// 스케줄러가 `12/12` 라고 말하면서 이 화면이 `11/12` 라고 말하는 일이 안 생긴다.
describe('직접 적은 완료', () => {
  const BLACK_MAGE = { key: 'black_mage', name: '검은 마법사' }

  function monthly(overrides: Partial<BossContent> = {}): BossContent {
    return {
      bossKey: BLACK_MAGE.key,
      apiName: BLACK_MAGE.name,
      difficulty: 'hard',
      cycle: 'monthly',
      isRegistered: true,
      isComplete: false,
      ownComplete: false,
      ...overrides,
    }
  }

  it('넥슨이 미완료로 줘도 완료 행이 된다', () => {
    const [행] = selectProfitDisplayBosses(
      [monthly()],
      'auto',
      [],
      'scania',
      new Set(['black_mage|hard']),
    )

    expect(행.ownComplete).toBe(true)
    expect(행.isComplete).toBe(true)
  })

  it('주간 한도에도 든다', () => {
    const weekly = (bossKey: string): BossContent => ({
      bossKey,
      apiName: bossKey,
      difficulty: 'hard',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })
    const 열하나 = (weeklyBossesData.weekly as { key: string }[])
      .slice(0, WEEKLY_BOSS_CLEAR_LIMIT - 1)
      .map((entry) => weekly(entry.key))
    // 열한 마리 목록에 없는 보스라야 열두째가 된다.
    const 마지막 = { ...weekly('will'), isComplete: false, ownComplete: false }

    // 열한 마리는 넥슨이 주고 하나는 사용자가 적었다. 그러면 열둘이라 미처치 행이 안 선다.
    const rows = selectProfitDisplayBosses(
      [...열하나, 마지막, { ...weekly('limbo'), isComplete: false, ownComplete: false }],
      'auto',
      [],
      'scania',
      new Set(['will|hard']),
    )

    expect(rows.map((boss) => boss.bossKey)).not.toContain('limbo')
  })

  it('기록이 있으면 병합이 그 행을 완료로 만든다', () => {
    const 미완료행 = row({ bossKey: 'black_mage', difficulty: 'hard', isComplete: false, payoutMeso: 0 })
    const [병합] = mergeRecordsIntoRows(
      [미완료행],
      [
        {
          ocid: 미완료행.ocid,
          bossKey: 'black_mage',
          boss: '검은 마법사',
          difficulty: 'hard',
          cycle: 'monthly',
          periodKey: 미완료행.periodKey,
          partySize: 1,
          priceMeso: 665_000_000,
          payoutMeso: 665_000_000,
          crystalMyShare: null,
          crystalSharesTotal: null,
          splitFeePercent: null,
          recordedAt: '2026-09-18T00:00:00.000Z',
          world: null,
          worldKey: null,
          source: 'manual',
        },
      ],
    )

    expect(병합.isComplete).toBe(true)
    expect(병합.payoutMeso).toBe(665_000_000)
  })
})
