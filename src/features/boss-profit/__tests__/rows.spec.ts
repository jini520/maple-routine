// 행 도메인 순수 함수 직접 검증 — store.ts 에서 분리하며 비로소 가능해진 것이다(ADR-094 5단계).
//
// 그 전에는 export 된 것이 dropRowKey 하나뿐이라, 89개 스토어 테스트가 전부 스토어를 거쳐
// 간접 검증했다. 정렬처럼 "입력을 어떻게 주느냐"가 핵심인 로직은 그 방식으로는 경우를
// 만들기가 번거로워, 실제로 결정적 정렬(ADR-036·#28)에 직접 붙은 테스트가 없었다.
import weeklyBossesData from '../../../data/weekly-bosses.json'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/boss-matching'
import type { ManualTrackedItem } from '../../../storage/manual-tracked-content'
import type { BossContent } from '../../../types'
import {
  filterRowsForTab,
  matchesRowKey,
  selectProfitDisplayBosses,
  sortRowsByOcidOrder,
  sumRowsPayout,
  toRecordedDrop,
} from '../rows'
import type { BossProfitRow } from '../store'

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: null,
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: '2026-07-09',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 2,
    payoutMeso: 5_000_000,
    isComplete: true,
    ...overrides,
  }
}

describe('sortRowsByOcidOrder', () => {
  it('sortedOcids 순서를 1차 키로 쓴다', () => {
    const rows = [row({ ocid: 'b' }), row({ ocid: 'a' })]

    const sorted = sortRowsByOcidOrder(rows, ['a', 'b'])

    expect(sorted.map((r) => r.ocid)).toEqual(['a', 'b'])
  })

  // ADR-036·#28: 예전에는 ocid 로만 정렬하고 stable sort 에 기대 보스 순서를 데이터 소스가
  // 만든 순서 그대로 물려받았는데, 그 소스 순서가 비결정적이라(ORDER BY 없는 조회, Map 삽입
  // 순서) 로드마다 보스 순서가 달라졌다.
  it('같은 캐릭터 안에서는 참조 데이터 순서로 보스를 결정적으로 정렬한다', () => {
    const rows = [row({ boss: '스우' }), row({ boss: '자쿰' }), row({ boss: '루시드' })]

    const once = sortRowsByOcidOrder(rows, ['ocid-1']).map((r) => r.boss)
    const twice = sortRowsByOcidOrder([...rows].reverse(), ['ocid-1']).map((r) => r.boss)

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
  it('탭(cycle)과 기간이 모두 맞는 행만 남긴다', () => {
    const rows = [
      row({ cycle: 'weekly', periodKey: '2026-07-09' }),
      row({ cycle: 'monthly', periodKey: '2026-07-09' }),
      row({ cycle: 'weekly', periodKey: '2026-07-02' }),
    ]

    const kept = filterRowsForTab(rows, 'weekly', '2026-07-09')

    expect(kept).toHaveLength(1)
    expect(kept[0].cycle).toBe('weekly')
    expect(kept[0].periodKey).toBe('2026-07-09')
  })
})

describe('sumRowsPayout', () => {
  it('payoutMeso를 더한다', () => {
    expect(sumRowsPayout([row({ payoutMeso: 100 }), row({ payoutMeso: 250 })])).toBe(350)
  })

  it('빈 배열은 0이다 — "기록 없음"과 "0메소"를 호출부가 구분할 수 있게 던지지 않는다', () => {
    expect(sumRowsPayout([])).toBe(0)
  })
})

describe('matchesRowKey', () => {
  const key = {
    ocid: 'ocid-1',
    boss: '자쿰',
    difficulty: '카오스' as const,
    cycle: 'weekly' as const,
    periodKey: '2026-07-09',
  }

  it('다섯 필드가 모두 같아야 같은 행이다', () => {
    expect(matchesRowKey(row(), key)).toBe(true)
  })

  it('난이도만 달라도 다른 행이다 — 등록 난이도 ≠ 처치 난이도 오류의 근원(ADR-033)', () => {
    expect(matchesRowKey(row({ difficulty: '하드' }), key)).toBe(false)
  })
})

// ⚠️ 가격이 조용히 사라지는 자리 그 ② ([[ADR-124]] 결정 4)
//
// `lib/boss/boss-drops` 쪽 동명 함수보다 **이쪽이 더 자주 터진다** — 저장소 행 → 도메인 변환이라
// 난이도 확정 같은 특수 상황이 아니라 **DB에서 읽을 때마다** 지나간다. 여기서 필드를 빠뜨리면
// 저장은 됐는데 화면은 영영 "미입력"으로 보인다.
describe('toRecordedDrop — 가격 필드 (ADR-124)', () => {
  const base = {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드',
    periodKey: '2026-08-06',
    dropIndex: 0,
    category: 'equipment' as const,
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-10T00:00:00.000Z',
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

  it('NULL 은 undefined 로 정규화한다 — 미입력은 상태가 없는 것이다', () => {
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
})

// [[ADR-187]] 결정 4 — 주간 한도를 채우면 미처치 placeholder 행은 아예 서지 않는다. 「마감」 배지를
// 여기까지 들고 오지 않는다: 이 페이지는 정산이라 «벌지 않은 것» 은 줄을 갖지 않는다.
describe('selectProfitDisplayBosses — 주간 한도 마감 ([[ADR-187]] 결정 4)', () => {
  const WEEKLY_NAMES = (weeklyBossesData.weekly as { boss: string }[]).map((entry) => entry.boss)
  const PENDING = WEEKLY_NAMES[0]

  function content(overrides: Partial<BossContent> & { name: string }): BossContent {
    return {
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: false,
      isComplete: false,
      ownComplete: false,
      ...overrides,
    }
  }

  /** 「끝에서부터」 한도만큼 실제로 처치한 보스들 — `PENDING` 과 겹치지 않게 뒤에서 뽑는다. */
  function cleared(count: number): BossContent[] {
    return WEEKLY_NAMES.slice(-count).map((name) =>
      content({ name, isRegistered: true, isComplete: true, ownComplete: true }),
    )
  }

  const names = (bosses: ReturnType<typeof selectProfitDisplayBosses>): string[] =>
    bosses.map((boss) => boss.matchedBossName ?? boss.apiName)

  it('자동 모드: 한도를 채우면 인게임 등록만 된 미처치 보스는 행이 서지 않는다', () => {
    const contents = [content({ name: PENDING, isRegistered: true }), ...cleared(WEEKLY_BOSS_CLEAR_LIMIT)]

    expect(names(selectProfitDisplayBosses(contents, 'auto', []))).not.toContain(PENDING)
  })

  // 회귀 가드 — 한도 전이면 미완료 placeholder 는 그대로 선다([[ADR-032]] 결정 4).
  it('자동 모드: 한 마리 모자라면 미완료 placeholder 는 그대로 선다', () => {
    const contents = [
      content({ name: PENDING, isRegistered: true }),
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1),
    ]

    expect(names(selectProfitDisplayBosses(contents, 'auto', []))).toContain(PENDING)
  })

  it('수동 모드: 한도를 채우면 추적 중인 미처치 보스도 행이 서지 않는다', () => {
    const contents = cleared(WEEKLY_BOSS_CLEAR_LIMIT)
    const manual: ManualTrackedItem[] = [{ contentName: PENDING, kind: 'boss', difficulty: '하드' }]

    expect(names(selectProfitDisplayBosses(contents, 'manual', manual))).not.toContain(PENDING)
  })

  // 마감은 «안 잡은 것» 에만 붙는다 — 실제로 번 것은 정산에서 사라지면 안 된다.
  it('실제로 처치한 보스는 한도를 채워도 전부 남는다', () => {
    const contents = cleared(WEEKLY_BOSS_CLEAR_LIMIT)

    expect(names(selectProfitDisplayBosses(contents, 'auto', []))).toHaveLength(WEEKLY_BOSS_CLEAR_LIMIT)
  })

  it('시즌 보스는 한도 밖이라 미처치여도 남는다', () => {
    const contents = [
      content({ name: '시즌 보스 메이린', difficulty: '노멀', isRegistered: true }),
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT),
    ]

    expect(names(selectProfitDisplayBosses(contents, 'auto', []))).toContain('시즌 보스 메이린')
  })

  it('월간 보스는 한도 밖이라 미처치여도 남는다', () => {
    const contents = [
      content({ name: '검은마법사', cycle: 'monthly', isRegistered: true }),
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT),
    ]

    expect(names(selectProfitDisplayBosses(contents, 'auto', []))).toContain('검은마법사')
  })
})
