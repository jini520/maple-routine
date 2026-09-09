// 배지 사슬. 한 줄이 값 여럿을 진다.
//
// 고른 것은 알약이 되어 왼쪽에 쌓이고, 자리표시자는 **남은 것만** 읽는다. 여기서 보는 것은
// 그 두 규칙과, 알약을 눌러 그 단계를 다시 여는 길이다. 목록 자체의 동작은 `SelectField` 가
// 이미 본다.
import { useState } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

import { ChainSelect } from '../ChainSelect'
import { renderOverlay } from '../../../__tests__/render-atom'

const 캐릭터 = [
  { value: null, label: '선택 안함' },
  { value: 'ocid-1', label: '아이샤' },
]
const 지역 = [
  { value: null, label: '선택 안함' },
  { value: 'cernium', label: '세르니움' },
]

function 사슬(selected: { character: string | null; region: string | null }, onSelect = jest.fn()) {
  return (
    <ChainSelect
      testID="hunt-chain"
      steps={[
        { name: '캐릭터', options: 캐릭터, selected: selected.character, onSelect },
        { name: '지역', options: 지역, selected: selected.region, onSelect },
        { name: '사냥터', options: [], selected: null, onSelect },
      ]}
    />
  )
}

describe('ChainSelect: 고른 것은 배지로, 남은 것은 자리표시자로', () => {
  it('아무것도 안 골랐으면 이름 셋이 자리표시자에 선다', async () => {
    const { getByTestId, queryByTestId } = await renderOverlay(
      사슬({ character: null, region: null }),
    )

    expect(getByTestId('hunt-chain-placeholder').props.children).toBe('캐릭터 · 지역 · 사냥터 선택')
    expect(queryByTestId('hunt-chain-badge-캐릭터')).toBeNull()
  })

  it('고른 것은 배지가 되고 자리표시자에서 그 이름이 빠진다', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderOverlay(
      사슬({ character: 'ocid-1', region: null }),
    )

    expect(getByText('아이샤')).toBeTruthy()
    expect(getByTestId('hunt-chain-placeholder').props.children).toBe('지역 · 사냥터 선택')
    expect(queryByTestId('hunt-chain-badge-지역')).toBeNull()
  })

  /**
   * 방금 고른 값이 **어디에서 와서 어디에 놓였는지**를 눈이 따라가야 한다. 그래서 새 배지는
   * 고르는 자리인 오른쪽 끝에서 나와 제자리까지 미끄러진다.
   *
   * 여기서 잴 수 있는 것은 그 애니메이션을 배지에 걸었는가 뿐이다. 실제로 오른쪽에서 오는지는
   * 리애니메이티드가 UI 스레드에서 하는 일이라 사람이 본다.
   */
  it('새 배지는 오른쪽에서 미끄러져 들어온다', async () => {
    const { getByTestId } = await renderOverlay(사슬({ character: 'ocid-1', region: null }))
    const 배지 = getByTestId('hunt-chain-badge-캐릭터').parent

    expect(typeof 배지?.props.entering).toBe('function')
  })

  /**
   * 안 고른 단계에서 `선택 안함` 은 걷을 것이 없다. 목록만 닫힌다(`SelectField` 가 닫는다).
   * 종전에는 그 한 번으로 단계가 만진 것이 되어, 알약도 안 서면서 자리표시자에서 이름만 빠졌다.
   */
  it('안 고른 단계의 `선택 안함` 은 아무 일도 안 한다', async () => {
    const onSelect = jest.fn()
    const { getByTestId } = await renderOverlay(
      <ChainSelect
        testID="hunt-chain"
        steps={[
          { name: '지역', options: 지역, selected: null, onSelect },
          { name: '사냥터', options: [], selected: null, onSelect: jest.fn() },
        ]}
      />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-placeholder-trigger'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-option-'))
    })

    expect(onSelect).not.toHaveBeenCalled()
    expect(getByTestId('hunt-chain-placeholder').props.children).toBe('지역 · 사냥터 선택')
  })

  /**
   * 고른 단계의 `선택 안함` 은 **되돌리기**다. 알약이 사라지고 자리표시자가 그 이름을 되찾아
   * 그 단계를 다시 고를 수 있게 된다(사용자 지시).
   */
  it('고른 단계의 `선택 안함` 은 그 값을 걷는다', async () => {
    const onSelect = jest.fn()
    const { getByTestId } = await renderOverlay(
      <ChainSelect
        testID="hunt-chain"
        steps={[
          { name: '지역', options: 지역, selected: 'cernium', onSelect },
          { name: '사냥터', options: [], selected: null, onSelect: jest.fn() },
        ]}
      />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-badge-지역'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-option-'))
    })

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('다 골랐으면 자리표시자가 사라진다', async () => {
    const { queryByTestId, getByText } = await renderOverlay(
      <ChainSelect
        testID="hunt-chain"
        steps={[
          { name: '캐릭터', options: 캐릭터, selected: 'ocid-1', onSelect: jest.fn() },
          { name: '지역', options: 지역, selected: 'cernium', onSelect: jest.fn() },
        ]}
      />,
    )

    expect(queryByTestId('hunt-chain-placeholder')).toBeNull()
    expect(getByText('세르니움')).toBeTruthy()
  })

  /**
   * **알약을 누르면 그 단계가 다시 열린다.** 자리표시자를 누르면 아직 안 고른 첫 단계다.
   * 어느 쪽이든 목록은 줄 전체에 붙으므로 폭이 알약만큼 좁아지지 않는다.
   */
  it('배지를 누르면 그 단계의 목록이 열린다', async () => {
    const { getByTestId, getByLabelText } = await renderOverlay(
      사슬({ character: 'ocid-1', region: 'cernium' }),
    )

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-badge-캐릭터'))
    })

    expect(getByTestId('hunt-chain-list')).toBeTruthy()
    expect(getByLabelText('아이샤')).toBeTruthy()
  })

  it('자리표시자를 누르면 안 고른 첫 단계가 열린다', async () => {
    const { getByTestId, getByLabelText } = await renderOverlay(
      사슬({ character: 'ocid-1', region: null }),
    )

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-placeholder-trigger'))
    })

    expect(getByLabelText('세르니움')).toBeTruthy()
  })

  it('고르면 그 단계의 손잡이가 값을 받는다', async () => {
    const onSelect = jest.fn()
    const { getByTestId, getByLabelText } = await renderOverlay(
      사슬({ character: null, region: null }, onSelect),
    )

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-placeholder-trigger'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('아이샤'))
    })

    expect(onSelect).toHaveBeenCalledWith('ocid-1')
  })
})

/**
 * **앞을 안 고르면 뒤에 못 간다.** `선택 안함` 은 고른 것이 아니라 되돌린 것이라, 값이 빈 단계는
 * 언제나 자리표시자가 먼저 여는 자리다(사용자 지시).
 */
describe('ChainSelect: 앞 단계를 안 고르면 뒤에 못 간다', () => {
  it('안 고른 단계의 `선택 안함` 을 눌러도 그 자리에 머문다', async () => {
    const { getByTestId, getByLabelText } = await renderOverlay(
      사슬({ character: null, region: null }),
    )

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-placeholder-trigger'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-option-'))
    })
    expect(getByTestId('hunt-chain-placeholder').props.children).toBe('캐릭터 · 지역 · 사냥터 선택')

    // 다시 열어도 같은 단계다. 캐릭터를 고르기 전에는 지역 목록에 닿을 수 없다.
    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-placeholder-trigger'))
    })
    expect(getByLabelText('아이샤')).toBeTruthy()
  })

  /**
   * 되돌린 단계는 알약이 사라지고 자리표시자가 그 이름을 되찾는다. 값은 부르는 쪽이 드니
   * 여기서는 그 값을 든 껍데기를 세워 본다.
   */
  it('고른 단계를 되돌리면 알약이 사라지고 자리표시자가 그 이름을 되찾는다', async () => {
    function 껍데기(): React.JSX.Element {
      const [region, setRegion] = useState<string | null>('cernium')
      return (
        <ChainSelect
          testID="hunt-chain"
          steps={[
            { name: '캐릭터', options: 캐릭터, selected: 'ocid-1', onSelect: jest.fn() },
            { name: '지역', options: 지역, selected: region, onSelect: setRegion },
          ]}
        />
      )
    }
    const { getByTestId, queryByTestId } = await renderOverlay(<껍데기 />)
    expect(queryByTestId('hunt-chain-placeholder')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-badge-지역'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('hunt-chain-option-'))
    })

    expect(queryByTestId('hunt-chain-badge-지역')).toBeNull()
    expect(getByTestId('hunt-chain-placeholder').props.children).toBe('지역 선택')
  })
})
