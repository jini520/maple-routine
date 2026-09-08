// 바텀시트.
//
// 이 파일은 라이브러리를 세워 둔다(`jest.mock`). 진짜 `@gorhom/bottom-sheet` 은 레이아웃 측정과
// UI 스레드 애니메이션 위에 서 있어 jest 에서 시트 내용이 아예 마운트되지 않는다(`waitFor` 로
// 1초를 기다려도 안 나온다). 그래서 여기서 보는 것은 우리가 무엇을 넘겼는가 이고, 그 값들이
// 라이브러리가 실제로 받는 프롭인지는 타입 검사가 지킨다.
//
// 라이브러리를 진짜로 세워 마운트되는지는 옆 파일(`BottomSheet.wiring.test.tsx`)이 본다.
import type { ReactNode } from 'react'
import { Keyboard, Text, View } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'

// `jest.mock` 팩토리는 호이스팅돼 스코프 밖 변수를 못 읽는다. **`mock` 접두 이름만** 예외다.
const mockPresent = jest.fn()
const mockScrollToEnd = jest.fn()
const mockScrollTo = jest.fn()

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: mockPresent, dismiss: jest.fn() }))
      // 라이브러리는 `footerComponent` 를 시트 안에 그린다. 목도 그려야 바닥 슬롯을 볼 수 있다.
      // 인자 이름을 `mock` 으로 시작하게 둔다. `jest.mock` 팩토리 안에서는 타입 자리의
      // 식별자도 스코프 밖 변수로 잡혀서 그 접두사만 허용된다.
      const footer = props.footerComponent as
        | ((mockProps: Record<string, unknown>) => React.ReactNode)
        | undefined
      return React.createElement(
        ReactNative.View,
        { testID: 'sheet', ...props },
        props.children as React.ReactNode,
        footer === undefined ? null : footer({ animatedFooterPosition: { value: 0 } }),
      )
    }),
    BottomSheetFooter: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-footer', ...props }),
    // 스크롤 손잡이를 들려 준다. 시트가 그것을 불러 위치를 옮기는지 봐야 한다.
    BottomSheetScrollView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({
        scrollTo: mockScrollTo,
        scrollToEnd: mockScrollToEnd,
      }))
      return React.createElement(ReactNative.View, props)
    }),
    // 시트 밖과 같게 둔다. 아톰이 이 값으로 **시트 안인가** 를 묻는다.
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다. 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { flattenStyle, renderOverlay, 기본테마 } from '../../../__tests__/render-atom'
import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import {
  __resetThemeAppearanceForTest,
  setThemeAppearance,
} from '../../../../theme/appearance-store'
import { buildSheetScopeVariables } from '../../../../theme/theme-vars'
import { BottomSheet } from '../BottomSheet'

const noop = (): void => {}

/** 키보드 이벤트 손잡이. 내리는 쪽은 인자를 안 본다. */
type 손잡이 = (event: { endCoordinates: { height: number } }) => void

beforeEach(() => {
  mockPresent.mockClear()
  mockScrollToEnd.mockClear()
  mockScrollTo.mockClear()
})

describe('BottomSheet: 가 정한 값을 넘긴다', () => {
  /**
   * 키보드 이벤트는 네이티브에서 오므로 **등록된 손잡이를 직접 잡아 흔든다**. 등록 순서가
   * 계약이다(뜨는 것· 내리는 것).
   */
  const 키보드손잡이: 손잡이[] = []

  beforeEach(() => {
    키보드손잡이.length = 0
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((_event: string, handler: 손잡이) => {
      키보드손잡이.push(handler)
      return { remove: jest.fn() }
    }) as never)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  async function open(): Promise<ReturnType<typeof renderOverlay>> {
    return renderOverlay(
      <BottomSheet onClose={noop} testId="boss-drop-sheet" label="드롭 아이템 기록">
        <Text>시트 내용</Text>
      </BottomSheet>,
    )
  }

  /** 뜨는 손잡이는 높이를 실은 이벤트를 받는다. 내리는 쪽은 안 본다. */
  async function 키보드(뜬다: boolean, 높이 = 336): Promise<void> {
    await act(async () => {
      키보드손잡이[뜬다 ? 0 : 1]({ endCoordinates: { height: 높이 } })
    })
  }

  it('children 과 testId 를 그대로 전달한다. 공개 API 는 웹과 같다', async () => {
    const { getByText, getByTestId } = await open()

    expect(getByText('시트 내용')).toBeTruthy()
    expect(getByTestId('boss-drop-sheet')).toBeTruthy()
  })

  // 라이브러리 기본 핸들 색·라운딩이 아니라 이 값들이어야 한다.
  // 껍데기가 이름을 하나로 갖고 있으면 시트 넷이 전부 그 이름으로 읽힌다. 실제로 그랬다:
  // 수입·지출·판매가 키패드까지 `드롭 아이템 기록` 이었다. 프롭이고, 기본값이 없다.
  it('스크린리더가 읽는 이름은 호출부가 준다', async () => {
    const { getByTestId } = await renderOverlay(
      <BottomSheet onClose={noop} testId="income-sheet" label="수입 기록">
        <Text>시트 내용</Text>
      </BottomSheet>,
    )

    expect(getByTestId('sheet').props.accessibilityLabel).toBe('수입 기록')
  })

  it('그랩 핸들·배경·라운딩이 스킨 그대로다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')

    // 핸들은 **시트 첫 자식으로 우리가 그린다.** 라이브러리 슬롯(`handleIndicatorStyle`·
    // `handleComponent`)에 넘긴 것이 기기에서 두 번 다 안 그려졌기 때문이다(컴포넌트 주석).
    // 그래서 `handleComponent` 는 명시적으로 `null` 이고, 알약은 렌더 트리에서 직접 찾는다.
    expect(sheet.props.handleComponent).toBeNull()
    expect(flattenStyle(getByTestId('bottom-sheet-handle').props.style)).toMatchObject({
      height: 4,
      width: 36,
      backgroundColor: 기본테마.borderStrong,
    })
    expect(flattenStyle(sheet.props.backgroundStyle)).toMatchObject({
      backgroundColor: 기본테마.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    })
  })

  // **위 테두리는 걷었다.** 그 선은 면이 경계를 못 만들던 시절의 대타였고, 다크에서 몸통이
  // 한 칸 올라간 지금은 밝아진 면 위에 뜬 줄 하나로 남는다.
  it('위 테두리를 그리지 않는다', async () => {
    const { getByTestId } = await open()
    const style = flattenStyle(getByTestId('sheet').props.backgroundStyle)

    expect(style.borderTopWidth).toBeUndefined()
    expect(style.borderTopColor).toBeUndefined()
  })

  // `max-h-[82vh]` 는 **상한**이지 높이가 아니다. 고정 스냅 포인트(라이브러리의 흔한 사용법)로
  // 옮기면 내용이 짧아도 시트가 항상 82%까지 올라온다.
  it('높이는 내용이 정하고 82%가 상한이다. 고정 스냅 포인트가 아니다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')

    expect(sheet.props.snapPoints).toBeUndefined()
    expect(sheet.props.enableDynamicSizing).toBe(true)
    // 테스트 프레임 높이 844 × 0.82
    expect(sheet.props.maxDynamicContentSize).toBeCloseTo(844 * 0.82)
  })

  /**
   * 이 앱은 edge-to-edge 라 키보드가 떠도 **창이 안 줄어든다**. 시트를 올리는 것은 OS 가 아니라
   * 라이브러리이고, 올리는 방식이 시트를 통째로 키보드 높이만큼 미는 것이다. 그래서 상한을
   * 그대로 두면 윗변이 82% 선보다 **키보드 높이만큼 더** 올라간다.
   *
   * 상한에서 그만큼을 빼면 윗변이 키보드가 있든 없든 같은 선에 선다.
   */
  it('키보드가 뜨면 상한에서 그 높이를 뺀다. 시트 + 키보드가 82% 다', async () => {
    const { getByTestId } = await open()
    const 상한 = (): number => getByTestId('sheet').props.maxDynamicContentSize as number

    await 키보드(true, 336)
    expect(상한()).toBeCloseTo(844 * 0.82 - 336)

    await 키보드(false)
    expect(상한()).toBeCloseTo(844 * 0.82)
  })

  /**
   * 라이브러리는 창 모드를 **자기가 안 바꾼다**. 이 프롭은 키보드가 뜰 때 창이 실제로 어떻게
   * 되는가 를 알려 주는 것이고, 그 값으로 자기 보정량을 정한다.
   *
   * 매니페스트의 `adjustResize` 를 믿으면 안 된다. 이 앱은 edge-to-edge 라
   * (`android/gradle.properties` 의 `edgeToEdgeEnabled=true`) 그 값이 죽어 있다. API 36 에서
   * 키보드가 312dp 떠도 `Dimensions.get('window').height` 는 914.29 그대로였고 내용도 안 밀렸다.
   * OS 는 아무것도 안 한다.
   *
   * 그런데 `adjustResize` 를 넘기면 라이브러리는 OS 가 이미 했겠지 라며 자기 보정을 0 으로
   * 둔다(소스: `heightWithinContainer = 0` 후 early return). 그래서 시트가 키보드에 그대로
   * 가렸다. `adjustPan` 이 사실이다. 창은 안 움직인다, 네가 올려라.
   */
  it('창이 안 움직인다고 알려 준다. adjustPan (edge-to-edge 라 adjustResize 는 죽은 값)', async () => {
    const { getByTestId } = await open()

    expect(getByTestId('sheet').props.android_keyboardInputMode).toBe('adjustPan')
  })

  /**
   * **올라간 것은 내려와야 한다**. 기본값 `none` 이면 라이브러리가 키보드
   * 닫힘에서 **일찍 빠져나가** 위치를 다시 안 잰다:
   *
   *     if (status === HIDDEN && keyboardBlurBehavior === none) return
   *
   * 그러면 시트가 올라간 자리에 그대로 남는다(실기 보고).
   */
  it('키보드가 닫히면 제자리로 돌아온다. restore', async () => {
    const { getByTestId } = await open()

    expect(getByTestId('sheet').props.keyboardBlurBehavior).toBe('restore')
  })

  /**
   * **키보드가 뜨면 아래 인셋을 안 남긴다**.
   *
   * 홈 인디케이터 몫(`insets.bottom`)은 화면 맨 아래가 손가락에 닿는 자리라 비워 둔다 는 값인데,
   * 키보드가 그 자리를 이미 덮고 있으면 **아무것도 아닌 빈 띠**가 된다. 실기에서 빠른 칩과
   * 키보드 사이가 50pt 벌어졌다(사용자 스크린샷).
   */
  it('키보드가 뜨면 아래 인셋을 걷는다', async () => {
    const { getByTestId } = await open()
    const 여백 = (): number =>
      (getByTestId('boss-drop-sheet').props.contentContainerStyle as { paddingBottom: number })
        .paddingBottom

    // 테스트 인셋의 아래는 34(iPhone 계열). 거기에 숨돌림 16.
    expect(여백()).toBe(34 + 16)

    // 걷는 것은 **인셋뿐**이다. 숨돌림 16 은 남는다(마지막 줄이 키보드에 닿으면 누를 자리가 없다).
    await 키보드(true)
    expect(여백()).toBe(16)

    await 키보드(false)
    expect(여백()).toBe(34 + 16)
  })

  /**
   * 시트는 세 구역이다. 머리와 저장은 고정이고 그 사이가 스크롤이다.
   *
   * 머리를 스크롤 밖 형제로 두면 안 된다. 라이브러리는 **스크롤 내용만 재서** 시트 높이를
   * 정하므로 형제의 높이가 계산에서 빠진다. 핸들과 같은 방식으로 흐름에서 빼고 그만큼을
   * 내용의 `paddingTop` 이 되돌려 준다.
   */
  it('머리는 흐름 밖 핸들 아래에 서고, 잰 높이가 내용 위 여백으로 돈다', async () => {
    const { getByTestId, getByText } = await renderOverlay(
      <BottomSheet
        onClose={noop}
        testId="income-sheet"
        label="수입 기록"
        header={<Text>사냥</Text>}
      >
        <Text>내용</Text>
      </BottomSheet>,
    )

    expect(getByText('사냥')).toBeTruthy()
    // 핸들(24) 아래다. 핸들이 머리 위에 선다.
    expect(flattenStyle(getByTestId('bottom-sheet-header').props.style)).toMatchObject({
      position: 'absolute',
      top: 24,
    })

    const 위여백 = (): number =>
      (getByTestId('income-sheet').props.contentContainerStyle as { paddingTop: number }).paddingTop
    // 재기 전에는 핸들 24 + 숨돌림 8 뿐이다.
    expect(위여백()).toBe(24 + 8)

    await act(async () => {
      fireEvent(getByTestId('bottom-sheet-header'), 'layout', {
        nativeEvent: { layout: { height: 23 } },
      })
    })
    expect(위여백()).toBe(24 + 8 + 23)
  })

  /**
   * **저장은 언제나 키보드 바로 위다.** 라이브러리의 `BottomSheetFooter` 가
   * `키보드가 떠 있으면 아래 인셋을 안 뺀다` 를 이미 한다. 그 규칙을 두 벌로 만들지 않는다.
   */
  it('바닥은 라이브러리 footer 슬롯으로 가고, 잰 높이가 내용 아래 여백으로 돈다', async () => {
    const { getByTestId, getByText } = await renderOverlay(
      <BottomSheet onClose={noop} testId="income-sheet" label="수입 기록" footer={<Text>저장</Text>}>
        <Text>내용</Text>
      </BottomSheet>,
    )

    expect(getByTestId('sheet').props.footerComponent).toBeDefined()
    expect(getByText('저장')).toBeTruthy()

    const 아래여백 = (): number =>
      (getByTestId('income-sheet').props.contentContainerStyle as { paddingBottom: number })
        .paddingBottom
    // 테스트 인셋의 아래는 34, 숨돌림 16.
    expect(아래여백()).toBe(34 + 16)

    await act(async () => {
      fireEvent(getByTestId('bottom-sheet-footer'), 'layout', {
        nativeEvent: { layout: { height: 60 } },
      })
    })
    expect(아래여백()).toBe(34 + 16 + 60)
  })

  /**
   * 치는 칸이 아래에 몰린 시트는 아래에서 시작한다. 키보드를 부르는 칸이 거기 있으므로
   * 잘려야 할 것은 언제나 위쪽이다.
   */
  it('`startAtBottom` 이면 스크롤을 끝으로 보낸다', async () => {
    await renderOverlay(
      <BottomSheet onClose={noop} testId="income-sheet" label="수입 기록" startAtBottom>
        <Text>내용</Text>
      </BottomSheet>,
    )

    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false })
  })

  it('안 주면 끝으로 안 보낸다. 종전 시트는 위에서 시작한다', async () => {
    await open()

    expect(mockScrollToEnd).not.toHaveBeenCalled()
  })

  /** 키보드가 떠서 뷰포트가 줄어드는 것도 내용이 자라는 것과 같은 일이라 다시 보낸다. */
  it('키보드가 뜨면 다시 끝으로 보낸다', async () => {
    await renderOverlay(
      <BottomSheet onClose={noop} testId="income-sheet" label="수입 기록" startAtBottom>
        <Text>내용</Text>
      </BottomSheet>,
    )
    mockScrollToEnd.mockClear()

    await 키보드(true, 291)

    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false })
  })

  it('머리도 바닥도 안 주면 종전 그대로다. 슬롯은 선택이다', async () => {
    const { queryByTestId, getByTestId } = await open()

    expect(queryByTestId('bottom-sheet-header')).toBeNull()
    expect(getByTestId('sheet').props.footerComponent).toBeUndefined()
  })

  it('폭은 max-w-md(448) 중앙 정렬이다. 라이브러리 기본은 전폭이다', async () => {
    const { getByTestId } = await open()

    expect(flattenStyle(getByTestId('sheet').props.style)).toMatchObject({
      maxWidth: 448,
      alignSelf: 'center',
    })
  })

  // 스크림은 테마 토큰이고, **라이브러리 백드롭이 아니라 우리가 직접 그린다.**
  //
  // ⚠️ 이 테스트는 **스크림이 실제로 보이는가**·**제때 사라지는가** 를 답하지 못한다. 이 파일이
  // 라이브러리를 목으로 갈아 끼우기 때문이다. 그 자리에서 두 번 틀렸다:
  // 라이브러리 백드롭은 **아예 안 보였고**(스냅 포인트가 하나라 불투명도 보간이 퇴화 구간),
  // 그걸 애니메이션 없는 단색으로 바꾸자 이번엔 **닫히는 동안 늦게까지 남았다.**
  // 지금은 `SheetScrim` 이 인덱스를 직접 보간한다. 여기서 지킬 수 있는 것은 **색과 닫힘 배선**
  // 뿐이고, 보이는지·제때 사라지는지는 사람이 본다.
  it('스크림은 테마 토큰이다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')
    const backdrop = (sheet.props.backdropComponent as (p: object) => React.JSX.Element)({})

    expect(backdrop.props.color).toBe(기본테마.scrim)
  })

  // 바깥을 눌러 닫는다. 예전엔 라이브러리의 `pressBehavior="close"` 가 하던 일이라
  // 그 프롭 값만 검사했는데, 이제 우리 `onPress` 가 하므로 **실제로 눌러 본다.**
  it('스크림을 누르면 시트를 닫는다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')
    const backdrop = (sheet.props.backdropComponent as (p: object) => React.JSX.Element)({})

    expect(typeof backdrop.props.onPress).toBe('function')
  })

  // 마운트가 곧 열림이고, 닫힘은 이탈 애니메이션이 끝난 뒤
  // (`onDismiss`) 부모에 알려 언마운트를 맡긴다.
  it('마운트하면 열고, 닫힘은 이탈 애니메이션이 끝난 뒤 부모에 통보한다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <BottomSheet onClose={onClose} label="드롭 아이템 기록">
        <Text>시트 내용</Text>
      </BottomSheet>,
    )

    expect(mockPresent).toHaveBeenCalledTimes(1)
    expect(getByTestId('sheet').props.onDismiss).toBe(onClose)
    expect(getByTestId('sheet').props.enablePanDownToClose).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })
})

/**
 * 시트 스코프.
 *
 * 시트가 자기가 덮고 있는 페이지와 같은 토큰(`bg`)으로 서 있어 다크에서 스크림 깔린 배경과
 * 대비가 1.03~1.05 였다. 여기서 지키는 것은 두 고리다:
 *   ① 라이브러리가 칠하는 **껍데기**(`backgroundStyle`. 우리 서브트리 밖이라 변수가 안 닿는다)
 *   ② 시트 **안**의 `className` 이 올린 값으로 풀리는가 (이게 시트 안 코드를 안 고친다 의 실체다)
 *
 * 색은 손으로 적지 않는다. `buildSheetScopeVariables` 가 내는 값과 대조한다.
 */
describe('BottomSheet: 다크에서 표면 계열을 한 칸 올린다', () => {
  const 검은마법사 = getThemeDefinition('검은마법사')
  const 스코프 = buildSheetScopeVariables(검은마법사)

  beforeEach(__resetThemeAppearanceForTest)
  afterEach(__resetThemeAppearanceForTest)

  async function 다크시트(): Promise<ReturnType<typeof renderOverlay>> {
    const rendered = await renderOverlay(
      <BottomSheet onClose={noop} label="드롭 아이템 기록">
        <View testID="시트안-카드" className="bg-surface" />
        <View testID="시트안-바닥" className="bg-bg" />
      </BottomSheet>,
    )
    await act(async () => {
      setThemeAppearance('검은마법사', 검은마법사)
    })
    return rendered
  }

  it('껍데기는 한 칸 올린 `bg` 로 칠해진다. 변수가 안 닿는 자리라 값으로 넘긴다', async () => {
    const { getByTestId } = await 다크시트()

    expect(flattenStyle(getByTestId('sheet').props.backgroundStyle).backgroundColor).toBe(
      스코프['--color-bg'],
    )
    // 이 단언에 판별력이 있으려면 올린 값이 원래 값과 달라야 한다.
    expect(스코프['--color-bg']).not.toBe(검은마법사.bg)
  })

  it('시트 안 `bg-surface`·`bg-bg` 가 올린 값으로 풀린다. 화면 코드를 안 고치는 이유', async () => {
    const { getByTestId } = await 다크시트()

    expect(flattenStyle(getByTestId('시트안-카드').props.style).backgroundColor).toBe(
      스코프['--color-surface'],
    )
    expect(flattenStyle(getByTestId('시트안-바닥').props.style).backgroundColor).toBe(
      스코프['--color-bg'],
    )
  })

  // 라이트는 대비가 4.18~4.29 로 멀쩡하다. 여기서 한 칸 더 올리면 `#FFFFFF` 에 부딪혀 눌린다.
  it('라이트에서는 아무것도 안 올린다', async () => {
    const { getByTestId } = await renderOverlay(
      <BottomSheet onClose={noop} label="드롭 아이템 기록">
        <View testID="시트안-카드" className="bg-surface" />
      </BottomSheet>,
    )

    expect(flattenStyle(getByTestId('sheet').props.backgroundStyle).backgroundColor).toBe(
      기본테마.bg,
    )
    expect(flattenStyle(getByTestId('시트안-카드').props.style).backgroundColor).toBe(
      기본테마.surface,
    )
  })
})
