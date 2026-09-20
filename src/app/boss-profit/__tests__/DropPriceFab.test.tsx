// 아이템 가격 입력으로 가는 떠 있는 버튼.
//
// **움직임은 여기서 안 본다**. 값은 `drop-price-fab-motion.ts` 가 들고 그쪽 테스트가 붙든다.
// 여기서 보는 것은 **무엇이 어디에 섰고 누르면 어디로 가는가** 다.
import { act, fireEvent, within } from '@testing-library/react-native'

import { StyleSheet } from 'react-native'

import { flattenStyle, renderOverlay, 기본테마 } from '../../../components/__tests__/render-atom'
import { getThemeDefinition } from '../../../lib/theme/theme-registry'
import { __resetThemeAppearanceForTest, setThemeAppearance } from '../../../theme/appearance-store'
import { boxShadowOf } from '../../../lib/shadow'
import { FAB_DARK_EDGE, FAB_DIAMETER_PX, FAB_SHADOW } from '../../../lib/fab-metrics'
import { dropItemIconOf } from '../../../lib/assets/asset-lookup'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../native/ports'
import { useUnpricedDropCount } from '../../../features/boss-profit/use-unpriced-drop-count'
import { DropPriceFab, DROP_PRICE_FAB_ITEMS } from '../DropPriceFab'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))
// 배지 수의 원천(창 채우기 · 판 구독)은 그 훅의 테스트가 본다. 여기서는 받은 수를 어떻게 그리는가다.
jest.mock('../../../features/boss-profit/use-unpriced-drop-count', () => ({ useUnpricedDropCount: jest.fn() }))

const navigate = jest.fn()
const PERIOD = '2026-08-06'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
  jest.mocked(useUnpricedDropCount).mockReturnValue(null)
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
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(view.getByLabelText('아이템 가격 입력')).toBeTruthy()
  })

  // 보던 주를 넘긴다. 가격 입력 화면이 보스 수익 스토어를 읽으면, 이 화면이 없을 때 남은 낡은
  // 기간으로 열린다(today 에서 열 때).
  it('누르면 보고 있는 주를 들고 하위 페이지로 push 한다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('아이템 가격 입력'))
    })

    expect(navigate).toHaveBeenCalledWith('DropPrice', { cycle: 'weekly', periodKey: PERIOD })
  })

  // 가계부의 ＋ 와 같은 원이다. 두 탭 화면의 같은 자리에 다른 크기가 서면 자리가 아니라
  // 화면마다 다른 것으로 읽힌다.
  it('지름이 공용 치수와 같다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)
    const box = flattenStyle(view.getByLabelText('아이템 가격 입력').props.style)

    expect(box.height).toBe(FAB_DIAMETER_PX)
    expect(box.width).toBe(FAB_DIAMETER_PX)
  })
})

// 수익 내역 상자가 미입력 줄을 안 싣는 대신 이 배지가 값이 빈 드롭이 있다는 신호를 받는다.
// 배지는 장식이라(`aria-hidden`) 숨은 요소까지 찾아야 잡힌다. 뜻은 원의 이름이 읽는다.
describe('미입력 건수 배지', () => {
  const 숨김포함 = { includeHiddenElements: true }

  async function 그리기(count: number | null): Promise<Awaited<ReturnType<typeof renderOverlay>>> {
    jest.mocked(useUnpricedDropCount).mockReturnValue(count)
    return renderOverlay(<DropPriceFab periodKey={PERIOD} />)
  }

  function 배지글자(view: Awaited<ReturnType<typeof renderOverlay>>): string {
    const badge = view.getByTestId('drop-price-fab-badge', 숨김포함)
    return String(within(badge).getByText(/./, 숨김포함).props.children)
  }

  it('보고 있는 주로 수를 묻는다', async () => {
    await 그리기(null)

    expect(useUnpricedDropCount).toHaveBeenCalledWith(PERIOD)
  })

  it('모르는 수(null)면 배지가 안 서고 이름만 읽는다', async () => {
    const view = await 그리기(null)

    expect(view.queryByTestId('drop-price-fab-badge', 숨김포함)).toBeNull()
    expect(view.getByLabelText('아이템 가격 입력')).toBeTruthy()
  })

  it('0 건이면 배지가 안 서고 이름만 읽는다', async () => {
    const view = await 그리기(0)

    expect(view.queryByTestId('drop-price-fab-badge', 숨김포함)).toBeNull()
    expect(view.getByLabelText('아이템 가격 입력')).toBeTruthy()
  })

  it('건수를 배지에 적고 이름에 수를 더해 읽는다', async () => {
    const view = await 그리기(3)

    expect(배지글자(view)).toBe('3')
    expect(view.getByLabelText('아이템 가격 입력, 미입력 3건')).toBeTruthy()
  })

  it('9건까지 그대로 적고 10건부터 9+ 로 적는다. 읽는 이름은 실제 수다', async () => {
    expect(배지글자(await 그리기(9))).toBe('9')

    const view = await 그리기(12)
    expect(배지글자(view)).toBe('9+')
    expect(view.getByLabelText('아이템 가격 입력, 미입력 12건')).toBeTruthy()
  })

  // 원이 `overflow-hidden` 이라 그 안에 두면 원 밖으로 걸친 부분이 잘린다.
  it('자르는 원 밖에 선다', async () => {
    const view = await 그리기(3)

    const circle = view.getByLabelText('아이템 가격 입력, 미입력 3건')
    expect(within(circle).queryByTestId('drop-price-fab-badge', 숨김포함)).toBeNull()
    expect(within(view.getByTestId('drop-price-fab')).getByTestId('drop-price-fab-badge', 숨김포함)).toBeTruthy()
  })

  // 알림이라 늘 빨간색이다. 채움 위 전경은 테마의 짝 토큰을 따른다.
  it('높이 18 · 테마의 error 채움과 on-error 글자다', async () => {
    const view = await 그리기(3)

    const badge = view.getByTestId('drop-price-fab-badge', 숨김포함)
    expect(flattenStyle(badge.props.style).height).toBe(18)
    expect(flattenStyle(badge.props.style).backgroundColor).toBe(기본테마.error)
    expect(flattenStyle(within(badge).getByText('3', 숨김포함).props.style).color).toBe(기본테마.onError)
  })

  // 한 자리 수는 글자 폭이 높이보다 좁아 최소 너비가 없으면 세로로 긴 타원이 된다. 이 단언이
  // 없던 동안 `min-w-4` 가 스타일을 하나도 안 내고 있었다(그 계단 이름이 없다).
  it('최소 너비가 높이와 같아 한 자리 수가 정원으로 선다', async () => {
    const badge = (await 그리기(3)).getByTestId('drop-price-fab-badge', 숨김포함)

    const style = flattenStyle(badge.props.style)
    expect(style.minWidth).toBe(style.height)
  })
})

describe('도는 그림', () => {
  it('셋이 다 마운트된 채로 있다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(DROP_PRICE_FAB_ITEMS).toHaveLength(3)
    for (let slot = 0; slot < DROP_PRICE_FAB_ITEMS.length; slot += 1) {
      expect(view.getByTestId(`drop-price-fab-item-${slot}`)).toBeTruthy()
    }
  })

  // 파일명은 화면이 안 든다. `drop-items.json` 이 key 에 매어 둔 것을 그대로 꺼내므로
  // 매핑이 바뀌면 이 버튼도 함께 따라간다.
  it('그림은 아이템 key 로 찾은 것이다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(DROP_PRICE_FAB_ITEMS).toEqual(['source_of_suffering', 'giant_terror', 'complete_under_control'])
    DROP_PRICE_FAB_ITEMS.forEach((itemKey, slot) => {
      const icon = dropItemIconOf(itemKey)

      expect(icon).not.toBeNull()
      expect(view.getByTestId(`drop-price-fab-item-${slot}`).props.source).toBe(icon)
    })
  })
})

describe('흐림', () => {
  // `expo-blur` 는 **자기 뒤에 있는 것**을 흐린다. 그림보다 먼저 서면 흐릴 것이 원의 채움색
  // 뿐이라 아무 일도 안 일어난다.
  it('그림 셋보다 뒤에 서서 그것들을 덮는다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)
    const order = testIdsInOrder(view.toJSON())

    expect(order.indexOf('drop-price-fab-veil')).toBeGreaterThan(
      order.indexOf(`drop-price-fab-item-${DROP_PRICE_FAB_ITEMS.length - 1}`),
    )
  })

  // 모서리는 바깥 원이 자른다. `BlurView` 자신에게 반경을 주면 iOS 의 시각 효과 뷰가 그것을
  // 안 따라 각진 네모가 원 밖으로 삐져나온다.
  it('자르는 것은 바깥 원이다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)
    const box = flattenStyle(view.getByLabelText('아이템 가격 입력').props.style)

    expect(box.overflow).toBe('hidden')
  })

  it('터치를 안 먹는다. 버튼이 통째로 눌려야 한다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

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
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    const elevation = flattenStyle(view.getByTestId('drop-price-fab-elevation').props.style)

    expect(elevation.boxShadow).toBe(boxShadowOf(기본테마.shadowColor, FAB_SHADOW))
    expect(elevation.borderRadius).toBe(999)
    // 자르는 것은 이 뷰가 아니다. 여기서 자르면 그림자가 자기 상자 안에 갇힌다.
    expect(elevation.overflow).toBeUndefined()
  })

  it('원 자신은 그림자를 안 든다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(
      flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).boxShadow,
    ).toBeUndefined()
  })

  it('iOS 전용 프롭과 elevation 을 쓰지 않는다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    const elevation = flattenStyle(view.getByTestId('drop-price-fab-elevation').props.style)

    expect(elevation.shadowOpacity).toBeUndefined()
    expect(elevation.shadowRadius).toBeUndefined()
    expect(elevation.elevation).toBeUndefined()
  })

  it('라이트에서는 테두리가 없다', async () => {
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    expect(
      flattenStyle(view.getByLabelText('아이템 가격 입력').props.style).borderWidth,
    ).toBeUndefined()
  })

  it('다크에서는 흰 헤어라인이 원에 붙는다', async () => {
    setThemeAppearance('검은마법사', getThemeDefinition('검은마법사'))

    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)
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
    const view = await renderOverlay(<DropPriceFab periodKey={PERIOD} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('아이템 가격 입력'))
    })

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
