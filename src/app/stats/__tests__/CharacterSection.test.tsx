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

beforeEach(() => {
  installNoopNativePorts()
})

describe('CharacterSection', () => {
  it('순수익 탭은 순수익이 큰 순서이고 금액만 적는다', async () => {
    const view = await 그리기()

    const names = view.getAllByTestId(/^stats-character-row-/).map((row) => within(row).getByTestId('stats-character-name').props.children)
    expect(names).toEqual(['낟넘', '지내우시', '단풍라떼', '낟낟'])
    expect(within(view.getByTestId('stats-character-row-ocid:a')).getByTestId('stats-character-amount').props.children).toBe('−3.3억')
    expect(view.queryAllByTestId('stats-character-percent')).toHaveLength(0)
  })

  it('수익 탭은 수익이 있는 캐릭터만 서고 금액 앞에 %를 적는다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByLabelText('수익'))
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
      fireEvent.press(view.getByLabelText('수익'))
    })

    expect(within(줄()).getByTestId('stats-character-percent')).toBeTruthy()
    expect(within(줄()).getByTestId('stats-character-amount')).toBeTruthy()
    expect(줄().props.className).toBe(netClass)
  })

  it('단상은 그 탭의 상위 셋이고 그림이 있으면 세운다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('stats-podium-1').props.accessibilityLabel).toBe('1위 낟넘')
    expect(view.getByTestId('stats-podium-2').props.accessibilityLabel).toBe('2위 지내우시')
    expect(view.getByTestId('stats-podium-3').props.accessibilityLabel).toBe('3위 단풍라떼')
    expect(within(view.getByTestId('stats-podium-1')).getByTestId('stats-podium-image').props.source).toEqual({
      uri: 'https://img/b.png',
    })
    // 그림을 모르는 캐릭터는 흰 실루엣이 선다.
    expect(within(view.getByTestId('stats-podium-2')).queryByTestId('stats-podium-image')).toBeNull()
    expect(within(view.getByTestId('stats-podium-2')).getByTestId('stats-podium-image-unknown')).toBeTruthy()
  })

  // 발끝 아래에서 그림 칸이 잘리면 발이 단상 뒤로 숨는다. 그림 칸을 블록 위로 겹쳐 내리고 앞에 그린다.
  it('캐릭터 그림은 단상 블록에 겹쳐 내려 블록보다 앞에 선다', async () => {
    const view = await 그리기()

    const figure = flattenStyle(within(view.getByTestId('stats-podium-1')).getByTestId('stats-podium-figure').props.style)
    expect(figure.zIndex).toBeGreaterThan(0)
    expect(figure.marginBottom).toBeLessThan(0)
  })
})
