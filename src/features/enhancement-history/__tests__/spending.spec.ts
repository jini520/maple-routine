import { enhancementCostPartsOf, summarizeEnhancement, type EnhancementSource } from '../spending'

const entry = (over: Partial<EnhancementSource> = {}): EnhancementSource => ({
  kind: 'cube',
  dateKey: '2026-09-05',
  characterName: '낟낟',
  targetItem: '아케인셰이드 클로',
  itemKey: 'arcane_umbra_knuckle',
  itemLevel: 200,
  payload: {},
  ...over,
})

const NO_EVENT = new Set<string>()

/** 줄 하나의 시도 비용. 값을 못 매기면 `null`. */
const attemptMesoOf = (over: Partial<EnhancementSource>) => enhancementCostPartsOf(entry(over))?.attemptMeso ?? null

describe('큐브', () => {
  it('레벨로 감정비용을 매긴다', () => {
    expect(attemptMesoOf({ itemLevel: 150 })).toBe(450_000)
  })

  it('120 이하는 0 이다. 모르는 것이 아니다', () => {
    expect(attemptMesoOf({ itemLevel: 120 })).toBe(0)
  })

  it('레벨을 모르면 값이 없다', () => {
    expect(attemptMesoOf({ itemLevel: null })).toBeNull()
  })
})

// 큐브는 본잠·에디를 **안 가른다**. 한 번 갈라 봤고 되돌렸다(사용자 지정 2026-09-08).
// 갈라도 값이 안 바뀌는데 줄만 둘로 늘었다. 이 테스트가 그 되돌림을 지킨다.
describe('큐브 갈래', () => {
  it('종류가 달라도 한 장비의 큐브는 큐브 재설정 한 줄로 묶인다', () => {
    const rows = summarizeEnhancement(
      ['수상한 큐브', '레드 큐브', '블랙 큐브', '에디셔널 큐브', '화이트 에디셔널 큐브', ''].map((cubeType) =>
        entry({ payload: { cube_type: cubeType } }),
      ),
      NO_EVENT,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ enhancementCategory: 'cube_reset', attempts: 6 })
  })
})

// 잠재는 응답의 potential_type 이 본 잠재와 에디셔널을 가른다. 소울은 엔드포인트가 따로다.
it('스타포스 · 잠재능력 · 에디셔널 잠재능력 · 소울 잠재능력은 각자 분류 key 다', () => {
  const options = optionsOf(['레어'])
  const categories = summarizeEnhancement(
    [
      entry({ kind: 'starforce', payload: { before_starforce_count: 0, upgrade_item: '' } }),
      entry({ kind: 'potential', payload: { potential_type: '잠재능력 재설정', before_potential_option: options } }),
      entry({
        kind: 'potential',
        payload: { potential_type: '에디셔널 잠재능력 재설정', before_additional_potential_option: options },
      }),
      entry({ kind: 'soul_potential', payload: { before_soul_potential_option: options } }),
    ],
    NO_EVENT,
  ).map((row) => row.enhancementCategory)

  expect(categories).toEqual(['starforce', 'potential', 'additional_potential', 'soul_potential'])
})

/** 사용 전 옵션 세 줄. 넥슨 응답처럼 줄마다 `grade` 를 든다. */
function optionsOf(grades: string[]) {
  return grades.map((grade) => ({ value: '공격력 : +9%', grade }))
}

describe('잠재 재설정', () => {
  const potential = (type: string, grade: string, additional: string) => ({
    kind: 'potential' as const,
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
    expect(attemptMesoOf(potential('잠재능력 재설정', '유니크', '레어'))).toBe(38_250_000)
  })

  it('에디셔널은 사용 전 에디셔널 옵션을 본다', () => {
    expect(attemptMesoOf(potential('에디셔널 잠재능력 재설정', '유니크', '레전드리'))).toBe(88_000_000)
  })

  it('노멀은 재설정할 수 없는 등급이라 값이 없다', () => {
    expect(attemptMesoOf(potential('잠재능력 재설정', '노멀', '노멀'))).toBeNull()
  })

  /**
   * 응답의 등급 칸은 **오른 뒤** 등급이다(시뮬레이터 338건 실측). 재설정 비용은 누르기 전 등급으로
   * 내므로 사용 전 옵션의 최고 등급으로 센다. 두 예는 그 실측의 줄이다.
   */
  describe('등급이 오른 줄', () => {
    it('본 잠재는 오르기 전 등급으로 센다', () => {
      expect(
        attemptMesoOf({
          kind: 'potential',
          itemLevel: 200,
          targetItem: '제네시스 폴암',
          payload: {
            potential_type: '잠재능력 재설정',
            item_upgrade_result: '성공',
            potential_option_grade: '레전드리',
            before_potential_option: optionsOf(['유니크', '에픽', '유니크']),
          },
        }),
      ).toBe(38_250_000)
    })

    it('에디셔널도 오르기 전 등급으로 센다. 아랫줄의 노멀은 등급이 아니다', () => {
      expect(
        attemptMesoOf({
          kind: 'potential',
          itemLevel: 160,
          targetItem: '고통의 근원',
          payload: {
            potential_type: '에디셔널 잠재능력 재설정',
            item_upgrade_result: '성공',
            additional_potential_option_grade: '에픽',
            before_additional_potential_option: optionsOf(['레어', '노멀', '노멀']),
          },
        }),
      ).toBe(10_375_000)
    })
  })

  // 등급 칸으로 물러서지 않는다. 그 칸은 오른 뒤 값이라 틀린 값이 조용히 선다.
  it('사용 전 옵션이 없으면 값이 없다', () => {
    expect(
      attemptMesoOf({ kind: 'potential', payload: { potential_type: '잠재능력 재설정', potential_option_grade: '유니크' } }),
    ).toBeNull()
  })

  it('사용 전 옵션에 모르는 등급 글자가 있으면 값이 없다', () => {
    expect(
      attemptMesoOf({
        kind: 'potential',
        payload: {
          potential_type: '잠재능력 재설정',
          potential_option_grade: '유니크',
          before_potential_option: optionsOf(['Unique', '유니크', '유니크']),
        },
      }),
    ).toBeNull()
  })
})

// 응답 모양은 넥슨 문서의 `SoulPotentialHistory` 다. 값은 실물을 못 봐 잠재에서 잰 규칙을 옮겼다.
describe('소울 잠재능력 재설정', () => {
  const soul = (before: string[], grade: string, over: Record<string, unknown> = {}) => ({
    kind: 'soul_potential' as const,
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
    expect(attemptMesoOf(soul(['유니크', '유니크', '에픽'], '유니크'))).toBe(65_000_000)
  })

  it('등급이 오른 줄은 오르기 전 등급으로 센다', () => {
    expect(attemptMesoOf(soul(['레어', '레어', '레어'], '에픽', { item_upgrade_result: '성공' }))).toBe(20_000_000)
  })

  it('등급 글자가 표에 없으면 값이 없다', () => {
    expect(attemptMesoOf(soul(['Legendary'], 'Legendary'))).toBeNull()
  })
})

describe('스타포스', () => {
  const starforce = (over: Record<string, unknown> = {}) => ({
    kind: 'starforce' as const,
    itemLevel: null,
    targetItem: '아케인셰이드 클로',
    payload: { before_starforce_count: 18, upgrade_item: '', starforce_event_list: null, ...over },
  })

  // 응답에 item_level 이 없다. 응답을 받을 때 얻은 장비 key 로 표에서 찾는다.
  it('장비 key 로 레벨을 찾아 계산한다', () => {
    expect(attemptMesoOf(starforce())).toBe(324_061_900)
  })

  it('할인은 반올림 뒤에 붙는다', () => {
    expect(attemptMesoOf(starforce({ starforce_event_list: [{ cost_discount_rate: '30' }] }))).toBe(226_843_330)
  })

  // 200 레벨 17→18. 반올림 130,688,600, 30% 할인 91,482,020
  describe('파괴 방지', () => {
    const partsOf = (destroyDefence?: string) =>
      enhancementCostPartsOf(
        entry(
          starforce({
            before_starforce_count: 17,
            destroy_defence: destroyDefence,
            starforce_event_list: [{ cost_discount_rate: '30' }],
          }),
        ),
      )

    // MVP 할인을 화면에서 시도 비용에만 붙이므로 두 몫을 따로 든다.
    it('적용이면 할인 전 비용의 200% 를 시도 비용과 따로 든다', () => {
      expect(partsOf('파괴 방지 적용')).toEqual({ attemptMeso: 91_482_020, destroyDefenceMeso: 261_377_200 })
    })

    it('미적용이나 모르는 값이면 추가분이 없다', () => {
      expect(partsOf('파괴 방지 미적용')?.destroyDefenceMeso).toBe(0)
      expect(partsOf('파괴 방지 알 수 없음')?.destroyDefenceMeso).toBe(0)
      expect(partsOf()?.destroyDefenceMeso).toBe(0)
    })
  })

  it('강화권을 쓰면 메소가 안 든다', () => {
    expect(attemptMesoOf(starforce({ upgrade_item: '카르마 스타포스 17성 강화권' }))).toBe(0)
  })

  // 레벨은 장비 표에서만 찾는다. 이름이 같은 큐브 줄의 레벨을 빌려 오지 않는다.
  it('표에 없는 장비는 값이 없다', () => {
    expect(attemptMesoOf({ ...starforce({ before_starforce_count: 3 }), targetItem: '왕푸', itemKey: null })).toBeNull()
  })
})

describe('묶기', () => {
  it('같은 날짜 · 캐릭터 · 분류 · 장비의 줄은 건수와 비용을 더한다', () => {
    const rows = summarizeEnhancement([entry({ itemLevel: 150 }), entry({ itemLevel: 150 })], NO_EVENT)

    expect(rows).toEqual([
      expect.objectContaining({ itemGroup: 'key:arcane_umbra_knuckle', attempts: 2, attemptCostMeso: 900_000 }),
    ])
  })

  it('날짜 · 캐릭터 · 장비 중 하나라도 다르면 줄을 나눈다', () => {
    const rows = summarizeEnhancement(
      [
        entry(),
        entry({ dateKey: '2026-09-06' }),
        entry({ characterName: '둘째' }),
        entry({ itemKey: 'genesis_polearm', targetItem: '제네시스 폴암' }),
      ],
      NO_EVENT,
    )

    expect(rows).toHaveLength(4)
  })

  // 장비 표에 없는 장비는 이름으로 묶는다. 같은 장비가 띄어쓰기 · 정규화만 달라 두 줄로 갈라지면 안 된다.
  it('key 가 없는 장비는 NFC 뒤 공백을 지운 이름으로 묶는다', () => {
    const rows = summarizeEnhancement(
      [
        entry({ itemKey: null, targetItem: '블랙 마법깃펜' }),
        entry({ itemKey: null, targetItem: '블랙마법깃펜'.normalize('NFD') }),
      ],
      NO_EVENT,
    )

    expect(rows).toEqual([expect.objectContaining({ itemGroup: 'name:블랙마법깃펜', itemKey: null, attempts: 2 })])
  })

  // 모르는 값을 0 원으로 세우면 건수만 늘고 합계가 조용히 틀린다.
  it('값을 못 매기는 줄은 건수에도 넣지 않는다', () => {
    const rows = summarizeEnhancement([entry({ itemLevel: 150 }), entry({ itemLevel: null })], NO_EVENT)

    expect(rows).toEqual([expect.objectContaining({ attempts: 1, attemptCostMeso: 450_000 })])
  })
})

describe('이벤트 월드', () => {
  it('스페셜 캐릭터의 줄은 이벤트 월드로 적는다', () => {
    const rows = summarizeEnhancement(
      [entry({ characterName: '머리맨들맨둘' }), entry({ characterName: '낟낟' })],
      new Set(['머리맨들맨둘']),
    )

    expect(rows.map((row) => [row.characterName, row.eventWorld])).toEqual([
      ['머리맨들맨둘', true],
      ['낟낟', false],
    ])
  })

  // 스타포스는 줄이 월드를 직접 준다. 목록보다 그 값이 이긴다.
  // 줄의 월드 이름은 응답 원문이라 월드 key 로 맞춘 뒤 판정한다.
  it('줄이 월드를 주면 월드 key 로 맞춘 그 값으로 판정한다', () => {
    const starforce = (worldName: string) =>
      entry({ kind: 'starforce', payload: { world_name: worldName, before_starforce_count: 0, upgrade_item: '' } })
    const rows = summarizeEnhancement(
      [starforce('스페셜 '.normalize('NFD')), { ...starforce('챌린저스2'), characterName: '둘째' }],
      new Set(['둘째']),
    )

    expect(rows.map((row) => [row.characterName, row.eventWorld])).toEqual([
      ['낟낟', true],
      ['둘째', false],
    ])
  })

  // 판정을 비워 두면 다음 목록을 받았을 때 다시 묶어 채운다. 지출로 세지도 서버로 보내지도 않는다.
  it('목록을 못 받았으면 월드를 모르는 줄의 판정을 비운다', () => {
    expect(summarizeEnhancement([entry()], null)[0].eventWorld).toBeNull()
  })
})

/*
  펄스 인핸서는 **전용 재화로 하는 강화**다. 메소가 한 푼도 안 들어서 지출 목록에 설 자리가
  없다(사용자 지정 2026-09-21). 0 원 줄로 세우면 안 쓴 돈이 건수로 잡혀 분류 합계의 건수가 뜬다.

  값 글자는 실제 기록에서 확인했다. 큐브는 `cube_type`, 스타포스는 `upgrade_item` 에 온다.
  넥슨 문서가 두 칸의 이름을 `사용 큐브 및 특수 재화` · `사용 주문서 및 특수 재화 명` 으로 고쳐
  적었고 새 칸은 없다.
*/
describe('펄스 인핸서는 지출이 아니다', () => {
  it('큐브 줄이 합계에서 빠진다', () => {
    expect(summarizeEnhancement([entry({ payload: { cube_type: '펄스 인핸서' }, itemLevel: 130 })], NO_EVENT)).toEqual([])
  })

  it('스타포스 줄도 합계에서 빠진다', () => {
    const row = entry({ kind: 'starforce', payload: { upgrade_item: '펄스 인핸서', world_name: '엘리시움' } })

    expect(summarizeEnhancement([row], NO_EVENT)).toEqual([])
  })

  // 다른 강화권은 그대로 선다. 그것들은 메소가 안 들 뿐 **쓴 물건**이라 기록으로 남는다.
  // 값은 실제 기록에 있는 것이다. 142건에 `… 스타포스 N성 강화권` 꼴 다섯과 빈 값 136 이 있다.
  it('다른 강화권 줄은 0 원으로 선다', () => {
    const row = entry({
      kind: 'starforce',
      payload: { upgrade_item: '카르마 스타포스 17성 강화권', world_name: '엘리시움', before_starforce_count: 17 },
    })

    expect(summarizeEnhancement([row], NO_EVENT)).toEqual([expect.objectContaining({ attempts: 1, attemptCostMeso: 0 })])
  })
})
