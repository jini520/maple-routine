// 화면 스크롤 셸. 지키는 것은 **"박스가 실제로 보이는 영역과 같다"** 이고
// (인디케이터가 노치를 침범하거나 탭바 뒤로 사라지는 것은 둘 다 실기기에서 관측된 회귀다) 여기서도
// 같은 것을 지킨다. 표현만 클래스 문자열에서 값으로 바뀐다.
//
// | 전 | 지금 |
// |---|---|
// | `fixed inset-x-0` + `overflow-y-auto` | `ScrollView` 자체가 스크롤포트다 |
// | `top-[var(--sa-top)]` + 안쪽 `-mt` | **헤더가 안전영역을 먹는다**. 헤더가 없을 때만 이 셸이 |
// | `bottom-[var(--tab-bar-h)]` | 탭 내비게이터가 이미 뺀 상자를 준다(`bottom-inset.ts`) |
// | `overscroll-y-none` | **안 옮긴다**. 러버밴드는 원하는 동작이다 |
// | 배경색 없음 | 그대로 검사한다 |
//
// 하단 인셋의 판정 자체는 `bottom-inset.test.ts` 가 본다. 여기서는 그 결과가 **콘텐츠 패딩이 아니라
// 상자 마진**으로 들어가는지를 본다. 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려지므로
// 그 구분이 곧 이 실기기에서 잡은 회귀다.

import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { act, within } from '@testing-library/react-native'
import { Dimensions, Text, View } from 'react-native'
import { NavigationRouteContext } from '@react-navigation/native'
import { createRef } from 'react'
import type { ScrollView as ScrollViewType } from 'react-native'
import type { Metrics } from 'react-native-safe-area-context'

import {
  __resetScrollToTopForTest,
  scrollPageToTop,
} from '../../../../navigation/scroll-to-top'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { rnThemeAppearancePort } from '../../../../native/adapters/rn-theme-appearance'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { resolveBottomBarMetrics } from '../../../../lib/bottom-bar-metrics'

/**
 * 바가 먹는 몫은 **창 폭의 함수**다. 여기서 숫자를 적지 않고 같은 함수를
 * 부르는 것이 이 파일이 지키는 것이다. 셸이 창 폭을 안 보면 이 값이 안 맞는다.
 */
const 바_몫 = resolveBottomBarMetrics(Dimensions.get('window').width).spacePx
import { ScreenScroll } from '../ScreenScroll'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

const 목록 = <Text>목록</Text>

describe('ScreenScroll', () => {
  it('화면을 채우는 스크롤 상자다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    // NativeWind 의 `flex-1` 은 축약형이 아니라 세 값으로 풀린다.
    expect(flattenStyle(getByTestId('screen-scroll').props.style)).toMatchObject({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '0%',
    })
  })

  // 헤더와 콘텐츠 사이, 그리고 콘텐츠 블록끼리의 간격을 **이 한 값**이 낸다(사용자 지정 8).
  //
  // NativeWind 는 `contentContainerClassName` 을 자식 뷰가 아니라 `contentContainerStyle`
  // 프롭으로 컴파일해 명시 스타일과 합친다. 그래서 렌더 트리를 훑으면 이 값이 안 보인다.
  it('콘텐츠 간격을 gap-2 로 준다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(flattenStyle(getByTestId('screen-scroll').props.contentContainerStyle)).toMatchObject({
      columnGap: 8,
      rowGap: 8,
    })
  })

// 불투명 배경은 테마 배경 이미지(백드롭)를 통째로 가린다. 앱 루트의 `bg-bg` 를
  // 빼야 했던 것과 같은 자리다.
  it('배경색을 칠하지 않는다', async () => {
    rnThemeAppearancePort.apply('혼테일', getThemeDefinition('혼테일'))
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(flattenStyle(getByTestId('screen-scroll').props.style).backgroundColor).toBeUndefined()
  })

  // 실기기 확인 항목이 *"모멘텀·러버밴드가 문서 스크롤과 동등한가"* 였다.
// `bounces={false}` 로 두면 플랫폼이 주는 되튐을 우리가 없애는 셈이 된다
  // (그 선언이 막던 스크롤 체이닝은 RN 에 문서가 없어 일어날 수 없다).
  it('네이티브 러버밴드를 끄지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(getByTestId('screen-scroll').props.bounces).toBeUndefined()
    expect(getByTestId('screen-scroll').props.overScrollMode).toBeUndefined()
  })
})

describe('스크롤 인디케이터 색', () => {
// 안 걸면 라이트 테마에 흰 인디케이터가 나온다(실기기). RN 기본값
  // `'default'` 도 같은 종류의 실패다. OS 설정을 따라가지 우리 테마를 따라가지 않는다.
  it.each([
    ['머쉬맘', 'black'],
    ['검은마법사', 'white'],
  ] as const)('%s 테마는 %s 인디케이터', async (theme, expected) => {
    rnThemeAppearancePort.apply(theme, getThemeDefinition(theme))

    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(getByTestId('screen-scroll').props.indicatorStyle).toBe(expected)
  })
})

describe('상단 안전영역. 헤더가 있으면 헤더가 먹는다', () => {
// 스크롤포트를 내리고 안쪽 래퍼의 `-mt` 로 되돌리면 그 음수 마진이 `fixed` 헤더의 spacer 와
  // 그만큼을 흡수해 주기 때문에 성립하는 트릭이었다. RN 에서 헤더는 스크롤 뷰의 **첫 자식**이라
  // 자기 패딩으로 노치를 직접 먹고, 굴리면 그 패딩째 올라간다. 되돌릴 것이 없다.
  it('헤더를 주면 상자를 내리지 않는다 (두 번 비우지 않는다)', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    expect(getByTestId('header')).toBeTruthy()
    expect(flattenStyle(getByTestId('screen-scroll').props.style).marginTop).toBe(0)
  })

  // 헤더 없는 화면(설정 계열). **콘텐츠 패딩이 아니라 상자**여야 한다. 패딩으로 밀면 글자는
  // 내려가도 인디케이터는 노치까지 올라간다.
  it('헤더가 없으면 이 셸이 상자를 안전영역만큼 내린다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    const scroller = getByTestId('screen-scroll')
    expect(flattenStyle(scroller.props.style).marginTop).toBe(테스트_안전영역.insets.top)
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingTop).toBeUndefined()
  })
})

describe('하단 인셋이 들어가는 자리', () => {
  // 판정은 `bottom-inset.ts` 가 하고, 여기서 보는 것은 **어느 프롭으로 나가는가** 다.
  // 기본 플랫폼(jest-expo = iOS)에서 하위 페이지는 "지나가도 되는" 쪽이라 콘텐츠 여백으로 간다.
  it('하위 페이지(hasTabBar=false)의 통과 인셋은 콘텐츠 여백이다. 스크롤 높이가 그만큼 는다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll hasTabBar={false}>{목록}</ScreenScroll>,
    )

    const scroller = getByTestId('screen-scroll')
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(
      테스트_안전영역.insets.bottom,
    )
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(0)
  })

  // 탭 화면의 바는 **떠 있다**. 콘텐츠가 그 아래로 지나가므로 스크롤포트는
  // 그대로 두고(`marginBottom` 0) 콘텐츠 끝에 **바의 몫 + 안전영역** 을 남긴다. 스크롤포트를 줄이면
  // 떠 있는 의미가 사라진다(그냥 화면이 작아진다).
  it('탭 화면(기본값)은 떠 있는 바의 몫을 콘텐츠 끝에 남긴다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    const scroller = getByTestId('screen-scroll')
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(0)
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(
      테스트_안전영역.insets.bottom + 바_몫,
    )
  })
})

// 회귀 가드. 헤더는 스크롤 뷰 안에 있다.
//
// 스크롤 뷰의 형제면 영원히 화면에 붙어 있다. 고정을 푸는 정책이라 안으로 들어왔는데, 이
// 차이는 렌더 트리에서만 보이고 화면에서는 굴려 봐야 안다. 스크롤 0 에서는 두 배치가 똑같이
// 생겼다. 그래서 위치를 트리로 고정한다.
describe(' 헤더도 함께 스크롤된다', () => {
  it('헤더가 스크롤 뷰의 자식이다. 형제로 되돌리면 다시 고정된다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    // `screen-scroll` 아래에서 찾을 수 있으면 자식이다. 형제였다면 못 찾는다.
    expect(within(getByTestId('screen-scroll')).getByTestId('header')).toBeTruthy()
  })
})

// ★ 당김 인디케이터는 스크롤포트 **위** 가 아니라 **안** 에 그려진다.
//
// 그래서 위 페이드가 그것도 **함께 깎는다**. 사용자가 당기면 자리는 열리는데 그 자리에 아무것도
// 안 보이고, 자동 조회로 열렸을 때는 **상단에 빈 띠** 로 보인다. 페이드
// 높이만큼 내려 구간 밖에서 돌게 한다.
describe(' 당김 인디케이터는 페이드 구간 아래에서 돈다', () => {
  const 재조회 = () => Promise.resolve()

  it('상단을 깎는 화면에서는 그 높이만큼 내린다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />} onRefresh={재조회}>
        {목록}
      </ScreenScroll>,
    )

    expect(getByTestId('screen-scroll').props.refreshControl.props.progressViewOffset).toBe(
      테스트_안전영역.insets.top,
    )
  })

  // 헤더가 없는 화면은 셸이 상자를 내려서 안전영역을 먹으므로 위를 안 깎는다. 깎지 않으면
  // 인디케이터가 가려질 일도 없고, 그래도 내리면 그만큼 엉뚱하게 낮은 자리에서 돈다.
  it('상단을 안 깎는 화면에서는 안 내린다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll onRefresh={재조회}>{목록}</ScreenScroll>,
    )

    expect(getByTestId('screen-scroll').props.refreshControl.props.progressViewOffset).toBeUndefined()
  })
})

// ★ 당김 배선은 **셸이 갖는다**. 화면은 자기 재조회 함수만 준다.
//
// 화면마다 조립하면 같은 여덟 줄이 다섯 벌이 되고, 그중 하나가 테마 색을 빠뜨려도 아무도 모른다.
// 내비게이터로 올릴 수는 없다. `RefreshControl` 은 컴포넌트가 아니라 `ScrollView` 의 프롭이라
// 스크롤 컨테이너가 있는 자리에만 산다.
describe('당김 배선', () => {
  it('함수를 주면 셸이 인디케이터를 만든다', async () => {
    const 테마 = getThemeDefinition('혼테일')
    rnThemeAppearancePort.apply('혼테일', 테마)
    const { getByTestId } = await renderOverlay(
      <ScreenScroll onRefresh={() => Promise.resolve()}>{목록}</ScreenScroll>,
    )

    const control = getByTestId('screen-scroll').props.refreshControl
    expect(control).toBeTruthy()
    // 색은 테마에서 온다. 화면이 넘기지 않는다.
    expect(control.props.tintColor).toBe(테마.primaryInk)
    expect(control.props.progressBackgroundColor).toBe(테마.surface)
  })

  // 안 주면 당김이 없는 화면이다(설정 계열·하위 페이지). 그 화면의 스크롤 뷰 프롭을 한 개도
  // 바꾸지 않는다.
  it('안 주면 인디케이터 자체가 없다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(getByTestId('screen-scroll').props.refreshControl).toBeUndefined()
  })

  // **당긴 회차에만** 돈다. 그 판정은 `usePullRefresh` 가 들고 셸이 그것을 부른다. 화면이
  // 직접 부르면 다섯 곳이 같은 실수를 할 수 있는 자리가 다섯 개 남는다.
  it('처음에는 안 돈다. 당겨야 돈다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll onRefresh={() => Promise.resolve()}>{목록}</ScreenScroll>,
    )

    expect(getByTestId('screen-scroll').props.refreshControl.props.refreshing).toBe(false)
  })

  it('당기면 준 함수를 부른다', async () => {
    const 재조회 = jest.fn().mockResolvedValue(undefined)
    const { getByTestId } = await renderOverlay(
      <ScreenScroll onRefresh={재조회}>{목록}</ScreenScroll>,
    )

    await act(async () => {
      getByTestId('screen-scroll').props.refreshControl.props.onRefresh()
    })

    expect(재조회).toHaveBeenCalledTimes(1)
  })
})

// ★ 안전영역 페이드. **덮는 것이 아니라 깎는 것**이다.
//
// 어디를 깎는지의 판정은 `safe-area-fade.test.ts` 가 본다. 여기서는 그 값이 **실제로 마스크로
// 나가는지**와, 이 결정의 핵심인 **스크림이 아니다** 가 지켜지는지를 본다. 마스크를 배경색
// 그라디언트로 바꿔도 화면은 그럴듯해 보이지만(벽지 없는 테마 넷에서는 구분도 안 된다) 벽지
// 테마에서는 이 걷어낸 띠가 정지 상태로 돌아온다.
describe(' 안전영역 페이드', () => {
  const 인셋없는_기기: Metrics = {
    frame: { x: 0, y: 0, width: 360, height: 640 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  }

  // 하단이 안전영역 위로 올라간다. 안전영역까지만 깎으면 콘텐츠가 선명한 채로 캡슐 밑에
  // 들어가고 녹는 것은 이미 바가 가린 뒤가 된다. 올리는 양은 바 몫의 절반이다. 전부 올리면
  // 너무 높다.
  it('헤더가 있는 탭 화면은 위아래를 둘 다 깎는다. 하단은 바의 절반까지', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    expect(flattenStyle(getByTestId('screen-fade-top').props.style).height).toBe(
      테스트_안전영역.insets.top,
    )
    expect(flattenStyle(getByTestId('screen-fade-bottom').props.style).height).toBe(
      테스트_안전영역.insets.bottom + 바_몫 / 2,
    )
  })

  // 하위 페이지에는 바가 없다. 늘어난 것은 바가 가리는 몫뿐이라 여기서는 그대로다.
  it('하위 페이지의 하단은 안전영역까지다. 바가 없으니 올라갈 몫도 없다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll hasTabBar={false} header={<View testID="header" />}>
        {목록}
      </ScreenScroll>,
    )

    expect(flattenStyle(getByTestId('screen-fade-bottom').props.style).height).toBe(
      테스트_안전영역.insets.bottom,
    )
  })

  // 설정 계열. 셸이 스크롤포트를 내렸으므로 그 자리에 올 콘텐츠가 없다. 그래도 깎으면 **콘텐츠의
  // 첫 줄**이 흐려진다.
  it('헤더가 없으면 상단은 깎지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(queryByTestId('screen-fade-top')).toBeNull()
    expect(queryByTestId('screen-fade-bottom')).not.toBeNull()
  })

  // 마스킹은 오프스크린 합성이라 공짜가 아니다. 겹치는 것이 없으면 안 건다. 그 없음 은
  // 안전영역도 바도 없을 때다(인셋 0 + 하위 페이지).
  it('겹치는 것이 없으면 마스크를 아예 걸지 않는다', async () => {
    const { queryByTestId, getByText } = await renderOverlay(
      <ScreenScroll hasTabBar={false}>{목록}</ScreenScroll>,
      인셋없는_기기,
    )

    expect(queryByTestId('screen-fade')).toBeNull()
    expect(getByText('목록')).toBeTruthy()
  })

  // 마스크는 알파만 나른다. 색이 하나라도 검정이 아니면 그것은 콘텐츠를 깎는 것이 아니라
  // 화면을 덮는 스크림이고, 벽지 위에 띠를 만든다.
  it('마스크가 나르는 것은 검정의 알파뿐이다. 배경색 스크림이 아니다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    for (const testID of ['screen-fade-top', 'screen-fade-bottom']) {
      const colors = getByTestId(testID).props.colors as number[]
      // 네이티브 정수는 ARGB 다. 하위 24비트(=RGB)가 전부 0이어야 **검정의 알파** 다.
      expect(colors.map((color) => color & 0x00ffffff)).toEqual(colors.map(() => 0))
    }
  })

  // 방향이 뒤집히면 **정확히 반대**가 된다. 화면 끝이 불투명하고 안쪽이 투명해져, 콘텐츠가
  // 상태바 밑에서 선명하고 목록 한가운데가 사라진다.
  it('화면 끝이 알파 0이다. 위는 올라가고 아래는 내려간다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    const alphasOf = (testID: string): number[] =>
      (getByTestId(testID).props.colors as number[]).map((color) => (color >>> 24) & 0xff)

    const top = alphasOf('screen-fade-top')
    expect(top[0]).toBe(0)
    expect(top[top.length - 1]).toBe(255)

    const bottom = alphasOf('screen-fade-bottom')
    expect(bottom[0]).toBe(255)
    expect(bottom[bottom.length - 1]).toBe(0)
  })

  // 마스크 상자는 스크롤포트와 같은 상자여야 한다. 마스크가 화면을 덮고 스크롤 뷰가 그 안에
  // 있어야 페이드 구간이 안전영역과 맞는다. 둘이 어긋나면 페이드가 엉뚱한 자리에 뜬다.
  it('스크롤 뷰가 마스크 **안**에 있다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    expect(within(getByTestId('screen-fade')).getByTestId('screen-scroll')).toBeTruthy()
  })
})

// 최상단 이동의 과녁을 등록하는 자리가 이 셸 하나다. 탭 화면 여덟이 전부 이것을 쓰므로
// 화면마다 배선하면 같은 다섯 줄이 여덟 벌이 되고, 그중 하나가 빠져도 그 탭에서만 조용히
// 안 먹는다.
//
// 화면이 준 `ref` 도 함께 산다. 셸이 자기 참조를 하나 더 들면서 화면 것을 덮으면, 보스 수익의
// 기간 이동이 스크롤을 못 되돌린다.
describe('최상단 이동 과녁', () => {
  beforeEach(__resetScrollToTopForTest)

  it('라우트 안에서 렌더하면 그 이름으로 등록한다. 화면이 준 ref 도 산다', async () => {
    const ref = createRef<ScrollViewType>()
    await renderOverlay(
      <NavigationRouteContext.Provider value={{ key: 'Today-1', name: 'Today' }}>
        <ScreenScroll ref={ref}>{목록}</ScreenScroll>
      </NavigationRouteContext.Provider>,
    )
    const scroller = ref.current
    if (scroller === null) throw new Error('화면이 준 ref 가 스크롤 뷰에 닿지 않았다')
    const scrollTo = jest.spyOn(scroller, 'scrollTo').mockImplementation(() => undefined)

    scrollPageToTop('Today')

    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true })
  })

  // 내비게이터 없이 렌더하는 테스트가 이 파일에만 열이 넘는다. 라우트를 못 읽는다고 던지면
  // 그 전부가 빨개진다.
  it('내비게이터 밖에서는 아무것도 등록하지 않는다', async () => {
    await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(() => {
      scrollPageToTop('Today')
    }).not.toThrow()
  })
})
