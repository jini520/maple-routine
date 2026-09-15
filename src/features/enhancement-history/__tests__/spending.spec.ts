import type { EnhancementHistoryEntry } from '../../../storage/enhancement-history'
import { toEnhancementSpending } from '../spending'

const entry = (over: Partial<EnhancementHistoryEntry> = {}): EnhancementHistoryEntry => ({
  id: 'x',
  kind: 'cube',
  dateKey: '2026-09-05',
  createdAt: '2026-09-05T07:00:00.000+09:00',
  characterName: '낟낟',
  targetItem: '아케인셰이드 클로',
  itemKey: 'arcane_umbra_knuckle',
  itemLevel: 200,
  payload: {},
  ...over,
})

const NO_EVENT = new Set<string>()

describe('큐브', () => {
  it('레벨로 감정비용을 매긴다', () => {
    const [row] = toEnhancementSpending([entry({ itemLevel: 150 })], NO_EVENT)

    expect(row.costMeso).toBe(450_000)
  })

  it('120 이하는 0 이다. 모르는 것이 아니다', () => {
    expect(toEnhancementSpending([entry({ itemLevel: 120 })], NO_EVENT)[0].costMeso).toBe(0)
  })

  it('레벨을 모르면 값이 없다', () => {
    expect(toEnhancementSpending([entry({ itemLevel: null })], NO_EVENT)[0].costMeso).toBeNull()
  })
})

// 큐브는 본잠·에디를 **안 가른다**. 한 번 갈라 봤고 되돌렸다(사용자 지정 2026-09-08).
// 갈라도 값이 안 바뀌는데 줄만 둘로 늘었다. 이 테스트가 그 되돌림을 지킨다.
describe('큐브 갈래', () => {
  const categoryOf = (cubeType: string) =>
    toEnhancementSpending([entry({ payload: { cube_type: cubeType } })], NO_EVENT)[0].category

  it.each(['수상한 큐브', '레드 큐브', '블랙 큐브', '에디셔널 큐브', '화이트 에디셔널 큐브'])(
    '%s 는 종류와 무관하게 큐브 재설정 줄이다',
    (cubeType) => {
      expect(categoryOf(cubeType)).toBe('cube_reset')
    },
  )

  it('종류를 못 읽어도 줄은 선다', () => {
    expect(toEnhancementSpending([entry({ payload: {} })], NO_EVENT)[0].category).toBe('cube_reset')
  })
})

// 잠재는 응답의 potential_type 이 본 잠재와 에디셔널을 가른다.
it('스타포스 · 잠재능력 · 에디셔널 잠재능력은 각자 갈래 key 다', () => {
  const categories = toEnhancementSpending(
    [
      entry({ id: 's', kind: 'starforce', payload: { before_starforce_count: 0, upgrade_item: '' } }),
      entry({ id: 'p', kind: 'potential', payload: { potential_type: '잠재능력 재설정' } }),
      entry({ id: 'a', kind: 'potential', payload: { potential_type: '에디셔널 잠재능력 재설정' } }),
    ],
    NO_EVENT,
  ).map((row) => row.category)

  expect(categories).toEqual(['starforce', 'potential', 'additional_potential'])
})

describe('잠재 재설정', () => {
  const potential = (type: string, grade: string, additional: string) =>
    entry({
      kind: 'potential',
      itemLevel: 200,
      payload: {
        potential_type: type,
        potential_option_grade: grade,
        additional_potential_option_grade: additional,
      },
    })

  it('본 잠재는 potential_option_grade 를 본다', () => {
    expect(toEnhancementSpending([potential('잠재능력 재설정', '유니크', '레어')], NO_EVENT)[0].costMeso)
      .toBe(38_250_000)
  })

  it('에디셔널은 additional 쪽을 본다', () => {
    expect(
      toEnhancementSpending([potential('에디셔널 잠재능력 재설정', '유니크', '레전드리')], NO_EVENT)[0].costMeso,
    ).toBe(88_000_000)
  })

  it('노멀은 재설정할 수 없는 등급이라 값이 없다', () => {
    expect(toEnhancementSpending([potential('잠재능력 재설정', '노멀', '노멀')], NO_EVENT)[0].costMeso)
      .toBeNull()
  })
})

describe('스타포스', () => {
  const starforce = (over: Record<string, unknown> = {}) =>
    entry({
      kind: 'starforce',
      itemLevel: null,
      targetItem: '아케인셰이드 클로',
      payload: { before_starforce_count: 18, upgrade_item: '', starforce_event_list: null, ...over },
    })

  // 응답에 item_level 이 없다. 응답을 받을 때 얻은 장비 key 로 표에서 찾는다.
  it('장비 key 로 레벨을 찾아 계산한다', () => {
    expect(toEnhancementSpending([starforce()], NO_EVENT)[0].costMeso).toBe(324_061_900)
  })

  it('할인은 반올림 뒤에 붙는다', () => {
    const list = [{ cost_discount_rate: '30' }]
    expect(toEnhancementSpending([starforce({ starforce_event_list: list })], NO_EVENT)[0].costMeso)
      .toBe(226_843_330)
  })

  describe('파괴 방지', () => {
    // 200 레벨 17→18. 반올림 130,688,600, 30% 할인 91,482,020
    const discounted = (destroyDefence: string) =>
      toEnhancementSpending(
        [starforce({ before_starforce_count: 17, destroy_defence: destroyDefence, starforce_event_list: [{ cost_discount_rate: '30' }] })],
        NO_EVENT,
      )[0].costMeso

    it('적용이면 할인 전 비용의 200% 를 할인 없이 더한다', () => {
      expect(discounted('파괴 방지 적용')).toBe(352_859_220)
    })

    it('미적용이면 더하지 않는다', () => {
      expect(discounted('파괴 방지 미적용')).toBe(91_482_020)
    })

    it('모르는 값이면 추가분 없이 센다', () => {
      expect(discounted('파괴 방지 알 수 없음')).toBe(91_482_020)
      expect(toEnhancementSpending([starforce({ before_starforce_count: 17 })], NO_EVENT)[0].costMeso).toBe(130_688_600)
    })
  })

  it('강화권을 쓰면 메소가 안 든다', () => {
    expect(toEnhancementSpending([starforce({ upgrade_item: '주문의 흔적' })], NO_EVENT)[0].costMeso).toBe(0)
  })

  it('표에 없는 장비는 값이 없다', () => {
    expect(toEnhancementSpending([entry({
      kind: 'starforce', itemLevel: null, targetItem: '왕푸', itemKey: null,
      payload: { before_starforce_count: 3, upgrade_item: '' },
    })], NO_EVENT)[0].costMeso).toBeNull()
  })

  // DB 가 같은 이름의 큐브 기록에서 본 레벨. 표에 없는 장비는 key 가 없어 이름으로 찾는다.
  it('표에 없는 장비는 관측된 레벨을 NFC 뒤 공백을 지운 이름으로 찾는다', () => {
    const observed = new Map([['블랙마법깃펜', 100]])
    const row = toEnhancementSpending(
      [entry({ kind: 'starforce', itemLevel: null, targetItem: '블랙 마법깃펜'.normalize('NFD'), itemKey: null, payload: { before_starforce_count: 0, upgrade_item: '' } })],
      NO_EVENT,
      observed,
    )[0]

    expect(row.costMeso).toBe(28_800)
  })
})

describe('이벤트 월드', () => {
  it('스페셜 캐릭터의 줄은 뺀다', () => {
    const rows = toEnhancementSpending(
      [entry({ characterName: '머리맨들맨둘' }), entry({ characterName: '낟낟' })],
      new Set(['머리맨들맨둘']),
    )

    expect(rows.map((row) => row.characterName)).toEqual(['낟낟'])
  })

  // 스타포스는 줄이 월드를 직접 준다. 목록보다 그 값이 이긴다.
  it('줄이 월드를 주면 그 값으로 뺀다', () => {
    const rows = toEnhancementSpending(
      [entry({ kind: 'starforce', payload: { world_name: '스페셜', before_starforce_count: 0, upgrade_item: '' } })],
      new Set(),
    )

    expect(rows).toEqual([])
  })

  // 줄의 월드 이름은 저장된 응답 원문이라 읽는 자리가 월드 key 로 맞춘다. 이벤트 월드인지는 월드 표의 칸이 정한다.
  it('줄의 월드 이름을 월드 key 로 맞춰 판정한다', () => {
    const starforce = (worldName: string) =>
      entry({ kind: 'starforce', payload: { world_name: worldName, before_starforce_count: 0, upgrade_item: '' } })
    const rows = toEnhancementSpending([starforce('스페셜 '.normalize('NFD')), starforce('챌린저스2')], new Set())

    expect(rows.map((row) => row.payload)).toEqual([expect.objectContaining({ world_name: '챌린저스2' })])
  })

  it('목록을 못 받았으면 월드를 모르는 줄을 뺀다', () => {
    const rows = toEnhancementSpending([entry({ characterName: '낟낟' })], null)

    expect(rows).toEqual([])
  })
})

describe('합계', () => {
  it('모르는 줄은 금액에서 빼고 건수만 센다', () => {
    const rows = toEnhancementSpending(
      [entry({ itemLevel: 150 }), entry({ id: 'y', itemLevel: null })],
      NO_EVENT,
    )

    expect(rows).toHaveLength(2)
    expect(rows.filter((row) => row.costMeso !== null)).toHaveLength(1)
  })
})
