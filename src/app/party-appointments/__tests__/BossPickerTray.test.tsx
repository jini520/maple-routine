// 보스 추가 단계의 선택 줄. 이미 고른 보스를 들고 들어오면 칸이 제자리에 바로 서야 한다.
import { act, fireEvent } from '@testing-library/react-native'
import { useState } from 'react'
import { Pressable } from 'react-native'

import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import type { PartyAppointmentBoss } from '../../../types/party-appointment'
import { BossPickerTray, type BossPickerTrayProps } from '../BossPickerTray'

let mock줄프롭: Record<string, unknown> | null = null
let mock묶음프롭: Record<string, unknown>[] = []

// 정렬 라이브러리는 받은 프롭만 붙든다. 여기서 보는 것은 무엇을 넘겼는가다.
jest.mock('react-native-sortables', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: {
      Flex: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
        mock줄프롭 = props
        mock묶음프롭.push(props)
        return React.createElement(React.Fragment, null, props.children)
      },
    },
  }
})

const 고른보스: PartyAppointmentBoss[] = [
  { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' },
  { bossKey: 'bardrix', difficulty: 'hard', ocid: 'ocid-1' },
]

function props(picked: PartyAppointmentBoss[]): BossPickerTrayProps {
  return {
    picked,
    names: new Map([['ocid-1', '낟낟'], ['ocid-2', '낟넘']]),
    faces: new Map(),
    flight: null,
    onFlightDone: jest.fn(),
    onReorder: jest.fn(),
    onPressItem: jest.fn(),
    onConfirm: jest.fn(),
  }
}

/** 목록을 바꿔 다시 그리는 하네스. `rerender` 는 테마 프로바이더를 벗겨 통째로 다시 마운트한다 */
function Harness(): React.JSX.Element {
  const [picked, setPicked] = useState(고른보스)
  return (
    <>
      <Pressable testID="첫 보스 빼기" onPress={() => setPicked((current) => current.slice(1))} />
      <BossPickerTray {...props(picked)} />
    </>
  )
}

describe('BossPickerTray: 칸 자리 움직임', () => {
  beforeEach(() => {
    mock줄프롭 = null
    mock묶음프롭 = []
  })

  // 단계를 바꾸는 동안 줄이 한 번 더 재어져, 자리 움직임을 켜 두면 칸이 넓게 섰다가 왼쪽으로 미끄러진다(사용자 보고).
  it('들고 들어온 목록에서는 칸 자리를 움직이지 않는다', async () => {
    await renderAtom(<BossPickerTray {...props(고른보스)} />)

    expect(mock줄프롭?.itemsLayoutTransitionMode).toBe('reorder')
  })

  // 빼거나 더해 목록이 바뀐 뒤에는 남은 칸이 새 자리로 미끄러진다.
  it('목록이 바뀐 뒤에는 칸 자리를 움직인다', async () => {
    const view = await renderAtom(<Harness />)

    await act(async () => {
      fireEvent.press(view.getByTestId('첫 보스 빼기'))
    })

    expect(mock줄프롭?.itemsLayoutTransitionMode).toBe('all')
  })
})

// 선택 줄도 캐릭터별로 묶인다. 끌어서 바꾸는 순서는 그 캐릭터 묶음 안에서만이다(정정 17).
describe('BossPickerTray: 캐릭터 묶음', () => {
  beforeEach(() => {
    mock묶음프롭 = []
  })

  const 섞인보스: PartyAppointmentBoss[] = [
    { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' },
    { bossKey: 'jupiter', difficulty: 'normal', ocid: 'ocid-2' },
    { bossKey: 'kaling', difficulty: 'normal', ocid: 'ocid-1' },
  ]

  it('캐릭터마다 이름 머리와 정렬 줄이 하나씩 선다', async () => {
    const view = await renderAtom(<BossPickerTray {...props(섞인보스)} />)

    expect(view.getByText('낟낟')).toBeTruthy()
    expect(view.getByText('낟넘')).toBeTruthy()
    expect(mock묶음프롭.slice(-2).map((one) => (one.children as unknown[]).length)).toEqual([2, 1])
  })

  it('묶음 안에서 끌어 옮기면 그 묶음만 바뀐 한 줄을 알린다', async () => {
    const onReorder = jest.fn()
    await renderAtom(<BossPickerTray {...props(섞인보스)} onReorder={onReorder} />)

    const 낟낟줄 = mock묶음프롭[mock묶음프롭.length - 2]!
    ;(낟낟줄.onDragEnd as (p: { fromIndex: number; toIndex: number }) => void)({ fromIndex: 0, toIndex: 1 })

    expect(onReorder.mock.calls[0][0].map((boss: PartyAppointmentBoss) => boss.bossKey)).toEqual(['kaling', 'limbo', 'jupiter'])
  })

  // 라이브러리가 칸을 재기 전에도 묶음 폭이 맞아야 한다. 0 이면 묶음이 접혀 둘째 칸이 옆 묶음 자리에 그려졌다가 제자리로 옮겨 갔다(사용자 보고).
  it('묶음마다 정렬 줄의 폭을 칸 수로 미리 정한다', async () => {
    const view = await renderAtom(<BossPickerTray {...props(섞인보스)} />)

    expect(flattenStyle(view.getByTestId('tray-group-ocid-1').props.style).width).toBe(2 * 50 + 10)
    expect(flattenStyle(view.getByTestId('tray-group-ocid-2').props.style).width).toBe(50)
  })

  // 캐릭터 색을 걷은 자리에 무채색 테두리는 밋밋해서, 그 보스의 난이도 색(난이도 배지의 테두리 색)으로 두른다(사용자 결정).
  it('초상 테두리는 그 보스의 난이도 색이다', async () => {
    const view = await renderAtom(<BossPickerTray {...props(섞인보스)} />)

    expect(flattenStyle(view.getByTestId('tray-ring-ocid-1:limbo').props.style).borderColor).toBe('#9c3a5c')
    expect(flattenStyle(view.getByTestId('tray-ring-ocid-2:jupiter').props.style).borderColor).toBe('#1f7690')
  })
})
