// 아이템 가격 입력으로 가는 떠 있는 버튼.
//
// **움직임은 여기서 안 본다**. 값은 `drop-price-fab-motion.ts` 가 들고 그쪽 테스트가 붙든다.
// 여기서 보는 것은 **무엇이 어디에 섰고 누르면 어디로 가는가** 다.
import { act, fireEvent } from '@testing-library/react-native'

import { StyleSheet } from 'react-native'

import { flattenStyle, renderOverlay, 기본테마 } from '../../../components/__tests__/render-atom'
import { getThemeDefinition } from '../../../lib/theme/theme-registry'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../../theme/appearance-store'
import { boxShadowOf } from '../../../lib/shadow'
import { FAB_DARK_EDGE, FAB_DIAMETER_PX, FAB_SHADOW } from '../../../lib/fab-metrics'
import { getItemIconUrl } from '../../../lib/assets/asset-lookup'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../native/ports'
import { DropPriceFab, DROP_PRICE_FAB_ITEMS } from '../DropPriceFab'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const navigate = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

/** 트리에 선 순서대로의 `testID`. 무엇이 무엇 위에 얹혔는지는 이 순서가 답한다. */
function testIdsInOrder(node: unknown, found: string[] = []): string[] {
  if (node === null || typeof node !== 'object') return found

  if (Array.isArray(node)) {
    for (const child of node) testIdsInOrder(child, found)
    return found
  }

  const element = node as { props?: Record<string, unknown>; children?: unknown }
  const testID = element.props?.testID
  if (typeof testID === 'string') found.push(testID)
  testIdsInOrder(element.children, found)
  return found
}

describe('버튼', () => {
  it('이름으로 자기가 여는 화면을 말한다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    expect(view.getByLabelText('아이템 가격 입력')).toBeTruthy()
  })

  it('누르면 하위 페이지로 push 한다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('아이템 가격 입력'))
    })

    expect(navigate).toHaveBeenCalledWith('DropPrice')
  })

  // 가계부의 ＋ 와 같은 원이다. 두 탭 화면의 같은 자리에 다른 크기가 서면 자리가 아니라
  // 화면마다 다른 것으로 읽힌다.
  it('지름이 공용 치수와 같다', async () => {
    const view = await renderOverlay(<DropPriceFab />)
    const box = flattenStyle(view.getByLabelText('아이템 가격 입력').props.style)

    expect(box.height).toBe(FAB_DIAMETER_PX)
    expect(box.width).toBe(FAB_DIAMETER_PX)
  })
})

describe('도는 그림', () => {
  it('셋이 다 마운트된 채로 있다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    expect(DROP_PRICE_FAB_ITEMS).toHaveLength(3)
    for (let slot = 0; slot < DROP_PRICE_FAB_ITEMS.length; slot += 1) {
      expect(view.getByTestId(`drop-price-fab-item-${slot}`)).toBeTruthy()
    }
  })

  // 파일명은 화면이 안 든다. `item-icons.json` 이 이름에 매어 둔 것을 그대로 꺼내므로
  // 매핑이 바뀌면 이 버튼도 함께 따라간다.
  it('그림은 아이템 이름으로 찾은 것이다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    DROP_PRICE_FAB_ITEMS.forEach((itemName, slot) => {
      const icon = getItemIconUrl(itemName)

      expect(icon).not.toBeNull()
      expect(view.getByTestId(`drop-price-fab-item-${slot}`).props.source).toBe(icon)
    })
  })
})

describe('흐림', () => {
  // `expo-blur` 는 **자기 뒤에 있는 것**을 흐린다. 그림보다 먼저 서면 흐릴 것이 원의 채움색
  // 뿐이라 아무 일도 안 일어난다.
  it('그림 셋보다 뒤에 서서 그것들을 덮는다', async () => {
    const view = await renderOverlay(<DropPriceFab />)
    const order = testIdsInOrder(view.toJSON())

    expect(order.indexOf('drop-price-fab-veil')).toBeGreaterThan(
      order.indexOf(`drop-price-fab-item-${DROP_PRICE_FAB_ITEMS.length - 1}`),
    )
  })

  // 모서리는 바깥 원이 자른다. `BlurView` 자신에게 반경을 주면 iOS 의 시각 효과 뷰가 그것을
  // 안 따라 각진 네모가 원 밖으로 삐져나온다.
  it('자르는 것은 바깥 원이다', async () => {
    const view = await renderOverlay(<DropPriceFab />)
    const box = flattenStyle(view.getByLabelText('아이템 가격 입력').props.style)

    expect(box.overflow).toBe('hidden')
  })

  it('터치를 안 먹는다. 버튼이 통째로 눌려야 한다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    expect(view.getByTestId('drop-price-fab-veil').props.pointerEvents).toBe('none')
  })
})

// 입체감. 가계부의 ＋ 와 **같은 값**을 쓴다. 둘은 같은 층에 떠 있는 물건이라 같은 높이로 보여야
// 하고, 값을 각자 적어 두면 한쪽만 손볼 때 조용히 갈린다.
describe('떠 있는 원의 입체감', () => {
  afterEach(__resetThemeAppearanceForTest)

  // 이 원은 `overflow-hidden` 이다(도는 그림과 흐림 판을 원 안에 가두는 값). 같은 뷰에 그림자를
  // 달면 플랫폼에 따라 잘리므로 원을 감싸는 바깥 뷰가 든다.
  it('그림자는 자르는 원 밖의 뷰가 든다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    const elevation = flattenStyle(view.getByTestId('drop-price-fab-elevation').props.style)

    expect(elevation.boxShadow).toBe(boxShadowOf(기본테마.shadowColor, FAB_SHADOW))
    expect(elevation.borderRadius).toBe(999)
    // 자르는 것은 이 뷰가 아니다. 여기서 자르면 그림자가 자기 상자 안에 갇힌다.
    expect(elevation.overflow).toBeUndefined()
  })

  it('원 자신은 그림자를 안 든다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    expect(
      flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).boxShadow,
    ).toBeUndefined()
  })

  it('iOS 전용 프롭과 elevation 을 쓰지 않는다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    const elevation = flattenStyle(view.getByTestId('drop-price-fab-elevation').props.style)

    expect(elevation.shadowOpacity).toBeUndefined()
    expect(elevation.shadowRadius).toBeUndefined()
    expect(elevation.elevation).toBeUndefined()
  })

  it('라이트에서는 테두리가 없다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    expect(
      flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).borderWidth,
    ).toBeUndefined()
  })

  it('다크에서는 흰 헤어라인이 원에 붙는다', async () => {
    setThemeAppearance('검은마법사', getThemeDefinition('검은마법사'))

    const view = await renderOverlay(<DropPriceFab />)
    const circle = flattenStyle(view.getByLabelText('아이템 가격 입력').props.style)

    expect(circle.borderWidth).toBe(StyleSheet.hairlineWidth)
    expect(circle.borderColor).toBe(FAB_DARK_EDGE)
    expect(circle.height).toBe(FAB_DIAMETER_PX)
  })
})

// 누르면 가격 입력 화면으로 간다. 화면이 바뀌므로 이동 촉각이다.
describe('떠 있는 버튼의 촉각', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(installNoopNativePorts)

  it('누르면 한 번 난다', async () => {
    const view = await renderOverlay(<DropPriceFab />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('아이템 가격 입력'))
    })

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
