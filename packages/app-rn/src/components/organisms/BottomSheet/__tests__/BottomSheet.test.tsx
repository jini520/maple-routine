// 웹판에는 `BottomSheet` 전용 테스트가 없었다 — [[ADR-039]] 가 성공 기준을 *"유일 사용처인
// `BossDropSheet` 의 테스트 4개가 **수정 없이** 통과할 것"* 으로 삼았기 때문이다(스킨·공개 API 를
// 안 바꾼다는 결정 2 를 그 자리에서 검사하는 방식). RN 에서는 그 화면이 아직 없으므로 **그때 그
// 테스트가 지켰을 계약**을 직접 적는다.
//
// **이 파일은 라이브러리를 세워 둔다(`jest.mock`).** 진짜 `@gorhom/bottom-sheet` 은 레이아웃 측정과
// UI 스레드 애니메이션 위에 서 있어 jest 에서 시트 내용이 아예 마운트되지 않는다(실측 — `waitFor`
// 로 1초를 기다려도 안 나온다). 그래서 여기서 보는 것은 **우리가 무엇을 넘겼는가**이고, 그 값들이
// 라이브러리가 실제로 받는 프롭인지는 **타입 검사**가 지킨다(컴포넌트가 진짜 타입을 import 한다).
// 라이브러리를 진짜로 세워 마운트되는지는 옆 파일(`BottomSheet.wiring.test.tsx`)이 본다.
import type { ReactNode } from 'react'
import { Text } from 'react-native'

// `jest.mock` 팩토리는 호이스팅돼 스코프 밖 변수를 못 읽는다 — **`mock` 접두 이름만** 예외다.
const mockPresent = jest.fn()

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
    BottomSheetScrollView: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { flattenStyle, renderOverlay, 기본테마 } from '../../../__tests__/render-atom'
import { BottomSheet } from '../BottomSheet'

const noop = (): void => {}

beforeEach(() => {
  mockPresent.mockClear()
})

describe('BottomSheet — [[ADR-039]] 가 정한 값을 넘긴다', () => {
  async function open(): Promise<ReturnType<typeof renderOverlay>> {
    return renderOverlay(
      <BottomSheet onClose={noop} testId="boss-drop-sheet">
        <Text>시트 내용</Text>
      </BottomSheet>,
    )
  }

  it('children 과 testId 를 그대로 전달한다 — 공개 API 는 웹과 같다', async () => {
    const { getByText, getByTestId } = await open()

    expect(getByText('시트 내용')).toBeTruthy()
    expect(getByTestId('boss-drop-sheet')).toBeTruthy()
  })

  // 결정 2 의 스킨 — 라이브러리 기본 핸들 색·라운딩이 아니라 이 값들이어야 한다.
  it('그랩 핸들·배경·라운딩이 스킨 그대로다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')

    expect(flattenStyle(sheet.props.handleIndicatorStyle)).toMatchObject({
      height: 4,
      width: 36,
      backgroundColor: 기본테마.borderStrong,
    })
    expect(flattenStyle(sheet.props.backgroundStyle)).toMatchObject({
      backgroundColor: 기본테마.bg,
      borderTopWidth: 1,
      borderTopColor: 기본테마.border,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    })
  })

  // `max-h-[82vh]` 는 **상한**이지 높이가 아니다 — 고정 스냅 포인트(라이브러리의 흔한 사용법)로
  // 옮기면 내용이 짧아도 시트가 항상 82%까지 올라온다.
  it('높이는 내용이 정하고 82%가 상한이다 — 고정 스냅 포인트가 아니다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')

    expect(sheet.props.snapPoints).toBeUndefined()
    expect(sheet.props.enableDynamicSizing).toBe(true)
    // 테스트 프레임 높이 844 × 0.82
    expect(sheet.props.maxDynamicContentSize).toBeCloseTo(844 * 0.82)
  })

  it('폭은 max-w-md(448) 중앙 정렬이다 — 라이브러리 기본은 전폭이다', async () => {
    const { getByTestId } = await open()

    expect(flattenStyle(getByTestId('sheet').props.style)).toMatchObject({
      maxWidth: 448,
      alignSelf: 'center',
    })
  })

  // 스크림은 테마 토큰이다. 라이브러리 백드롭의 기본 알파를 그대로 두면 두 겹이 된다.
  it('스크림은 테마 토큰이고 라이브러리 알파를 겹치지 않는다', async () => {
    const { getByTestId } = await open()
    const sheet = getByTestId('sheet')
    const backdrop = (sheet.props.backdropComponent as (p: object) => React.JSX.Element)({})

    expect(backdrop.props.opacity).toBe(1)
    expect(flattenStyle(backdrop.props.style).backgroundColor).toBe(기본테마.scrim)
    expect(backdrop.props.pressBehavior).toBe('close')
  })

  // 결정 3: 마운트가 곧 열림(웹의 `open` 초기값 `true`)이고, 닫힘은 이탈 애니메이션이 끝난 뒤
  // (`onDismiss`) 부모에 알려 언마운트를 맡긴다.
  it('마운트하면 열고, 닫힘은 이탈 애니메이션이 끝난 뒤 부모에 통보한다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <BottomSheet onClose={onClose}>
        <Text>시트 내용</Text>
      </BottomSheet>,
    )

    expect(mockPresent).toHaveBeenCalledTimes(1)
    expect(getByTestId('sheet').props.onDismiss).toBe(onClose)
    expect(getByTestId('sheet').props.enablePanDownToClose).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
  })
})
