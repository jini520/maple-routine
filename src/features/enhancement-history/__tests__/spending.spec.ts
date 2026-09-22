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

// 잠재는 응답의 potential_type 이 본 잠재와 에디셔널을 가른다. 소울은 엔드포인트가 따로다.
it('스타포스 · 잠재능력 · 에디셔널 잠재능력 · 소울 잠재능력은 각자 갈래 key 다', () => {
  const categories = toEnhancementSpending(
    [
      entry({ id: 's', kind: 'starforce', payload: { before_starforce_count: 0, upgrade_item: '' } }),
      entry({ id: 'p', kind: 'potential', payload: { potential_type: '잠재능력 재설정' } }),
      entry({ id: 'a', kind: 'potential', payload: { potential_type: '에디셔널 잠재능력 재설정' } }),
      entry({ id: 'u', kind: 'soul_potential', payload: {} }),
    ],
    NO_EVENT,
  ).map((row) => row.category)

  expect(categories).toEqual(['starforce', 'potential', 'additional_potential', 'soul_potential'])
})

/** 사용 전 옵션 세 줄. 넥슨 응답처럼 줄마다 `grade` 를 든다. */
const optionsOf = (grades: string[]) => grades.map((grade) => ({ value: '공격력 : +9%', grade }))

describe('잠재 재설정', () => {
  const potential = (type: string, grade: string, additional: string) =>
    entry({
      kind: 'potential',
      itemLevel: 200,
      payload: {
        potential_type: type,
        item_upgrade_result: '실패',
        potential_option_grade: grade,
        additional_potential_option_grade: additional,
        before_potential_option: optionsOf([grade, grade, grade]),
        before_additional_potential_option: optionsOf([additional, additional, additional]),
      },
    })

  it('본 잠재는 사용 전 잠재 옵션을 본다', () => {
    expect(toEnhancementSpending([potential('잠재능력 재설정', '유니크', '레어')], NO_EVENT)[0].costMeso)
      .toBe(38_250_000)
  })

  it('에디셔널은 사용 전 에디셔널 옵션을 본다', () => {
    expect(
      toEnhancementSpending([potential('에디셔널 잠재능력 재설정', '유니크', '레전드리')], NO_EVENT)[0].costMeso,
    ).toBe(88_000_000)
  })

  it('노멀은 재설정할 수 없는 등급이라 값이 없다', () => {
    expect(toEnhancementSpending([potential('잠재능력 재설정', '노멀', '노멀')], NO_EVENT)[0].costMeso)
      .toBeNull()
  })

  /**
   * 응답의 등급 칸은 **오른 뒤** 등급이다(시뮬레이터 338건 실측). 재설정 비용은 누르기 전 등급으로
   * 내므로 사용 전 옵션의 최고 등급으로 센다. 두 예는 그 실측의 줄이다.
   */
  describe('등급이 오른 줄', () => {
    it('본 잠재는 오르기 전 등급으로 센다', () => {
      const row = entry({
        kind: 'potential',
        itemLevel: 200,
        targetItem: '제네시스 폴암',
        payload: {
          potential_type: '잠재능력 재설정',
          item_upgrade_result: '성공',
          potential_option_grade: '레전드리',
          before_potential_option: optionsOf(['유니크', '에픽', '유니크']),
        },
      })

      expect(toEnhancementSpending([row], NO_EVENT)[0].costMeso).toBe(38_250_000)
    })

    it('에디셔널도 오르기 전 등급으로 센다. 아랫줄의 노멀은 등급이 아니다', () => {
      const row = entry({
        kind: 'potential',
        itemLevel: 160,
        targetItem: '고통의 근원',
        payload: {
          potential_type: '에디셔널 잠재능력 재설정',
          item_upgrade_result: '성공',
          additional_potential_option_grade: '에픽',
          before_additional_potential_option: optionsOf(['레어', '노멀', '노멀']),
        },
      })

      expect(toEnhancementSpending([row], NO_EVENT)[0].costMeso).toBe(10_375_000)
    })
  })

  // 등급 칸으로 물러서지 않는다. 그 칸은 오른 뒤 값이라 틀린 값이 조용히 선다.
  it('사용 전 옵션이 없으면 값이 없다', () => {
    const row = entry({
      kind: 'potential',
      payload: { potential_type: '잠재능력 재설정', potential_option_grade: '유니크' },
    })

    expect(toEnhancementSpending([row], NO_EVENT)[0].costMeso).toBeNull()
  })

  it('사용 전 옵션에 모르는 등급 글자가 있으면 값이 없다', () => {
    const row = entry({
      kind: 'potential',
      payload: {
        potential_type: '잠재능력 재설정',
        potential_option_grade: '유니크',
        before_potential_option: optionsOf(['Unique', '유니크', '유니크']),
      },
    })

    expect(toEnhancementSpending([row], NO_EVENT)[0].costMeso).toBeNull()
  })
})

// 응답 모양은 넥슨 문서의 `SoulPotentialHistory` 다. 값은 실물을 못 봐 잠재에서 잰 규칙을 옮겼다.
describe('소울 잠재능력 재설정', () => {
  const soul = (before: string[], grade: string, over: Record<string, unknown> = {}) =>
    entry({
      kind: 'soul_potential',
      itemLevel: null,
      targetItem: '제네시스 폴암',
      payload: {
        item_upgrade_result: '실패',
        soul_potential_grade: grade,
        before_soul_potential_option: optionsOf(before),
        ...over,
      },
    })

  // 응답에 `item_level` 이 없다. 소울 비용은 레벨을 안 본다.
  it('등급 하나로 값을 매긴다. 레벨이 없어도 된다', () => {
    expect(toEnhancementSpending([soul(['유니크', '유니크', '에픽'], '유니크')], NO_EVENT)[0].costMeso)
      .toBe(65_000_000)
  })

  it('등급이 오른 줄은 오르기 전 등급으로 센다', () => {
    const row = soul(['레어', '레어', '레어'], '에픽', { item_upgrade_result: '성공' })

    expect(toEnhancementSpending([row], NO_EVENT)[0].costMeso).toBe(20_000_000)
  })

  it('등급 글자가 표에 없으면 값이 없다', () => {
    expect(toEnhancementSpending([soul(['Legendary'], 'Legendary')], NO_EVENT)[0].costMeso).toBeNull()
  })

  // 응답에 `world_name` 이 없다. 큐브 · 잠재처럼 캐릭터 이름으로 거른다.
  it('스페셜 캐릭터의 줄은 이름으로 뺀다', () => {
    const rows = toEnhancementSpending(
      [{ ...soul(['레어'], '레어'), characterName: '머리맨들맨둘' }],
      new Set(['머리맨들맨둘']),
    )

    expect(rows).toEqual([])
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
    expect(toEnhancementSpending([starforce({ upgrade_item: '카르마 스타포스 17성 강화권' })], NO_EVENT)[0].costMeso).toBe(0)
  })

  it('그 줄의 캐릭터와 날짜로 찾은 MVP 할인을 이벤트 할인에 곱한다', () => {
    const asked: [string, string][] = []
    const mvpDiscountOf = (name: string, dateKey: string) => {
      asked.push([name, dateKey])
      return 10
    }
    const list = [{ cost_discount_rate: '30' }]
    const [row] = toEnhancementSpending([starforce({ starforce_event_list: list })], NO_EVENT, new Map(), mvpDiscountOf)

    expect(row.costMeso).toBe(Math.floor((324_061_900 * 70 * 90) / 10000))
    expect(asked).toEqual([['낟낟', '2026-09-05']])
  })

  it('MVP 할인은 스타포스에만 붙는다', () => {
    const [row] = toEnhancementSpending([entry({ itemLevel: 150 })], NO_EVENT, new Map(), () => 10)
    expect(row.costMeso).toBe(450_000)
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

/*
  펄스 인핸서는 **전용 재화로 하는 강화**다. 메소가 한 푼도 안 들어서 지출 목록에 설 자리가
  없다(사용자 지정 2026-09-21). 0 원 줄로 세우면 안 쓴 돈이 건수로 잡혀 갈래 합계의 건수가 뜬다.

  값 글자는 실제 기록에서 확인했다. 큐브는 `cube_type`, 스타포스는 `upgrade_item` 에 온다.
  넥슨 문서가 두 칸의 이름을 `사용 큐브 및 특수 재화` · `사용 주문서 및 특수 재화 명` 으로 고쳐
  적었고 새 칸은 없다.
*/
describe('펄스 인핸서는 지출이 아니다', () => {
  it('큐브 줄이 목록에서 빠진다', () => {
    const rows = toEnhancementSpending(
      [entry({ payload: { cube_type: '펄스 인핸서' }, itemLevel: 130 })],
      NO_EVENT,
    )

    expect(rows).toEqual([])
  })

  it('스타포스 줄도 목록에서 빠진다', () => {
    const rows = toEnhancementSpending(
      [entry({ kind: 'starforce', payload: { upgrade_item: '펄스 인핸서', world_name: '엘리시움' } })],
      NO_EVENT,
    )

    expect(rows).toEqual([])
  })

  // 다른 강화권은 그대로 선다. 그것들은 메소가 안 들 뿐 **쓴 물건**이라 기록으로 남는다.
  // 값은 실제 기록에 있는 것이다. 142건에 `… 스타포스 N성 강화권` 꼴 다섯과 빈 값 136 이 있다.
  it('다른 강화권 줄은 그대로 선다. 0 원으로', () => {
    const rows = toEnhancementSpending(
      [entry({ kind: 'starforce', payload: { upgrade_item: '카르마 스타포스 17성 강화권', world_name: '엘리시움' } })],
      NO_EVENT,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].costMeso).toBe(0)
  })

  it('보통 큐브 줄은 그대로 선다', () => {
    const rows = toEnhancementSpending(
      [entry({ payload: { cube_type: '수상한 큐브' }, itemLevel: 130 })],
      NO_EVENT,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].costMeso).toBe(338_000)
  })
})
