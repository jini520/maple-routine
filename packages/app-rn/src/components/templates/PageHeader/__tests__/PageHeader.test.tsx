// 화면 상단 헤더 셸([[ADR-094]] 4단계). 웹판 테스트가 지키던 것은 *"4화면이 복붙하던 마크업을 글자
// 하나까지 그대로 낸다"* 였는데, RN 에서는 그 마크업이 통째로 바뀌므로(`PageHeader.tsx` 파일 머리)
// 이 파일이 지키는 것도 갈린다.
//
// | 웹판이 지키던 것 | 여기서는 |
// |---|---|
// | 셸 클래스 문자열 동일 | **스냅샷 기준선**으로 대체(값 대조가 불가능하다) |
// | `fixed` 이지 `sticky` 가 아니다([[ADR-098]] 결정 2) | **스크롤 뷰 밖에 있다** — 위치가 스크롤의 함수가 아닌 것이 요점이고, RN 은 그것을 레이아웃으로 얻는다 |
// | spacer 가 실측 높이와 같은 커밋에 갱신된다([[ADR-112]]) | **spacer 자체가 없다** — 아래 회귀 가드 |
// | 페이드에 `backdrop-filter` 가 없다([[ADR-123]]) | 그대로 검사한다 |
// | `below` 는 페이드 뒤, 셸의 마지막 자식 | 그대로 검사한다 |
//
// 안전영역은 `renderOverlay` 가 넣는 실측 인셋(상 59)을 쓴다 — [[ADR-107]] 이 실측한 표와 같은 값이다.

import { getThemeDefinition } from '@core/lib/theme-registry'
import { Text, View } from 'react-native'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { rnThemeAppearancePort } from '../../../../native/adapters/rn-theme-appearance'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { PageHeader } from '../PageHeader'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

const 기본테마 = getThemeDefinition('머쉬맘')

/** RN 은 벌거벗은 문자열을 View 자식으로 못 그린다 — 웹판 테스트의 `내용` 자리. */
const 내용 = <Text>내용</Text>

/** 페이드는 `aria-hidden` 이라 RNTL 기본 쿼리에서 빠진다(`PullToRefreshIndicator` 테스트와 같은 사정). */
const HIDDEN = { includeHiddenElements: true } as const

describe('PageHeader', () => {
  it('상단 안전영역 + 16px 을 자기 패딩으로 먹는다 (웹 `pt-[calc(1rem+var(--sa-top))]`)', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(flattenStyle(getByTestId('page-header').props.style)).toMatchObject({
      paddingTop: 테스트_안전영역.insets.top + 16,
      backgroundColor: 기본테마.bg,
    })
  })

  // ★ [[ADR-098]] 결정 2 · [[ADR-112]] 회귀 가드 — **웹의 형태를 되살리지 말 것.**
  //
  // 웹에서 이 셸은 `fixed` + 실측 spacer 였고, [[ADR-112]] 는 그 spacer 가 헤더보다 한 프레임 늦게
  // 갱신되는 결함(이슈 #168, 약 90px)을 고치느라 measure/observe 두 effect 를 두었다. RN 에서
  // 그 형태를 흉내 내면 **결함까지 함께 되살아난다** — `onLayout` 은 레이아웃 *뒤*에 오는 비동기
  // 통보라 "같은 커밋에 갱신"이 원리적으로 불가능하고, 그것이 [[ADR-085]] 결정 1 이 금지한
  // "첫 프레임에 spacer 0" 그 자체다.
  //
  // 지금 구조에서는 헤더가 흐름 안에 있어 맞출 대상이 없다. 그 사실을 **자식 수**로 고정한다 —
  // spacer 를 넣으면 여기가 빨개진다.
  it('spacer 를 두지 않는다 — 헤더가 흐름 안에 있어 맞출 대상이 없다', async () => {
    const { toJSON } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const header = findByTestID(toJSON(), 'page-header')
    // 내용 래퍼 + 페이드 둘뿐이다(배경 조각은 이 테마에서 안 나온다). spacer 도, 그것을 감싸는
    // 래퍼 `<div>` 도 없다.
    expect(header?.children).toHaveLength(2)
  })

  it('children 을 gap-4 래퍼 안에 넣는다 (웹 `space-y-4` 의 짝)', async () => {
    const { getByText, toJSON } = await renderOverlay(
      <PageHeader>
        <Text>컨텐츠 스케줄러</Text>
      </PageHeader>,
    )

    expect(getByText('컨텐츠 스케줄러')).toBeTruthy()
    const header = findByTestID(toJSON(), 'page-header')
    expect(flattenStyle((header?.children[0] as TreeNode).props.style)).toMatchObject({ columnGap: 16, rowGap: 16 })
  })

  // 헤더는 스크롤 뷰의 **앞** 형제라, 순서만으로는 뒤에 오는 스크롤 뷰가 위에 그려진다. 이 값이
  // 없으면 페이드와 당김 인디케이터가 목록 **밑에** 깔려 조용히 사라진다.
  it('목록 위에 그려지도록 zIndex 를 갖는다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(flattenStyle(getByTestId('page-header').props.style).zIndex).toBe(10)
  })
})

describe('경계 페이드', () => {
  it('헤더 바로 아래 32px 띠에 겹쳐 그리고 터치를 가로채지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const fade = getByTestId('page-header-fade', HIDDEN)
    expect(flattenStyle(fade.props.style)).toMatchObject({
      position: 'absolute',
      top: '100%',
      height: 32,
    })
    expect(fade.props.pointerEvents).toBe('none')
  })

  // 웹은 색 그라데이션 위에 같은 방향 마스크를 겹쳐 알파가 **(1−t)²** 였다. RN 에는 마스크가 없어
  // 그 결과를 정지점으로 직접 적는다 — 선형 두 정지점으로 줄이면 경계가 더 또렷해진다.
  //
  // 기대값을 상수로 베끼지 않고 정지점 위치에서 **계산해** 대조한다 — 그래야 이 테스트가 값이
  // 아니라 프로파일을 지킨다.
  it('알파 램프가 웹의 그라데이션 × 마스크와 같은 (1−t)² 프로파일이다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const fade = getByTestId('page-header-fade', HIDDEN)
    const locations = fade.props.locations as number[]
    expect(locations).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(alphaBytesOf(fade.props.colors as number[])).toEqual(
      locations.map((t) => Math.round(255 * (1 - t) ** 2)),
    )
  })

  // 끝 색이 `transparent`(투명 **검정**)이면 네이티브 그라데이션 보간에서 중간이 어두워진다.
  // 같은 색의 알파만 움직이면 그 차이가 생길 자리가 없다.
  it('정지점이 전부 테마 `bg` 의 알파 변주다 — 투명 검정으로 끝내지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const rgb = rgbHexesOf(getByTestId('page-header-fade', HIDDEN).props.colors as number[])
    expect(rgb).toEqual(Array(5).fill(기본테마.bg.toUpperCase()))
  })

  it('테마가 바뀌면 페이드 색도 따라간다', async () => {
    const 검은마법사 = getThemeDefinition('검은마법사')
    rnThemeAppearancePort.apply('검은마법사', 검은마법사)
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const rgb = rgbHexesOf(getByTestId('page-header-fade', HIDDEN).props.colors as number[])
    expect(rgb).toEqual(Array(5).fill(검은마법사.bg.toUpperCase()))
    expect(검은마법사.bg).not.toBe(기본테마.bg)
  })

  // [[ADR-123]] 회귀 가드. 웹에서 이 처방이 나온 이유(합성 레이어의 배경 스냅샷이 iOS WKWebView 에서
  // 갱신되지 않아 잔상이 남았다)는 RN 에 없지만, 되붙일 방법도 없다는 것이 그 결정을 **구조로**
  // 지킨다. 나중에 블러 라이브러리를 이 자리에 얹으면 같은 계열의 문제를 새로 들이는 것이다.
  it('블러를 얹지 않는다 (iOS 잔상, [[ADR-123]])', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const style = flattenStyle(getByTestId('page-header-fade', HIDDEN).props.style)
    expect(style.backdropFilter).toBeUndefined()
    expect(style.experimental_backgroundImage).toBeUndefined()
  })
})

describe('below 슬롯', () => {
  // 당겨서 새로고침 인디케이터는 `absolute inset-x-0 top-full` 이라 이 셸이 기준 상자여야 한다.
  // children 에 섞으면 `gap-4` 안으로 들어가 흐름 자식이 되어 위치가 완전히 달라진다.
  it('below 는 페이드 뒤, 셸의 마지막 자식으로 놓인다', async () => {
    const { toJSON } = await renderOverlay(
      <PageHeader below={<View testID="ptr" />}>{내용}</PageHeader>,
    )

    const header = findByTestID(toJSON(), 'page-header')
    const last = header?.children.at(-1) as TreeNode
    expect(last.props.testID).toBe('ptr')
  })

  it('below 를 안 주면 페이드가 마지막이다 — 아무것도 더 그리지 않는다', async () => {
    const { toJSON } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const header = findByTestID(toJSON(), 'page-header')
    const last = header?.children.at(-1) as TreeNode
    expect(last.props.testID).toBe('page-header-fade')
  })
})

describe('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', () => {
  it('기본 테마 · 헤더 + 당김 인디케이터 자리', async () => {
    expect(
      (
        await renderOverlay(
          <PageHeader below={<View testID="ptr" />}>
            <Text>컨텐츠 스케줄러</Text>
          </PageHeader>,
        )
      ).toJSON(),
    ).toMatchSnapshot()
  })
})

/**
 * `LinearGradient` 는 `colors` 를 **ARGB 정수**로 정규화해 넘긴다(`processColor`) — 문자열 그대로
 * 비교할 수 없다. 두 축(색·알파)을 갈라 읽어야 단언이 무엇을 지키는지 읽힌다.
 */
function rgbHexesOf(colors: number[]): string[] {
  return colors.map((argb) => `#${(argb & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`)
}

function alphaBytesOf(colors: number[]): number[] {
  return colors.map((argb) => argb >>> 24)
}

interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
}

/**
 * `toJSON()` 결과에서 `testID` 로 노드를 찾는다.
 *
 * RNTL 의 `getByTestId` 를 쓰지 않는 이유는 **자식 목록**을 보기 때문이다 — 그쪽이 돌려주는
 * 엘리먼트는 React 트리(내부 컴포넌트 포함)라 자식 수가 호스트 뷰 수와 다르다. 이 파일의 여러
 * 단언이 "자식이 몇 개인가·마지막이 무엇인가"라서 호스트 트리를 직접 봐야 한다.
 */
function findByTestID(node: unknown, testID: string): TreeNode | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestID(child, testID)
      if (found !== null) return found
    }
    return null
  }
  if (node === null || typeof node !== 'object') return null

  const current = node as TreeNode
  if (current.props?.testID === testID) return current
  return findByTestID(current.children, testID)
}
