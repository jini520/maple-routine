import { act, fireEvent, within } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import type { CharacterTotals } from '../../../features/stats/aggregate'
import { CharacterSection } from '../CharacterSection'

const rows: CharacterTotals[] = [
  { key: 'ocid:b', ocid: 'b', name: '낟넘', incomeMeso: 890_000_000, expenseMeso: 310_000_000, netMeso: 580_000_000 },
  { key: 'ocid:c', ocid: 'c', name: '지내우시', incomeMeso: 460_000_000, expenseMeso: 120_000_000, netMeso: 340_000_000 },
  { key: 'ocid:a', ocid: 'a', name: '낟낟', incomeMeso: 2_610_000_000, expenseMeso: 2_940_000_000, netMeso: -330_000_000 },
  { key: 'name:단풍라떼', ocid: null, name: '단풍라떼', incomeMeso: 0, expenseMeso: 40_000_000, netMeso: -40_000_000 },
]
const images = new Map([
  ['ocid:a', 'https://img/a.png'],
  ['ocid:b', 'https://img/b.png'],
])

async function 그리기(): Promise<Awaited<ReturnType<typeof renderOverlay>>> {
  return renderOverlay(<CharacterSection rows={rows} images={images} />)
}

/** 그림 줄은 화면 읽기에서 빠져 있어 숨은 것까지 찾는다 */
const 숨김포함 = { includeHiddenElements: true } as const

/** 단상 블록 셋의 높이를 잰 것처럼 알린다. 키는 순위다 */
async function 블록재기(view: Awaited<ReturnType<typeof 그리기>>, heights: Record<1 | 2 | 3, number>): Promise<void> {
  await act(async () => {
    for (const rank of [1, 2, 3] as const) {
      const block = within(view.getByTestId(`stats-podium-${rank}`)).getByTestId('stats-podium-block')
      fireEvent(block, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 42, height: heights[rank] } } })
    }
  })
}

function 그림칸(view: Awaited<ReturnType<typeof 그리기>>, rank: number): Record<string, unknown> {
  return flattenStyle(view.getByTestId(`stats-podium-figure-${rank}`, 숨김포함).props.style)
}

beforeEach(() => {
  installNoopNativePorts()
})

describe('CharacterSection', () => {
  // 수입은 붉은색, 지출은 파란색이다. 순 수익은 부호를 따른다(사용자 지정 2026-10-26).
  it('합계 글자는 수입 탭이 수입 색, 지출 탭이 지출 색이고 순 수익은 부호를 따른다', async () => {
    const view = await 그리기()
    const colorOfTotal = () => flattenStyle(view.getByTestId('stats-characters-total').props.style).color
    const 순수익 = colorOfTotal()
    await act(async () => {
      fireEvent.press(view.getByLabelText('수입'))
    })
    const 수입 = colorOfTotal()
    await act(async () => {
      fireEvent.press(view.getByLabelText('지출'))
    })
    const 지출 = colorOfTotal()

    expect(수입).not.toBe(지출)
    // 네 캐릭터의 순 수익 합은 +5.5억이라 수입 색이다.
    expect(순수익).toBe(수입)
  })

  it('순 수익 탭은 순 수익이 큰 순서이고 금액만 적는다', async () => {
    const view = await 그리기()

    const names = view.getAllByTestId(/^stats-character-row-/).map((row) => within(row).getByTestId('stats-character-name').props.children)
    expect(names).toEqual(['낟넘', '지내우시', '단풍라떼', '낟낟'])
    expect(within(view.getByTestId('stats-character-row-ocid:a')).getByTestId('stats-character-amount').props.children).toBe('−3.3억')
    expect(view.queryAllByTestId('stats-character-percent')).toHaveLength(0)
  })

  it('수입 탭은 수입이 있는 캐릭터만 서고 금액 앞에 %를 적는다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByLabelText('수입'))
    })

    const first = view.getByTestId('stats-character-row-ocid:a')
    expect(within(first).getByTestId('stats-character-percent').props.children).toBe('66%')
    expect(within(first).getByTestId('stats-character-amount').props.children).toBe('26.1억')
    expect(view.queryByTestId('stats-character-row-name:단풍라떼')).toBeNull()
  })

  // % 를 금액 옆 따로 둔 글자로 두고 기준선을 맞추면 줄이 1pt 가까이 커져, 같은 캐릭터 수에서도 탭마다
  // 카드 높이가 달랐다(#617). 한 Text 안에 두면 줄 높이가 바깥 글자 하나로 정해진다.
  it('% 와 금액은 한 줄 글자 안에 있어 탭마다 줄 높이가 같다', async () => {
    const view = await 그리기()
    const 줄 = (): ReturnType<typeof view.getByTestId> =>
      within(view.getByTestId('stats-character-row-ocid:a')).getByTestId('stats-character-value')

    expect(within(줄()).getByTestId('stats-character-amount')).toBeTruthy()
    const netClass = 줄().props.className

    await act(async () => {
      fireEvent.press(view.getByLabelText('수입'))
    })

    expect(within(줄()).getByTestId('stats-character-percent')).toBeTruthy()
    expect(within(줄()).getByTestId('stats-character-amount')).toBeTruthy()
    expect(줄().props.className).toBe(netClass)
  })

  it('단상은 그 탭의 상위 셋이고 그림이 있으면 세운다', async () => {
    const view = await 그리기()
    await 블록재기(view, { 1: 74, 2: 60, 3: 50 })

    expect(view.getByTestId('stats-podium-1').props.accessibilityLabel).toBe('1위 낟넘')
    expect(view.getByTestId('stats-podium-2').props.accessibilityLabel).toBe('2위 지내우시')
    expect(view.getByTestId('stats-podium-3').props.accessibilityLabel).toBe('3위 단풍라떼')
    const 칸 = (rank: number) => within(view.getByTestId(`stats-podium-figure-${rank}`, 숨김포함))
    expect(칸(1).getByTestId('stats-podium-image', 숨김포함).props.source).toEqual({ uri: 'https://img/b.png' })
    // 그림을 모르는 캐릭터는 흰 실루엣이 선다.
    expect(칸(2).queryByTestId('stats-podium-image', 숨김포함)).toBeNull()
    expect(칸(2).getByTestId('stats-podium-image-unknown', 숨김포함)).toBeTruthy()
  })

  // 단상은 전신 그림이 서는 자리인데 메이플 ID 에는 그림이 없다(사용자 지정 2026-11-04).
  it('메이플 ID 줄은 막대에는 금액 순서대로 서고, 단상에는 서지 않는다', async () => {
    const account: CharacterTotals = {
      key: 'account:maple-a',
      ocid: null,
      accountId: 'maple-a',
      name: '메이플 ID · 본캐',
      incomeMeso: 700_000_000,
      expenseMeso: 0,
      netMeso: 700_000_000,
    }
    const view = await renderOverlay(<CharacterSection rows={[...rows, account]} images={images} />)

    const names = view.getAllByTestId(/^stats-character-row-/).map((row) => within(row).getByTestId('stats-character-name').props.children)
    expect(names).toEqual(['메이플 ID · 본캐', '낟넘', '지내우시', '단풍라떼', '낟낟'])
    expect(view.getByTestId('stats-podium-1').props.accessibilityLabel).toBe('1위 낟넘')
    expect(view.getByTestId('stats-podium-3').props.accessibilityLabel).toBe('3위 단풍라떼')
  })

  // 큰 모자 · 무기 · 날개가 그림 칸 밖으로 나가도 다 보여야 한다(사용자 지정 2026-11-07).
  it('단상 그림은 카드 안 어느 상자에서도 잘리지 않는다', async () => {
    const view = await 그리기()
    await 블록재기(view, { 1: 74, 2: 60, 3: 50 })

    const section = view.getByTestId('stats-characters')
    const clipped: string[] = []
    for (const image of view.getAllByTestId(/^stats-podium-image/, 숨김포함)) {
      for (let node = image.parent; node !== null && node !== section; node = node.parent) {
        if (flattenStyle(node.props.style).overflow === 'hidden') clipped.push(String(node.props.testID))
      }
    }

    expect(view.getAllByTestId(/^stats-podium-image/, 숨김포함)).toHaveLength(3)
    expect(clipped).toEqual([])
  })

  // 그림을 블록과 같은 칸에 넣으면 오른쪽 칸의 블록이 나중에 그려져 왼쪽 캐릭터의 무기를 가린다.
  it('그림 줄은 블록 셋보다 나중에 그리고 터치를 받지 않는다', async () => {
    const view = await 그리기()
    await 블록재기(view, { 1: 74, 2: 60, 3: 50 })

    const order = view
      .getAllByTestId(/^stats-podium-(block|image)/, 숨김포함)
      .map((node) => (String(node.props.testID).startsWith('stats-podium-block') ? '블록' : '그림'))
    expect(order).toEqual(['블록', '블록', '블록', '그림', '그림', '그림'])
    // 모자가 탭 버튼을 덮어도 탭은 눌려야 한다.
    expect(view.getByTestId('stats-podium-figures', 숨김포함).props.pointerEvents).toBe('none')
  })

  // 블록 높이는 닉네임 줄 수와 글자 크기 단계로 바뀐다. 재기 전에 세우면 그림이 블록 한가운데 겹쳐 선다.
  it('그림 발끝은 잰 블록 높이 위에 서고, 재기 전에는 서지 않는다', async () => {
    const view = await 그리기()
    expect(view.queryAllByTestId(/^stats-podium-image/, 숨김포함)).toHaveLength(0)

    await 블록재기(view, { 1: 74, 2: 60, 3: 50 })

    expect([1, 2, 3].map((rank) => 그림칸(view, rank).marginBottom)).toEqual([74, 60, 50])
  })

  // 그림끼리 겹치면 1위가 맨 앞이고 2위와 3위 사이에서는 3위가 앞이다(사용자 지정 2026-11-07).
  it('그림끼리 겹치면 1위 · 3위 · 2위 차례로 앞에 선다', async () => {
    const view = await 그리기()
    const z = (rank: number): number => Number(그림칸(view, rank).zIndex ?? 0)

    expect(z(1)).toBeGreaterThan(z(3))
    expect(z(3)).toBeGreaterThan(z(2))
  })

  // 한 블록만 줄이면 그 금액만 옆 금액보다 작아 보인다(사용자 지정).
  it('한 금액만 블록보다 길어도 단상 금액 셋이 같은 크기로 줄어든다', async () => {
    const view = await 그리기()
    const 폭 = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 15 } } })

    await act(async () => {
      fireEvent(view.getAllByTestId('stats-podium-amount')[0]!, 'layout', 폭(45))
      view.getAllByTestId('stats-podium-amount-measure', { includeHiddenElements: true }).forEach((measure, i) => {
        fireEvent(measure, 'layout', 폭(i === 0 ? 60 : 30))
      })
    })

    const sizes = view.getAllByTestId('stats-podium-amount').map((amount) => flattenStyle(amount.props.style).fontSize)
    expect(new Set(sizes).size).toBe(1)
    expect(sizes[0]).toBeLessThan(10)
  })
})

