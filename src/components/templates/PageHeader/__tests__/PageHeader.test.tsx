// 화면 상단 헤더 셸(4단계). 웹판 테스트가 지키던 것은 *"4화면이 복붙하던 마크업을 글자
// 하나까지 그대로 낸다"* 였는데, RN 에서는 그 마크업이 통째로 바뀌므로(`PageHeader.tsx` 파일 머리)
// 이 파일이 지키는 것도 갈린다.
//
// | 웹판이 지키던 것 | 여기서는 |
// |---|---|
// | 셸 클래스 문자열 동일 | **스냅샷 기준선**으로 대체(값 대조가 불가능하다) |
// | `fixed` 이지 `sticky` 가 아니다 | **스크롤 뷰 밖에 있다**. 위치가 스크롤의 함수가 아닌 것이 요점이고, RN 은 그것을 레이아웃으로 얻는다 |
// | spacer 가 실측 높이와 같은 커밋에 갱신된다 | **spacer 자체가 없다**. 아래 회귀 가드 |
// | 페이드에 `backdrop-filter` 가 없다 | **페이드째 걷어냈다**(아래). 검사할 대상이 없다 |
// | `below` 는 페이드 뒤, 셸의 마지막 자식 | `below` 가 마지막인 것만 검사한다 |
//
// 안전영역은 `renderOverlay` 가 넣는 실측 인셋(상 59)을 쓴다. 이 실측한 표와 같은 값이다.

import { Text, View } from 'react-native'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { PageHeader } from '../PageHeader'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

/** RN 은 벌거벗은 문자열을 View 자식으로 못 그린다. 웹판 테스트의 `내용` 자리. */
const 내용 = <Text>내용</Text>

/** 페이드는 `aria-hidden` 이라 RNTL 기본 쿼리에서 빠진다. */
const HIDDEN = { includeHiddenElements: true } as const

describe('PageHeader', () => {
  // ★ **딱 안전영역만큼이다.** 웹의 `pt-[calc(1rem+var(--sa-top))]` 에서 상수 몫
  // 1rem 을 뺐다: 그 16 은 불투명 헤더 판의 안쪽 여백이자 고정 헤더와 상태바의 분리였는데,
  // RN 헤더는 배경을 안 칠하고 고정도 아니라 둘 다 해당이 없다.
  // **`toBe` 로 못 박는 이유**는 이 값이 상단 페이드의 끝선과 **같은 선**이 됐기
  // 때문이다. 한쪽이 움직이면 제목이 갉히거나 띄워지고, 그 어긋남은 여기서만 보인다.
  it('상단 안전영역만큼만 자기 패딩으로 먹는다. 여백을 더하지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(flattenStyle(getByTestId('page-header').props.style).paddingTop).toBe(
      테스트_안전영역.insets.top,
    )
  })

  // ★ 회귀 가드. **헤더는 자기 배경을 칠하지 않는다.**
  //
  // 예전에는 여기서 헤더의 `backgroundColor` 가 테마 `bg` 인지 확인했다. 그때는 헤더가 불투명해야 했고
  // (화면에 고정돼 있었으므로) 그 위에 테마 배경 조각을 이어 그렸다.
  //  이 고정 영역을 없애면서 전제가 사라졌고, 남은 것은 벽지 위의 검은 띠였다.
  //
  // 배경 없는 테마에서는 **보이는 그림이 바뀌지 않는다**. 내비게이션 테마가 화면을 같은 `bg` 로
  // 칠하므로 뒤에 같은 색이 있다. 그래서 이 검사는 **색이 무엇인가** 가 아니라 **칠하지 않는가** 다.
  it('자기 배경을 칠하지 않는다. 배경은 벽지 한 장이 진다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(flattenStyle(getByTestId('page-header').props.style).backgroundColor).toBeUndefined()
  })

  // ★ 회귀 가드. **웹의 형태를 되살리지 말 것.**
  //
  // 웹에서 이 셸은 `fixed` + 실측 spacer 였고 는 그 spacer 가 헤더보다 한 프레임 늦게
  // 갱신되는 결함(이슈 #168, 약 90px)을 고치느라 measure/observe 두 effect 를 두었다. RN 에서
  // 그 형태를 흉내 내면 **결함까지 함께 되살아난다**. `onLayout` 은 레이아웃 *뒤*에 오는 비동기
  // 통보라 "같은 커밋에 갱신"이 원리적으로 불가능하고, 그것이 이 금지한
  // "첫 프레임에 spacer 0" 그 자체다.
  //
  // 지금 구조에서는 헤더가 흐름 안에 있어 맞출 대상이 없다. 그 사실을 **자식 수**로 고정한다.
  // spacer 를 넣으면 여기가 빨개진다.
  it('spacer 를 두지 않는다. 헤더가 흐름 안에 있어 맞출 대상이 없다', async () => {
    const { toJSON } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const header = findByTestID(toJSON(), 'page-header')
    // 내용 래퍼 **하나**뿐이다(배경 조각은 이 테마에서 안 나오고, 경계 페이드는 걷어냈다).
    // spacer 도, 그것을 감싸는 래퍼 `<div>` 도 없다.
    expect(header?.children).toHaveLength(1)
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

// **경계 페이드는 걷어냈다**(2026-08-13, 사용자 판정. 실기기에서 띠가 엉뚱한 자리에 보였고
// 제거 승인). 예전에는 이 자리에 여섯 케이스(위치·알파 프로파일·색 파생·테마 추종
// 블러 금지)가 있었고, 전부 **그 띠가 있다** 를 전제로 했다.
//
// 남기는 것은 **없다는 사실 하나**다. 되살릴 때 지켜야 할 값(알파 (1−t)² 프로파일 · 테마 `bg`
// 알파 변주 · 블러 금지)은 **웹 원본**에 그대로 있고, 되살릴 조건은 컴포넌트 주석에 적어 뒀다.
//  의 중첩 sticky 가 먼저다.
describe('경계 페이드', () => {
  it('그리지 않는다. 되살리려면 중첩 sticky 가 먼저다', async () => {
    const { queryByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(queryByTestId('page-header-fade', HIDDEN)).toBeNull()
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

  // 페이드를 걷어낸 뒤로 `below` 가 없으면 **내용이 곧 마지막**이다(예전엔 페이드가 그 자리였다).
  it('below 를 안 주면 내용이 마지막이다. 아무것도 더 그리지 않는다', async () => {
    const { toJSON } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const header = findByTestID(toJSON(), 'page-header')
    const last = header?.children.at(-1) as TreeNode
    expect(last.props.testID).not.toBe('ptr')
    expect(last.props.testID).not.toBe('page-header-fade')
  })
})

interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
}

/**
 * `toJSON()` 결과에서 `testID` 로 노드를 찾는다.
 *
 * RNTL 의 `getByTestId` 를 쓰지 않는 이유는 **자식 목록**을 보기 때문이다. 그쪽이 돌려주는
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
