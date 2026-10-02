// 시트의 보스 목록. 보스는 캐릭터별로 묶이고, 차례는 그 묶음 안에서만 바꾼다(정정 17).
import { renderAtom } from '../../../components/__tests__/render-atom'
import type { PartyAppointmentBoss } from '../../../types/party-appointment'
import { AppointmentBossList, type AppointmentBossListProps } from '../AppointmentBossList'

let mock묶음프롭: Record<string, unknown>[] = []

// 정렬 라이브러리는 받은 프롭만 붙들고 줄은 그대로 그린다.
jest.mock('react-native-sortables', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: {
      Grid: (props: { data: unknown[]; renderItem: (p: { item: unknown; index: number }) => React.ReactNode }) => {
        mock묶음프롭.push(props as unknown as Record<string, unknown>)
        return React.createElement(React.Fragment, null, ...props.data.map((item, index) => props.renderItem({ item, index })))
      },
      Handle: (props: { children: React.ReactNode }) => props.children,
    },
  }
})

const 보스: PartyAppointmentBoss[] = [
  { bossKey: 'limbo', difficulty: 'hard', ocid: 'a' },
  { bossKey: 'jupiter', difficulty: 'normal', ocid: 'b' },
  { bossKey: 'kaling', difficulty: 'normal', ocid: 'a' },
]

function props(overrides: Partial<AppointmentBossListProps> = {}): AppointmentBossListProps {
  return {
    bosses: 보스,
    names: new Map([['a', '낟낟'], ['b', '낟넘']]),
    faces: new Map(),
    onChange: jest.fn(),
    onAdd: jest.fn(),
    ...overrides,
  }
}

describe('AppointmentBossList', () => {
  beforeEach(() => {
    mock묶음프롭 = []
  })

  it('캐릭터마다 머리 줄(이름 · 보스 수)이 서고 처음 고른 순서다', async () => {
    const view = await renderAtom(<AppointmentBossList {...props()} />)

    const order = view.getAllByText(/^(낟낟|낟넘|림보|유피테르|카링)$/).map((node) => node.props.children)
    expect(order).toEqual(['낟낟', '림보', '카링', '낟넘', '유피테르'])
    expect(view.getByText('보스 2')).toBeTruthy()
    expect(view.getByText('보스 1')).toBeTruthy()
  })

  it('보스 줄에 차례 숫자가 없다', async () => {
    const view = await renderAtom(<AppointmentBossList {...props()} />)

    expect(view.queryByText('1')).toBeNull()
    expect(view.queryByText('2')).toBeNull()
  })

  it('끌어서 바꾸는 차례는 그 캐릭터 묶음 안에서만이다', async () => {
    const onChange = jest.fn()
    await renderAtom(<AppointmentBossList {...props({ onChange })} />)

    const 낟낟줄 = mock묶음프롭[0]!
    ;(낟낟줄.onDragEnd as (p: { fromIndex: number; toIndex: number }) => void)({ fromIndex: 0, toIndex: 1 })

    expect(onChange.mock.calls[0][0].map((boss: PartyAppointmentBoss) => boss.bossKey)).toEqual(['kaling', 'limbo', 'jupiter'])
  })

  it('상세(읽기 모드)도 캐릭터별로 묶는다', async () => {
    const view = await renderAtom(<AppointmentBossList {...props({ readOnly: true })} />)

    const order = view.getAllByText(/^(낟낟|낟넘|림보|유피테르|카링)$/).map((node) => node.props.children)
    expect(order).toEqual(['낟낟', '림보', '카링', '낟넘', '유피테르'])
  })
})
