// 레일의 계약. 칸 하나가 무엇을 그리는지는 `CharacterPortrait` 의 테스트가 든다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { PORTRAIT_RAIL } from '../../CharacterPortrait/portrait-metrics'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { CharacterRail, type CharacterRailEntry } from '../CharacterRail'

const onSelect = jest.fn()

beforeEach(() => {
  onSelect.mockClear()
})

function entry(overrides: Partial<CharacterRailEntry> = {}): CharacterRailEntry {
  return {
    ocid: 'ocid-1',
    characterName: '내옆에최성일',
    level: 285,
    imageUrl: 'https://open.api.nexon.com/character/1.png',
    rings: [
      { label: '일간', completed: 3, total: 7 },
      { label: '주간', completed: 1, total: 5 },
    ],
    ...overrides,
  }
}

// `renderAtom` 은 **await 해야 한다**. NativeWind 배선이 렌더를 비동기로 감싼다.
async function render(
  entries: CharacterRailEntry[],
  selectedOcid = 'ocid-1',
): Promise<Awaited<ReturnType<typeof renderAtom>>> {
  return renderAtom(
    <CharacterRail entries={entries} selectedOcid={selectedOcid} onSelect={onSelect} />,
  )
}

describe('CharacterRail', () => {
  it('추적 캐릭터마다 초상화를 하나씩 그린다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '두번째' })])

    expect(view.getAllByTestId('character-portrait')).toHaveLength(2)
  })

  // 드롭다운이 못 채운 계약. 누르면 실제로 바뀐다.
  it('초상화를 누르면 그 캐릭터의 ocid 로 onSelect 를 부른다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '두번째' })])

    // `act` 는 **await 해야 한다**. 안 하면 다음 테스트의 렌더까지 스코프가 섞여 트리가 비어 보인다
    // (뒤따르는 케이스 전부가 요소를 못 찾는 상태로 무너졌다).
    await act(async () => {
      fireEvent.press(view.getAllByTestId('character-portrait')[1])
    })

    expect(onSelect).toHaveBeenCalledWith('ocid-2')
  })

  // 고른 칸만 또렷하다는 것은 레일이 `selectedOcid` 를 칸마다 견주기 때문이다. 흐림의 세기 자체는
  // 초상화의 계약이라 그쪽 테스트가 든다.
  it('고른 칸만 또렷하고 나머지는 흐리다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '두번째' })])

    const [selected, dimmed] = view.getAllByTestId('character-portrait')
    expect(selected.props.style.opacity).toBe(1)
    expect(dimmed.props.style.opacity).toBeLessThan(1)
  })

  it('가로로 굴러가고 스크롤바를 그리지 않는다', async () => {
    const view = await render([entry()])

    const scroll = view.getByTestId('character-rail-scroll')
    expect(scroll.props.horizontal).toBe(true)
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false)
  })

  // 링이 없는 레일(관리 화면 둘)도 같은 간격을 쓴다. 값을 정하는 곳은
  // `PORTRAIT_RAIL` 이고 여기서 물을 것은 **레일이 그 값을 실제로 보는가** 다. 숫자를 손으로 적어
  // 두면 치수 표와 레일이 서로 다른 값을 믿는 상태가 조용히 만들어진다.
  it.each([
    ['링이 있어도', [{ label: '주간', completed: 1, total: 5 }] as CharacterRailEntry['rings']],
    ['링이 없어도', [] as CharacterRailEntry['rings']],
  ])('%s 같은 간격을 쓴다', async (_label, rings) => {
    const view = await render([entry({ rings })])

    const style = view.getByTestId('character-rail-scroll').props.contentContainerStyle as {
      gap: number
    }
    expect(style.gap).toBe(PORTRAIT_RAIL.gap)
  })
})

// 조회할 수 없게 된 캐릭터가 그냥 서 있으면 그 진행도가 지금의 사실처럼 읽힌다. 링은 마지막으로
// 본 값이라 지우지 않고 표식만 얹는다.
describe('조회 불가 표식', () => {
  it('참이면 칸에 표식이 붙는다', async () => {
    const { getByTestId } = await render([entry({ unavailable: true })])

    expect(getByTestId('portrait-unavailable')).toBeTruthy()
  })

  it('안 적으면 안 붙는다', async () => {
    const { queryByTestId } = await render([entry()])

    expect(queryByTestId('portrait-unavailable')).toBeNull()
  })

  it('표식이 붙어도 링은 그대로 읽힌다', async () => {
    const { getByLabelText } = await render([entry({ unavailable: true })])

    expect(getByLabelText(/일간 3\/7/)).toBeTruthy()
  })
})

// 고른 캐릭터가 바뀌는 것은 선택이다. 이미 고른 것을 다시 눌러도 바뀌는 것이 없다.
describe('캐릭터를 고를 때의 촉각', () => {
  const select = jest.fn(async () => undefined)

  beforeEach(() => {
    select.mockClear()
    setHapticsPort({ tap: async () => {}, select })
  })

  afterEach(__resetNativePortsForTest)

  it('다른 캐릭터를 누르면 한 번 난다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '헹글' })])

    await act(async () => {
      fireEvent.press(view.getByLabelText('헹글'))
    })

    expect(select).toHaveBeenCalledTimes(1)
  })

  it('이미 고른 캐릭터를 다시 눌러도 안 난다', async () => {
    const view = await render([entry(), entry({ ocid: 'ocid-2', characterName: '헹글' })])

    await act(async () => {
      fireEvent.press(view.getByLabelText('내옆에최성일'))
    })

    expect(select).not.toHaveBeenCalled()
  })
})
