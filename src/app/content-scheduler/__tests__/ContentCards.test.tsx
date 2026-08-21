// 컨텐츠 카드 — **어떤 항목이 어떤 카드로 그려지는가**([[ADR-020]]·[[ADR-021]]).
//
// 웹은 이 계약을 `ContentScreen.test.tsx` 안에서 화면째 렌더해 검사했다. 여기서는 `render*Card`
// 를 직접 부른다 — 묻는 것이 **분기와 배지**이지 화면 배선이 아니고, 스토어 목 없이 같은 계약을
// 그대로 볼 수 있기 때문이다(화면 쪽 계약은 `ContentScreen.test.tsx` 가 따로 본다).
//
// **그림은 `testUri` 로 본다.** jest 에서 번들 에셋은 숫자가 아니라 `{ testUri }` 대역이라
// ([[ADR-129]] 의 `image-asset.native.ts`) *"어느 파일로 해석됐는가"* 를 그 문자열로 묻는다 —
// 웹이 `src` 속성으로 묻던 것과 같은 질문이다.
import type { DailyContent, WeeklyContent } from '@core/types'

import { findAllOfType, renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import { renderDailyContentCard } from '../DailyContentCards'
import { renderWeeklyContentCard } from '../WeeklyContentCards'

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

/** 이 카드가 실제로 그린 배경 그림의 파일 경로. 없으면 `null`(웹의 "아트 div 자체가 없음"). */
function artUri(view: Awaited<ReturnType<typeof renderAtom>>): string | null {
  const art = view.queryByTestId('media-card-art', HIDDEN)
  if (art === null) return null
  const image = art.children.find(
    (child): child is AtomElement => typeof child !== 'string' && child.props.source !== undefined,
  )
  return (image?.props.source as { testUri?: string } | undefined)?.testUri ?? null
}

/**
 * 진행률 바가 낸 접근성 값 — **`getByRole('progressbar')` 로는 못 찾는다.** RNTL 14 의 역할 질의는
 * 접근성 요소로 표시된 노드만 보는데 이 트랙은 `accessible` 없이 `accessibilityRole` 만 달고 있고
 * (`ProgressBar` atom 이 웹의 `role`/`aria-*` 를 그대로 옮긴 모양), 그쪽 테스트도 같은 이유로
 * 트리를 직접 훑는다.
 */
function progressNow(view: Awaited<ReturnType<typeof renderAtom>>): number | undefined {
  const track = findAllOfType(view.toJSON(), 'View').find(
    (node) => node.props.accessibilityRole === 'progressbar',
  )
  return (track?.props.accessibilityValue as { now: number } | undefined)?.now
}

describe('일간 카드 ([[ADR-020]])', () => {
  it('kind: quest 는 접두어를 뗀 이름 + quest_state 배지 + 지역 배경이다', async () => {
    const view = await renderAtom(
      renderDailyContentCard(
        daily({ name: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', questState: 1 }),
      ),
    )

    expect(view.getByText('레헬른의 평온한 밤')).toBeTruthy()
    expect(view.queryByText(/\[일일 퀘스트\]/)).toBeNull()
    expect(view.getByText('진행 중')).toBeTruthy()
    expect(artUri(view)).toContain('lacheln')
  })

  it('몬스터파크는 진행 배지와 진행률 바를 함께 그린다', async () => {
    const view = await renderAtom(
      renderDailyContentCard(daily({ name: '몬스터파크', nowCount: 7, maxCount: 14 })),
    )

    expect(view.getByText('7/14')).toBeTruthy()
    expect(progressNow(view)).toBe(7)
    expect(artUri(view)).toContain('monsterPark')
  })

  it('지역이 안 잡히면 배경 없이 이름만 그린다 — 폴백이 조용하다', async () => {
    const view = await renderAtom(
      renderDailyContentCard(daily({ name: '[일일 퀘스트] 없는지역', kind: 'quest', questState: 0 })),
    )

    expect(view.getByText('없는지역')).toBeTruthy()
    expect(artUri(view)).toBeNull()
  })

  it('그 밖의 항목은 기본 카드(이름 · now/max)다', async () => {
    const view = await renderAtom(renderDailyContentCard(daily({ name: '기타', nowCount: 1, maxCount: 3 })))

    expect(view.getByText('기타 · 1/3')).toBeTruthy()
  })
})

describe('주간 카드 ([[ADR-021]])', () => {
  it('에픽 던전은 카테고리 배지 + 접두어 뗀 이름이고 now_count 로 완료를 가른다', async () => {
    const done = await renderAtom(renderWeeklyContentCard(weekly({ name: '에픽 던전 : 앵글러 컴퍼니', nowCount: 5 })))
    expect(done.getByText('에픽 던전')).toBeTruthy()
    expect(done.getByText('앵글러 컴퍼니')).toBeTruthy()
    expect(done.getByText('완료')).toBeTruthy()

    const todo = await renderAtom(renderWeeklyContentCard(weekly({ name: '에픽 던전 : 하이마운틴', nowCount: 0 })))
    expect(todo.getByText('시작 안함')).toBeTruthy()
  })

  it('지역 주간 퀘스트는 지역 배경과 now/max 기반 완료 배지를 쓴다', async () => {
    const view = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '에르다 스펙트럼', nowCount: 1, maxCount: 1 })),
    )

    expect(view.getByText('에르다 스펙트럼')).toBeTruthy()
    expect(view.getByText('완료')).toBeTruthy()
    expect(artUri(view)).toContain('roadOfVanishing')
  })

  it('익스트림 몬스터파커는 접두어를 떼고 quest_state 를 그대로 쓴다', async () => {
    const view = await renderAtom(
      renderWeeklyContentCard(
        weekly({ name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?', questState: 1, nowCount: 0, maxCount: 2 }),
      ),
    )

    expect(view.getByText('익스트림 몬스터파커에 도전해보겠나?')).toBeTruthy()
    expect(view.getByText('진행 중')).toBeTruthy()
    expect(artUri(view)).toContain('monsterPark')
  })

  // quest_state 가 아니라 **도달 층수**다 — 배지 종류가 갈리는 자리라 두 방향을 다 본다.
  it('무릉도장은 now_count 를 "N층"으로 보여주고, 참여 전이면 "시작 안함"이다', async () => {
    const played = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '무릉도장', nowCount: 37, maxCount: 100 })),
    )
    expect(played.getByText('37층')).toBeTruthy()
    expect(played.queryByText('완료')).toBeNull()
    expect(artUri(played)).toContain('muruengRaid')

    const fresh = await renderAtom(renderWeeklyContentCard(weekly({ name: '무릉도장', nowCount: 0, maxCount: 100 })))
    expect(fresh.getByText('시작 안함')).toBeTruthy()
  })

  it('성실한 조사에 대한 보답은 "N회 완료" 를 거쳐 완료로 전환된다', async () => {
    const partial = await renderAtom(
      renderWeeklyContentCard(
        weekly({ name: '성실한 조사에 대한 보답', questState: 1, nowCount: 1, maxCount: 2 }),
      ),
    )
    expect(partial.getByText('1회 완료')).toBeTruthy()

    const complete = await renderAtom(
      renderWeeklyContentCard(
        weekly({ name: '성실한 조사에 대한 보답', questState: 1, nowCount: 2, maxCount: 2 }),
      ),
    )
    expect(complete.getByText('완료')).toBeTruthy()
  })

  it('메이플 유니온은 접두어를 떼고 드래곤 배경의 카테고리 카드가 된다', async () => {
    const view = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[메이플 유니온] 드래곤 퇴치', questState: 2 })),
    )

    expect(view.getByText('유니온')).toBeTruthy()
    expect(view.getByText('드래곤 퇴치')).toBeTruthy()
    expect(artUri(view)).toContain('armorDragon')
  })

  // 셋이 **서로 독립**이라는 것이 [[ADR-021]] 정정의 요점이다 — 하나만 등록돼도 나머지에 영향이 없다.
  it('길드 3종은 저마다 다른 카드다', async () => {
    const waterway = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[길드] 지하 수로', nowCount: 1200 })),
    )
    expect(waterway.getByText('지하 수로')).toBeTruthy()
    expect(waterway.getByText('1200점')).toBeTruthy()

    const points = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[길드] 주간 미션 포인트', nowCount: 3, maxCount: 10 })),
    )
    expect(points.getByText('3/10')).toBeTruthy()
    expect(progressNow(points)).toBe(3)

    const flag = await renderAtom(
      renderWeeklyContentCard(weekly({ name: '[길드] 플래그 레이스', nowCount: 1 })),
    )
    expect(flag.getByText('플래그 레이스')).toBeTruthy()
    expect(flag.getByText('완료')).toBeTruthy()
  })

  it('그 밖의 항목은 기본 카드다', async () => {
    const view = await renderAtom(renderWeeklyContentCard(weekly({ name: '기타', nowCount: 1, maxCount: 3 })))

    expect(view.getByText('기타 · 1/3')).toBeTruthy()
  })
})
