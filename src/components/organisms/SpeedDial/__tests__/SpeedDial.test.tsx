// 펼침판. ＋ 하나가 갈래 둘을 편다.
//
// **움직임은 여기서 안 본다**. 값은 `speed-dial-motion.ts` 가 들고 그쪽 테스트가 붙든다. 여기서
// 보는 것은 **무엇이 눌리고 무엇이 안 눌리는가** 다.
import { act, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { flattenStyle, renderOverlay, 기본테마 } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import {
  __resetThemeAppearanceForTest,
  setThemeAppearance,
} from '../../../../theme/appearance-store'
import { SpeedDial } from '../SpeedDial'
import { boxShadowOf } from '../../../../lib/shadow'
import {
  FAB_CONTENT_GAP_PX,
  FAB_DARK_EDGE,
  FAB_DIAMETER_PX,
  FAB_LIFT_PX,
  FAB_SHADOW,
  FAB_SPACE_PX,
} from '../../../../lib/fab-metrics'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function 그리기(overrides: Partial<React.ComponentProps<typeof SpeedDial>> = {}) {
  return renderOverlay(
    <SpeedDial onSelectIncome={jest.fn()} onSelectExpense={jest.fn()} {...overrides} />,
  )
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

describe('접혀 있을 때', () => {
  it('＋ 하나만 누를 수 있다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('기록 추가').props.accessibilityState?.disabled).toBeFalsy()
  })

  // 갈래 둘은 **마운트된 채로** 남는다. 접히는 움직임을 보여주려면 사라지면 안 된다. 대신
  // 못 누르게 막는다(`aria-hidden` 은 안 쓴다: RNTL 이 노드를 숨김으로 보고 쿼리에서 걷어낸다).
  it('갈래 둘은 서 있지만 눌리지 않는다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('수입 추가').props.accessibilityState?.disabled).toBe(true)
    expect(view.getByLabelText('지출 추가').props.accessibilityState?.disabled).toBe(true)
  })

  it('닫힌 갈래를 눌러도 아무 일이 없다', async () => {
    const onSelectExpense = jest.fn()
    const view = await 그리기({ onSelectExpense })

    await 누르기(view, '지출 추가')

    expect(onSelectExpense).not.toHaveBeenCalled()
  })

  it('스크림이 터치를 안 먹는다. 뒤의 캘린더를 그대로 쓸 수 있다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('speed-dial-scrim').props.pointerEvents).toBe('none')
  })
})

describe('펼친 뒤', () => {
  async function 펼치기(overrides: Partial<React.ComponentProps<typeof SpeedDial>> = {}) {
    const view = await 그리기(overrides)
    await 누르기(view, '기록 추가')
    return view
  }

  it('갈래 둘이 눌린다', async () => {
    const view = await 펼치기()

    expect(view.getByLabelText('수입 추가').props.accessibilityState?.disabled).toBe(false)
    expect(view.getByLabelText('지출 추가').props.accessibilityState?.disabled).toBe(false)
  })

  // 이름이 상태를 든다. 그림은 하나이고 **각도만** 다르므로 스크린리더에는 회전이 안 들린다.
  // 배경은 접근성 트리에 없어서(`accessible={false}`) `닫기`가 **하나뿐**이다.
  it('＋ 가 닫기가 된다. 그림은 그대로다', async () => {
    const view = await 펼치기()

    expect(view.getByLabelText('닫기')).toBeTruthy()
    expect(view.queryByLabelText('기록 추가')).toBeNull()
  })

  it('스크림이 터치를 받는다', async () => {
    const view = await 펼치기()

    expect(view.getByTestId('speed-dial-scrim').props.pointerEvents).toBe('auto')
  })

  it('갈래를 고르면 알리고 접는다', async () => {
    const onSelectIncome = jest.fn()
    const view = await 펼치기({ onSelectIncome })

    await 누르기(view, '수입 추가')

    expect(onSelectIncome).toHaveBeenCalledTimes(1)
    // 고른 뒤에는 판이 남아 있을 이유가 없다. 시트가 그 자리를 받는다.
    expect(view.getByLabelText('기록 추가')).toBeTruthy()
  })

  it('지출도 같다', async () => {
    const onSelectExpense = jest.fn()
    const view = await 펼치기({ onSelectExpense })

    await 누르기(view, '지출 추가')

    expect(onSelectExpense).toHaveBeenCalledTimes(1)
  })

  it('스크림을 누르면 접힌다. 아무것도 안 고른다', async () => {
    const onSelectIncome = jest.fn()
    const onSelectExpense = jest.fn()
    const view = await 펼치기({ onSelectIncome, onSelectExpense })

    await act(async () => {
      fireEvent.press(view.getByTestId('speed-dial-scrim-button'))
    })

    expect(view.getByLabelText('기록 추가')).toBeTruthy()
    expect(onSelectIncome).not.toHaveBeenCalled()
    expect(onSelectExpense).not.toHaveBeenCalled()
  })

  it('닫기를 누르면 접힌다', async () => {
    const view = await 펼치기()

    await 누르기(view, '닫기')

    expect(view.getByLabelText('기록 추가')).toBeTruthy()
  })
})

// 수입이 위· 지출이 아래다. 칸의 두 줄과 같은 순서이고, 덕분에 **잦은
// 지출이 FAB 에 더 가깝다**(엄지가 올라오며 먼저 닿는다).
describe('차례', () => {
  it('수입이 지출보다 먼저 그려진다. 위에 선다', async () => {
    const view = await 그리기()

    const 줄 = view.getAllByTestId(/^speed-dial-row-/).map((node) => node.props.testID)

    expect(줄).toEqual(['speed-dial-row-income', 'speed-dial-row-expense'])
  })
})

// 치수는 **여러 곳이 나눠 쓴다**(`lib/fab-metrics.ts`). 버튼이 자기 높이를 정하고, 화면이
// 그만큼을 콘텐츠 끝에 갚는다. 갈리면 화면에서는 **조금 가린다** 로만 보여서 알아채기 어렵다.
describe('치수 ( 의 딸려 오는 결함)', () => {
  it('FAB 의 실제 높이가 화면이 갚는 값과 같은 상수에서 나온다', async () => {
    const view = await 그리기()

    const fab = flattenStyle(view.getByLabelText('기록 추가').props.style)

    expect(fab.height).toBe(FAB_DIAMETER_PX)
    expect(fab.width).toBe(FAB_DIAMETER_PX)
  })

  it('콘텐츠가 갚을 몫은 뜨는 높이 + 지름 + 숨돌림이다', () => {
    expect(FAB_SPACE_PX).toBe(FAB_LIFT_PX + FAB_DIAMETER_PX + FAB_CONTENT_GAP_PX)
    // 판별력: 셋 중 하나가 0 이면 **가린다** 가 그만큼 되살아난다.
    expect(FAB_LIFT_PX).toBeGreaterThan(0)
    expect(FAB_CONTENT_GAP_PX).toBeGreaterThan(0)
  })
})

/**
 * **접힌 다이얼은 뒤를 안 막는다**.
 *
 * 줄 둘은 접혀 있어도 **마운트된 채** `opacity: 0` 일 뿐이라, RN 에서는 그 자리가 그대로 터치를
 * 먹는다. `disabled` 도 `onPress` 만 막고 히트테스트는 안 막는다. 그래서 떠 있는 ＋ 위쪽
 * 130px 남짓이 통째로 눌리지 않는 구역 이 됐다(그 뒤의 목록 줄이 안 눌렸다).
 *
 * 스크림은 이미 같은 처방을 쓰고 있었다(`pointerEvents={isOpen ? 'auto' : 'none'}`). 줄에만
 * 빠져 있었다.
 */
describe('접혀 있을 때 뒤를 안 막는다', () => {
  it('줄 둘이 터치를 안 받는다', async () => {
    const view = await 그리기()

    for (const row of view.getAllByTestId(/^speed-dial-row-/)) {
      expect(row.props.pointerEvents).toBe('none')
    }
  })

  it('펼치면 다시 받는다', async () => {
    const view = await 그리기()
    await 누르기(view, '기록 추가')

    for (const row of view.getAllByTestId(/^speed-dial-row-/)) {
      expect(row.props.pointerEvents).toBe('auto')
    }
  })

  // 줄 사이의 빈 자리와 오른쪽 여백도 상자다. 상자가 터치를 먹으면 같은 결함이 남는다.
  it('줄을 담은 상자는 자기 자리를 안 먹는다. box-none', async () => {
    const view = await 그리기()

    expect(view.getByTestId('speed-dial-actions').props.pointerEvents).toBe('box-none')
  })
})

// 입체감. **세기는 테스트가 못 잡는다**(jest 는 그림자를 그리지 않는다). 여기서 지키는 것은
// 값이 한 자리에서 오는가와, 다크에서 경계를 지는 것이 그림자가 아니라 테두리인가 둘이다.
describe('떠 있는 원의 입체감', () => {
  afterEach(__resetThemeAppearanceForTest)

  it('그림자는 원 밖의 뷰가 든다. 값은 공용 상수에서 온다', async () => {
    const view = await 그리기()

    const elevation = flattenStyle(view.getByTestId('speed-dial-fab-elevation').props.style)

    expect(elevation.boxShadow).toBe(boxShadowOf(기본테마.shadowColor, FAB_SHADOW))
    // 모양은 `borderRadius` 에서 나온다. 없으면 둥근 원 뒤에 네모난 그림자가 깔린다.
    expect(elevation.borderRadius).toBe(999)
  })

  // `shadowOpacity`·`shadowRadius`·`shadowOffset` 은 iOS 전용이라 안드로이드에 안 닿고,
  // `elevation` 을 함께 주면 그림자가 두 번 그려진다.
  it('iOS 전용 프롭과 elevation 을 쓰지 않는다', async () => {
    const view = await 그리기()

    const elevation = flattenStyle(view.getByTestId('speed-dial-fab-elevation').props.style)

    expect(elevation.shadowOpacity).toBeUndefined()
    expect(elevation.shadowRadius).toBeUndefined()
    expect(elevation.elevation).toBeUndefined()
  })

  it('라이트에서는 테두리가 없다. 경계를 그림자가 진다', async () => {
    const view = await 그리기()

    expect(flattenStyle(view.getByLabelText('기록 추가').props.style).borderWidth).toBeUndefined()
  })

  // 어두운 바탕에서는 그림자가 거의 안 보인다. 하단바가 라이트 그림자 · 다크 테두리로 가른 것과
  // 같은 자리다. 테두리는 크기가 박힌 **원 자신**이 든다(바깥 뷰에 주면 두께만큼 커진다).
  it('다크에서는 흰 헤어라인이 원에 붙는다', async () => {
    setThemeAppearance('검은마법사', getThemeDefinition('검은마법사'))

    const view = await 그리기()
    const circle = flattenStyle(view.getByLabelText('기록 추가').props.style)

    expect(circle.borderWidth).toBe(StyleSheet.hairlineWidth)
    expect(circle.borderColor).toBe(FAB_DARK_EDGE)
    // 지름은 그대로다. 테두리가 안쪽에 그려져 자리가 안 움직인다.
    expect(circle.height).toBe(FAB_DIAMETER_PX)
  })

  // 사용자 결정. 어두운 스크림 위에 색이 꽉 찬 원이라 그림자가 거의 안 보이고, 떠 있음은
  // 스크림이 이미 만든다. 값이 큰 원 하나에만 걸려 있으면 갈릴 자리도 없다.
  it('펼침판의 작은 원 둘에는 그림자가 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '기록 추가')

    for (const row of view.getAllByTestId(/^speed-dial-row-/)) {
      expect(flattenStyle(row.props.style).boxShadow).toBeUndefined()
    }
  })
})

// `＋` 는 기록을 더하는 문을 여는 버튼이라 이동이다. 펼친 뒤 고르는 갈래 둘은 안 낸다(사용자 지정).
describe('＋ 의 촉각', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(__resetNativePortsForTest)

  it('열 때와 닫을 때 한 번씩 난다', async () => {
    const view = await 그리기()

    await 누르기(view, '기록 추가')
    expect(tap).toHaveBeenCalledTimes(1)

    await 누르기(view, '닫기')
    expect(tap).toHaveBeenCalledTimes(2)
  })

  it('펼친 뒤 고르는 갈래에는 안 난다', async () => {
    const view = await 그리기()
    await 누르기(view, '기록 추가')
    tap.mockClear()

    await 누르기(view, '수입 추가')

    expect(tap).not.toHaveBeenCalled()
  })
})
