// 화면 스크롤 셸([[ADR-099]]). 웹판 테스트가 지키던 것은 **"박스가 실제로 보이는 영역과 같다"** 였고
// (인디케이터가 노치를 침범하거나 탭바 뒤로 사라지는 것은 둘 다 실기기에서 관측된 회귀다) 여기서도
// 같은 것을 지킨다 — 표현만 클래스 문자열에서 값으로 바뀐다.
//
// | 웹판 | 여기 |
// |---|---|
// | `fixed inset-x-0` + `overflow-y-auto` | `ScrollView` 자체가 스크롤포트다 |
// | `top-[var(--sa-top)]` + 안쪽 `-mt` | **헤더가 안전영역을 먹는다** — 헤더가 없을 때만 이 셸이 |
// | `bottom-[var(--tab-bar-h)]` | 탭 내비게이터가 이미 뺀 상자를 준다(`bottom-inset.ts`) |
// | `overscroll-y-none` | **안 옮긴다** — 러버밴드는 원하는 동작이다([[ADR-099]] 결정 3) |
// | 배경색 없음 | 그대로 검사한다([[ADR-088]]) |
//
// 하단 인셋의 판정 자체는 `bottom-inset.test.ts` 가 본다. 여기서는 그 결과가 **콘텐츠 패딩이 아니라
// 상자 마진**으로 들어가는지를 본다 — 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려지므로
// 그 구분이 곧 [[ADR-099]] 결정 6 이 실기기에서 잡은 회귀다.

import { getThemeDefinition } from '@core/lib/theme-registry'
import { Text, View } from 'react-native'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { rnThemeAppearancePort } from '../../../../native/adapters/rn-theme-appearance'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
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

  it('콘텐츠 간격을 gap-4 로 준다 (웹 안쪽 래퍼의 `space-y-4` 짝)', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(flattenStyle(getByTestId('screen-scroll').props.contentContainerStyle)).toMatchObject({
      columnGap: 16,
      rowGap: 16,
    })
  })

  // [[ADR-088]] — 불투명 배경은 테마 배경 이미지(백드롭)를 통째로 가린다. 웹에서 앱 루트의 `bg-bg` 를
  // 빼야 했던 것과 같은 자리다.
  it('배경색을 칠하지 않는다', async () => {
    rnThemeAppearancePort.apply('혼테일', getThemeDefinition('혼테일'))
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(flattenStyle(getByTestId('screen-scroll').props.style).backgroundColor).toBeUndefined()
  })

  // [[ADR-099]] 결정 3 — 실기기 확인 항목이 *"모멘텀·러버밴드가 문서 스크롤과 동등한가"* 였다.
  // 웹의 `overscroll-behavior-y: none` 을 `bounces={false}` 로 옮기면 그것을 우리가 없애는 셈이 된다
  // (그 선언이 막던 스크롤 체이닝은 RN 에 문서가 없어 일어날 수 없다).
  it('네이티브 러버밴드를 끄지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(getByTestId('screen-scroll').props.bounces).toBeUndefined()
    expect(getByTestId('screen-scroll').props.overScrollMode).toBeUndefined()
  })
})

describe('스크롤 인디케이터 색 ([[ADR-099]] 결정 5)', () => {
  // 웹에서 안 걸었을 때 라이트 테마에 흰 인디케이터가 나왔다(실기기 2026-08-06). RN 기본값
  // `'default'` 도 같은 종류의 실패다 — OS 설정을 따라가지 우리 테마를 따라가지 않는다.
  it.each([
    ['머쉬맘', 'black'],
    ['검은마법사', 'white'],
  ] as const)('%s 테마는 %s 인디케이터', async (theme, expected) => {
    rnThemeAppearancePort.apply(theme, getThemeDefinition(theme))

    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    expect(getByTestId('screen-scroll').props.indicatorStyle).toBe(expected)
  })
})

describe('상단 안전영역 — 헤더가 있으면 헤더가 먹는다', () => {
  // 웹은 스크롤포트를 내리고 안쪽 래퍼의 `-mt` 로 되돌렸는데, 그 음수 마진은 `fixed` 헤더의 spacer 가
  // 그만큼을 흡수해 주기 때문에 성립하는 트릭이었다. RN 에서 헤더는 스크롤 뷰의 형제라 자기 패딩으로
  // 노치를 직접 먹고, 스크롤포트는 그 아래에서 시작한다 — 되돌릴 것이 없다.
  it('헤더를 주면 상자를 내리지 않는다 (두 번 비우지 않는다)', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
    )

    expect(getByTestId('header')).toBeTruthy()
    expect(flattenStyle(getByTestId('screen-scroll').props.style).marginTop).toBe(0)
  })

  // 헤더 없는 화면(설정 계열). **콘텐츠 패딩이 아니라 상자**여야 한다 — 패딩으로 밀면 글자는
  // 내려가도 인디케이터는 노치까지 올라간다([[ADR-099]] 결정 6).
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
  it('하위 페이지(hasTabBar=false)의 통과 인셋은 콘텐츠 여백이다 — 스크롤 높이가 그만큼 는다', async () => {
    const { getByTestId } = await renderOverlay(
      <ScreenScroll hasTabBar={false}>{목록}</ScreenScroll>,
    )

    const scroller = getByTestId('screen-scroll')
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(
      테스트_안전영역.insets.bottom,
    )
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(0)
  })

  // 탭 화면은 탭 내비게이터가 이미 탭바를 뺀 상자를 준다 — 여기서 또 비우면 두 번 빼는 셈이다.
  it('탭 화면(기본값)은 하단을 비우지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<ScreenScroll>{목록}</ScreenScroll>)

    const scroller = getByTestId('screen-scroll')
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(0)
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(0)
  })
})

describe('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', () => {
  it('탭 화면 · 헤더 있음', async () => {
    expect(
      (
        await renderOverlay(
          <ScreenScroll header={<View testID="header" />}>{목록}</ScreenScroll>,
        )
      ).toJSON(),
    ).toMatchSnapshot()
  })

  it('하위 페이지 · 헤더 없음', async () => {
    expect(
      (await renderOverlay(<ScreenScroll hasTabBar={false}>{목록}</ScreenScroll>)).toJSON(),
    ).toMatchSnapshot()
  })
})
