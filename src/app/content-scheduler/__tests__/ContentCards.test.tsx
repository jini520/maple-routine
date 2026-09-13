// 컨텐츠 카드. **어떤 항목이 어떤 카드로 그려지는가**.
//
// 화면째 렌더하지 않고 `render*Card` 를 직접 부른다. 묻는 것이 **분기와 배지**이지 화면 배선이
// 아니고, 스토어 목 없이 같은 계약을
// 그대로 볼 수 있기 때문이다(화면 쪽 계약은 `ContentScreen.test.tsx` 가 따로 본다).
//
// **그림은 `testUri` 로 본다.** jest 에서 번들 에셋은 숫자가 아니라 `{ testUri }` 대역이라
// *"어느 파일로 해석됐는가"* 를 그 문자열로 묻는다.
// 그림이 실재하는지를 묻는 질문이다.
import type { DailyContent, WeeklyContent } from '../../../types'

import { findAllOfType, renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import { renderDailyContentCard } from '../DailyContentCards'
import { renderWeeklyContentCard } from '../WeeklyContentCards'
import { weeklyLimitClosedNames } from '../content-completion'

const HIDDEN = { includeHiddenElements: true } as const

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    name: '항목',
    kind: 'contents',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: null,
    ...overrides,
  }
}

function weekly(overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return {
    name: '항목',
    kind: 'contents',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: null,
    ...overrides,
  }
}

/** 이 카드가 실제로 그린 배경 그림의 파일 경로. 없으면 `null`. */
function artUri(view: Awaited<ReturnType<typeof renderAtom>>): string | null {
  const art = view.queryByTestId('faded-illustration', HIDDEN)
  if (art === null) return null
  const image = art.children.find(
    (child): child is AtomElement => typeof child !== 'string' && child.props.source !== undefined,
  )
  return (image?.props.source as { testUri?: string } | undefined)?.testUri ?? null
}

/**
 * 진행률 바가 낸 접근성 값. **`getByRole('progressbar')` 로는 못 찾는다.** RNTL 14 의 역할 질의는
 * 접근성 요소로 표시된 노드만 보는데 이 트랙은 `accessible` 없이 `accessibilityRole` 만 달고 있고
 * 그쪽 테스트도 같은 이유로
 * 트리를 직접 훑는다.
 */
function progressNow(view: Awaited<ReturnType<typeof renderAtom>>): number | undefined {
  const track = findAllOfType(view.toJSON(), 'View').find(
    (node) => node.props.accessibilityRole === 'progressbar',
  )
  return (track?.props.accessibilityValue as { now: number } | undefined)?.now
}

describe('일간 카드', () => {
  it('kind: quest 는 접두어를 뗀 이름 + quest_state 배지 + 지역 배경이다', async () => {
    const view = await renderAtom(
      renderDailyContentCard(
        daily({ name: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', questState: 1 }),
        300,
      ),
    )

    expect(view.getByText('레헬른의 평온한 밤')).toBeTruthy()
    expect(view.queryByText(/\[일일 퀘스트\]/)).toBeNull()
    expect(view.getByText('진행 중')).toBeTruthy()
    expect(artUri(view)).toContain('lacheln')
  })

  it('몬스터파크는 진행 배지와 진행률 바를 함께 그린다', async () => {
    const view = await renderAtom(
      renderDailyContentCard(daily({ name: '몬스터파크', nowCount: 7, maxCount: 14 }), 300),
    )

    expect(view.getByText('7/14')).toBeTruthy()
    expect(progressNow(view)).toBe(7)
    expect(artUri(view)).toContain('monsterPark')
  })

  it('지역이 안 잡히면 배경 없이 이름만 그린다. 폴백이 조용하다', async () => {
    const view = await renderAtom(
      renderDailyContentCard(daily({ name: '[일일 퀘스트] 없는지역', kind: 'quest', questState: 0 }), 300),
    )

    expect(view.getByText('없는지역')).toBeTruthy()
    expect(artUri(view)).toBeNull()
  })

  it('그 밖의 항목은 기본 카드(이름 · now/max)다', async () => {
    const view = await renderAtom(renderDailyContentCard(daily({ name: '기타', nowCount: 1, maxCount: 3 }), 300))

    expect(view.getByText('기타 · 1/3')).toBeTruthy()
  })
})

describe('주간 카드', () => {
  it('에픽 던전은 카테고리 배지 + 접두어 뗀 이름이고 now_count 로 완료를 가른다', async () => {
    const done = await renderAtom(renderWeeklyContentCard(weekly({ name: '에픽 던전 : 앵글러 컴퍼니', nowCount: 5 }), 300, false))
    expect(done.getByText('에픽 던전')).toBeTruthy()
    expect(done.getByText('앵글러 컴퍼니')).toBeTruthy()
    expect(done.getByText('완료')).toBeTruthy()

    const todo = await renderAtom(renderWeeklyContentCard(weekly({ name: '에픽 던전 : 하이마운틴', nowCount: 0 }), 300, false))
    expect(todo.getByText('시작 안함')).toBeTruthy()
  })

  it('지역 주간 퀘스트는 지역 배경과 now/max 기반 완료 배지를 쓴다', async () => {
    const view = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '에르다 스펙트럼', nowCount: 1, maxCount: 1 }), 300, false),
    )

    expect(view.getByText('에르다 스펙트럼')).toBeTruthy()
    expect(view.getByText('완료')).toBeTruthy()
    expect(artUri(view)).toContain('roadOfVanishing')
  })

  it('익스트림 몬스터파커는 접두어를 떼고 quest_state 를 그대로 쓴다', async () => {
    const view = await renderAtom(
      renderWeeklyContentCard(
        weekly({ name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?', questState: 1, nowCount: 0, maxCount: 5 }),
        300, false,
      ),
    )

    expect(view.getByText('익스트림 몬스터파커에 도전해보겠나?')).toBeTruthy()
    expect(view.getByText('진행 중')).toBeTruthy()
    expect(artUri(view)).toContain('monsterPark')
  })

  // quest_state 가 아니라 **도달 층수**다. 배지 종류가 갈리는 자리라 두 방향을 다 본다.
  it('무릉도장은 now_count 를 "N층"으로 보여주고, 참여 전이면 "시작 안함"이다', async () => {
    const played = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '무릉도장', nowCount: 37, maxCount: 100 }), 300, false),
    )
    expect(played.getByText('37층')).toBeTruthy()
    expect(played.queryByText('완료')).toBeNull()
    expect(artUri(played)).toContain('muruengRaid')

    const fresh = await renderAtom(renderWeeklyContentCard(weekly({ name: '무릉도장', nowCount: 0, maxCount: 100 }), 300, false))
    expect(fresh.getByText('시작 안함')).toBeTruthy()
  })

  it('성실한 조사에 대한 보답은 "N회 완료" 를 거쳐 완료로 전환된다', async () => {
    const partial = await renderAtom(
      renderWeeklyContentCard(
        weekly({ name: '성실한 조사에 대한 보답', questState: 1, nowCount: 1, maxCount: 2 }),
        300, false,
      ),
    )
    expect(partial.getByText('1회 완료')).toBeTruthy()

    const complete = await renderAtom(
      renderWeeklyContentCard(
        weekly({ name: '성실한 조사에 대한 보답', questState: 1, nowCount: 2, maxCount: 2 }),
        300, false,
      ),
    )
    expect(complete.getByText('완료')).toBeTruthy()
  })

  it('메이플 유니온은 접두어를 떼고 드래곤 배경의 카테고리 카드가 된다', async () => {
    const view = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[메이플 유니온] 드래곤 퇴치', questState: 2 }), 300, false),
    )

    expect(view.getByText('유니온')).toBeTruthy()
    expect(view.getByText('드래곤 퇴치')).toBeTruthy()
    expect(artUri(view)).toContain('armorDragon')
  })

  // 셋이 **서로 독립**이라는 것이 요점이다. 하나만 등록돼도 나머지에 영향이 없다.
  it('길드 3종은 저마다 다른 카드다', async () => {
    const waterway = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[길드] 지하 수로', nowCount: 1200 }), 300, false),
    )
    expect(waterway.getByText('지하 수로')).toBeTruthy()
    expect(waterway.getByText('1200점')).toBeTruthy()

    const points = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[길드] 주간 미션 포인트', nowCount: 3, maxCount: 10 }), 300, false),
    )
    expect(points.getByText('3/10')).toBeTruthy()
    expect(progressNow(points)).toBe(3)

    const flag = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[길드] 플래그 레이스', nowCount: 1 }), 300, false),
    )
    expect(flag.getByText('플래그 레이스')).toBeTruthy()
    expect(flag.getByText('완료')).toBeTruthy()
  })

  it('그 밖의 항목은 기본 카드다', async () => {
    const view = await renderAtom(renderWeeklyContentCard(weekly({ name: '기타', nowCount: 1, maxCount: 3 }), 300, false))

    expect(view.getByText('기타 · 1/3')).toBeTruthy()
  })
})

// 진행 불가면 상태 배지를 **대체**한다(늘리지 않는다). 진행할 수 없는 항목의
// **완료/n회/n층** 은 뜻이 없다. 그 값은 게임이 준 스냅샷이지 이 캐릭터가 할 수 있다는 뜻이 아니다.
describe('진행 불가 배지', () => {
  it('요구 레벨에 못 미치면 상태 배지 자리에 **진행 불가** 가 선다', async () => {
    const 미달 = await renderAtom(renderDailyContentCard(daily({ name: '몬스터파크', nowCount: 3, maxCount: 14 }), 104))

    expect(미달.queryByText('진행 불가')).not.toBeNull()
    expect(미달.queryByText('3/14')).toBeNull()
  })

  it('레벨이 되면 원래 배지가 그대로다', async () => {
    const 충족 = await renderAtom(renderDailyContentCard(daily({ name: '몬스터파크', nowCount: 3, maxCount: 14 }), 105))

    expect(충족.queryByText('진행 불가')).toBeNull()
    expect(충족.queryByText('3/14')).not.toBeNull()
  })

  // 주간 컨텐츠 5개(유니온 둘· 길드 셋)는 참조표에 요구 레벨이 없다. 어떤 레벨에서도 진행 가능이다.
  it('요구 레벨이 없는 항목은 낮은 레벨에서도 배지가 안 뜬다', async () => {
    const view = await renderAtom(renderWeeklyContentCard(weekly({ name: '[길드] 지하 수로', nowCount: 1200 }), 1, false))

    expect(view.queryByText('진행 불가')).toBeNull()
  })
})

// 에픽 던전 주 3회 한도가 차면 남은 던전은 `마감` 이다. 보스 카드의 `마감` 과 같은 배지이고
// 우선순위도 보스와 같다. `진행 불가` → `마감` → `완료`. 카드에 넘기는 값은 화면처럼
// `weeklyLimitClosedNames` 로 판정한다.
describe('마감 배지', () => {
  const 넷 = [
    weekly({ name: '에픽 던전 : 하이마운틴', nowCount: 1 }),
    weekly({ name: '에픽 던전 : 앵글러 컴퍼니', nowCount: 1 }),
    weekly({ name: '에픽 던전 : 악몽선경', nowCount: 0 }),
    weekly({ name: '에픽 던전 : 아우룸 레기스', nowCount: 1 }),
  ]
  const closed = weeklyLimitClosedNames(넷)
  const 카드 = (index: number, level: number) =>
    renderAtom(renderWeeklyContentCard(넷[index], level, closed.has(넷[index].name)))

  it('한도가 찼고 미완료면 상태 배지 자리에 마감이 선다', async () => {
    const view = await 카드(2, 300)

    expect(view.getByText('마감')).toBeTruthy()
    expect(view.queryByText('시작 안함')).toBeNull()
  })

  it('한도가 찼어도 완료한 던전은 완료다', async () => {
    const view = await 카드(0, 300)

    expect(view.getByText('완료')).toBeTruthy()
    expect(view.queryByText('마감')).toBeNull()
  })

  it('요구 레벨 미달이면 한도가 차도 진행 불가다', async () => {
    const 셋완료 = [...넷.slice(0, 2), weekly({ name: '에픽 던전 : 악몽선경', nowCount: 1 }), weekly({ name: '에픽 던전 : 아우룸 레기스', nowCount: 0 })]
    const aurum = 셋완료[3]
    const view = await renderAtom(renderWeeklyContentCard(aurum, 285, weeklyLimitClosedNames(셋완료).has(aurum.name)))

    expect(view.getByText('진행 불가')).toBeTruthy()
    expect(view.queryByText('마감')).toBeNull()
  })

  // 완료 자리를 대신하는 배지라 상자가 같아야 한다. 크기가 다르면 카드 오른쪽 끝이 흔들린다. 색만 갈린다.
  it('마감 배지는 완료 배지와 같은 상자다', async () => {
    const boxOf = (element: AtomElement): Record<string, unknown> => {
      const { color, backgroundColor, ...box } = element.props.style as Record<string, unknown>
      void color
      void backgroundColor
      return box
    }

    expect(boxOf((await 카드(2, 300)).getByText('마감'))).toEqual(boxOf((await 카드(0, 300)).getByText('완료')))
  })
})
