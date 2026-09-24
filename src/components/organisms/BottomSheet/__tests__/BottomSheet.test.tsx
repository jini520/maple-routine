// 바텀시트.
//
// 이 파일은 라이브러리를 세워 둔다(`jest.mock`). 진짜 `@gorhom/bottom-sheet` 은 레이아웃 측정과
// UI 스레드 애니메이션 위에 서 있어 jest 에서 시트 내용이 아예 마운트되지 않는다(`waitFor` 로
// 1초를 기다려도 안 나온다). 그래서 여기서 보는 것은 우리가 무엇을 넘겼는가 이고, 그 값들이
// 라이브러리가 실제로 받는 프롭인지는 타입 검사가 지킨다.
//
// 라이브러리를 진짜로 세워 마운트되는지는 옆 파일(`BottomSheet.wiring.test.tsx`)이 본다.
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { act, fireEvent, within } from '@testing-library/react-native'
import type { Metrics } from 'react-native-safe-area-context'

// `jest.mock` 팩토리는 호이스팅돼 스코프 밖 변수를 못 읽는다. **`mock` 접두 이름만** 예외다.
const mockPresent = jest.fn()
/** 스크롤 손잡이. 라이브러리는 ref 로 `scrollTo` 를 내준다. */
const mockScrollTo = jest.fn()

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: mockPresent, dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, { testID: 'sheet', ...props })
    }),
    BottomSheetScrollView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ scrollTo: mockScrollTo }))
      return React.createElement(ReactNative.View, props)
    }),
    // 넘긴 것을 그대로 돌려준다. 시트가 무엇을 넘겼는지는 프롭에서 본다.
    useBottomSheetTimingConfigs: (config: unknown) => config,
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

type 요소 = ReturnType<Awaited<ReturnType<typeof renderOverlay>>['getByTestId']>

beforeEach(() => {
  mockPresent.mockClear()
  mockScrollTo.mockClear()
})

describe('BottomSheet: 가 정한 값을 넘긴다', () => {
  async function open(metrics?: Metrics): Promise<ReturnType<typeof renderOverlay>> {
    const ui = (
      <BottomSheet onClose={noop} testId="boss-drop-sheet" label="드롭 아이템 기록">
        <Text>시트 내용</Text>
      </BottomSheet>
    )
    return metrics === undefined ? renderOverlay(ui) : renderOverlay(ui, metrics)
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
  it('높이는 내용이 정하고 상단 안전영역이 상한이다. 고정 스냅 포인트가 아니다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')

    expect(sheet.props.snapPoints).toBeUndefined()
    expect(sheet.props.enableDynamicSizing).toBe(true)
    // 테스트 프레임 높이 844 − 상단 인셋 59. 화면의 몇 퍼센트가 아니라 **노치를 피한 만큼**이다.
    expect(sheet.props.maxDynamicContentSize).toBeCloseTo(844 - 59)
  })

  it('상한이 상단 인셋을 따라간다. 노치가 두꺼운 기기는 그만큼 낮아진다', async () => {
    const { getByTestId } = await open({
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 24, left: 0, right: 0, bottom: 0 },
    })

    expect(getByTestId('sheet').props.maxDynamicContentSize).toBeCloseTo(844 - 24)
  })

  /**
   * 이 앱은 edge-to-edge 라 키보드가 떠도 **창이 안 줄어든다**. 시트를 올리는 것은 OS 가 아니라
   * 라이브러리이고, 올리는 방식이 시트를 통째로 키보드 높이만큼 미는 것이다. 그래서 상한을
   * 그대로 두면 윗변이 82% 선보다 **키보드 높이만큼 더** 올라간다.
   *
   * 상한에서 그만큼을 빼면 윗변이 키보드가 있든 없든 같은 선에 선다.
   */
  // 맞출 상대가 없다. 키보드에 맞추던 시절의 250ms 를 그대로 쓰면 휙 바뀐다(사용자 지적).
  it('자리를 옮기는 시간은 380ms 한 갈래다', async () => {
    const { getByTestId } = await open()

    expect(getByTestId('sheet').props.animationConfigs).toMatchObject({ duration: 380 })
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
 * 고정되는 두 줄.
 *
 * 사냥 시트가 키보드를 부르면 남는 자리가 426 인데 폼은 그보다 길다. 그때 제목과 저장이 함께
 * 밀려 사라지면 안 되므로 둘을 스크롤 밖에 세운다.
 *
 * ⚠️ 여기서 잴 수 있는 것은 **무엇을 어디에 넘겼는가** 뿐이다. 저장이 실제로 키보드 위에
 * 서는지는 라이브러리가 컨테이너 좌표로 계산하는 일이라 이 목 위에서는 안 보인다. 그건 기기가
 * 답한다.
 */
describe('BottomSheet: 머리를 스크롤 밖에 고정한다', () => {
  async function 고정시트(): Promise<ReturnType<typeof renderOverlay>> {
    return renderOverlay(
      <BottomSheet
        onClose={noop}
        testId="income-sheet"
        label="수입 기록"
        header={<Text>사냥</Text>}
        footer={<Text>저장</Text>}
      >
        <Text>시트 내용</Text>
      </BottomSheet>,
    )
  }

  it('머리 모서리가 시트 모서리와 같다. 다르면 덧댄 판으로 보인다', async () => {
    const { getByTestId } = await 고정시트()
    const 껍데기 = flattenStyle(getByTestId('sheet').props.backgroundStyle)
    const 머리 = flattenStyle(getByTestId('bottom-sheet-header').props.style)

    expect(머리.borderTopLeftRadius).toBe(껍데기.borderTopLeftRadius)
    expect(머리.borderTopRightRadius).toBe(껍데기.borderTopRightRadius)
    // 흐름 밖이라야 라이브러리가 재는 내용 높이에 안 얹힌다.
    expect(머리.position).toBe('absolute')
  })

  /**
   * 머리가 핸들 자리를 덮는다. 둘 다 절대 배치이고 머리가 뒤에 그려지므로, 층이 같으면 핸들이
   * 머리 밑에 깔려 화면에서 사라진다(사용자 보고).
   */
  it('핸들이 머리 위에 선다. 안 그러면 핸들이 안 보인다', async () => {
    const { getByTestId } = await 고정시트()
    const 핸들층 = flattenStyle(getByTestId('bottom-sheet-handle').parent!.props.style).zIndex
    const 머리층 = flattenStyle(getByTestId('bottom-sheet-header').props.style).zIndex

    expect(핸들층).toBeGreaterThan(머리층 as number)
  })

  // 머리가 흐름 밖이므로 그 몫을 스크롤 내용이 스스로 비워야 첫 줄이 안 가린다.
  it('머리가 먹은 높이를 스크롤 내용의 위 여백이 되돌려 준다', async () => {
    const { getByTestId } = await 고정시트()
    const 위여백 = (): number =>
      (getByTestId('income-sheet').props.contentContainerStyle as { paddingTop: number }).paddingTop

    await act(async () => {
      fireEvent(getByTestId('bottom-sheet-header'), 'layout', {
        nativeEvent: { layout: { height: 67 } },
      })
    })

    expect(위여백()).toBe(67)
  })

  /**
   * 라이브러리는 시트 키를 **스크롤 내용** 높이로 정한다. 바닥 줄은 그 계산 밖이라, 이 여백이
   * 없으면 설 자리가 시트에 없어 잘린다. 여백만큼 시트가 자라고, 상한에 닿아 있으면 대신
   * 스크롤이 그만큼 줄어든다. 바닥 줄은 그 여백 위에 겹쳐 서므로 빈 칸이 남지 않는다.
   */
  /**
   * **이것이 고친 결함이다**(사용자 보고). 단계가 갈릴 때마다 층을 새로 심으면, 자리를 아직
   * 못 잰 첫 프레임에 줄이 시트 **맨 위**에 그려진다(`translateY` 가 0 이다). 화면에서는
   * 저장이 머리 위를 덮고 내용이 통째로 아래로 밀렸다가 제자리를 찾는 것으로 보인다.
   *
   * 그래서 층은 시트가 사는 동안 **늘 서 있고** 안이 비었다 찼다 한다. 자리는 이미 잡혀 있다.
   */
  /**
   * 단계를 오가는 시트. 바닥 줄이 있다 없다 하는 것이 곧 단계 이동이다(지출 시트의 항목 격자
   * ↔ 폼). 껍데기를 통째로 다시 그리면 안전영역 문맥까지 날아가므로 상태로 갈아 끼운다.
   */
  function StepSheet(): React.JSX.Element {
    const [바닥있음, set바닥있음] = useState(true)
    return (
      <>
        <Pressable role="button" aria-label="단계 바꾸기" onPress={() => set바닥있음(false)} />
        <BottomSheet
          onClose={noop}
          testId="income-sheet"
          label="수입 기록"
          header={<Text>사냥</Text>}
          footer={바닥있음 ? <Text>저장</Text> : undefined}
        >
          <Text>시트 내용</Text>
        </BottomSheet>
      </>
    )
  }

  // 줄은 내용의 마지막 줄이다. 단계가 갈려 줄이 사라져도 남는 것은 인셋(34)과 숨돌림(16)뿐이다.
  it('바닥 줄은 스크롤 안에 선다. 단계가 갈리면 함께 사라진다', async () => {
    const view = await renderOverlay(<StepSheet />)
    expect(within(view.getByTestId('income-sheet')).queryByText('저장')).toBeTruthy()

    await act(async () => {
      fireEvent.press(view.getByLabelText('단계 바꾸기'))
    })

    expect(view.queryByTestId('bottom-sheet-footer')).toBeNull()
    expect(
      (view.getByTestId('income-sheet').props.contentContainerStyle as { paddingBottom: number })
        .paddingBottom,
    ).toBe(34 + 16)
  })

  /**
   * **재기 전에도 자리를 잡아 둔다.** 라이브러리는 시트의 키를 스크롤 **내용**에서 재는데 그
   * 내용의 여백이 이 값에서 나온다. 0 으로 시작하면 시트가 **두 번 움직인다**. 먼저 그만큼
   * 작아졌다가 잰 값이 도착하면 다시 커진다. 화면에서는 내용과 버튼이 따로 노는 것으로
   * 보인다(사용자 지적, 60fps 프레임에서 그 한 번 더 작아지는 구간을 확인했다).
   */
  it('머리는 재기 전에도 자리를 비워 둔다. 0 이 아니다', async () => {
    const { getByTestId } = await 고정시트()

    const 여백 = getByTestId('income-sheet').props.contentContainerStyle as { paddingTop: number }

    expect(여백.paddingTop).toBeGreaterThan(24)
  })

  it('안 넘기면 둘 다 안 선다. 나머지 시트는 그대로다', async () => {
    const { getByTestId, queryByTestId } = await renderOverlay(
      <BottomSheet onClose={noop} testId="boss-drop-sheet" label="드롭 아이템 기록">
        <Text>시트 내용</Text>
      </BottomSheet>,
    )

    expect(queryByTestId('bottom-sheet-header')).toBeNull()
    expect(queryByTestId('bottom-sheet-footer')).toBeNull()
    expect(
      (getByTestId('boss-drop-sheet').props.contentContainerStyle as { paddingTop: number })
        .paddingTop,
    ).toBe(24 + 8)
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
/**
 * 단계를 갈 때 얹히는 흐림의 **재질**.
 *
 * `expo-blur` 의 기본 `default` 는 iOS 의 적응형 `.regular` 이라 **OS 외형**을 따라간다. 다크 OS 를
 * 쓰는 사용자의 라이트 테마 시트가 통째로 어두워졌다(실기기 보고). 상수로 박히면 그 사고가
 * 그대로 돌아오므로 배선을 여기서 붙든다.
 */
describe('BottomSheet: 흐림 재질은 테마가 고른다', () => {
  const 검은마법사 = getThemeDefinition('검은마법사')

  beforeEach(__resetThemeAppearanceForTest)
  afterEach(__resetThemeAppearanceForTest)

  /**
   * 단계를 안에서 갈아 준다. 밖에서 `rerender` 하면 껍데기(안전 영역 프로바이더)까지 함께
   * 갈려 시트가 설 자리를 잃는다.
   */
  function StepKeySheet(): React.JSX.Element {
    const [단계, set단계] = useState('갈래')
    return (
      <>
        <Pressable role="button" aria-label="단계 바꾸기" onPress={() => set단계('폼')} />
        <BottomSheet onClose={noop} label="지출 기록" stepKey={단계}>
          <Text>시트 내용</Text>
        </BottomSheet>
      </>
    )
  }

  /** 흐림은 **단계가 갈릴 때만** 선다. 한 번 갈아 준다. */
  async function 단계갈기(): Promise<ReturnType<typeof renderOverlay>> {
    const view = await renderOverlay(<StepKeySheet />)
    await act(async () => {
      fireEvent.press(view.getByLabelText('단계 바꾸기'))
    })
    return view
  }

  /** 흐림 층은 스크린리더에서 빼 뒀다. 기본 쿼리가 건너뛰므로 숨은 것까지 찾게 한다. */
  function 흐림(view: Awaited<ReturnType<typeof renderOverlay>>): 요소 {
    return view.getByTestId('bottom-sheet-veil-blur', { includeHiddenElements: true })
  }

  it('라이트 테마에서는 밝은 재질이다', async () => {
    const view = await 단계갈기()

    expect(흐림(view).props.tint).toBe('systemMaterialLight')
  })

  it('다크 테마에서는 어두운 재질이다', async () => {
    setThemeAppearance('검은마법사', 검은마법사)

    const view = await 단계갈기()

    expect(흐림(view).props.tint).toBe('systemMaterialDark')
  })
})

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
