/**
 * 카드가 서는 자리(`InputCardHost`)와 껍데기.
 *
 * 여기서 지키는 것은 **여는 길과 닫는 길**이다. 카드가 키보드 높이를 따라가는지는 jest 가 못 본다
 * (키보드 이벤트도 레이아웃도 안 온다). 그것은 실기기에서 재고 고른다.
 */
import { act, fireEvent } from '@testing-library/react-native'
import { BackHandler } from 'react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { openInputCard, useInputCardStore } from '../../../../features/input-card/store'

// 카드가 서는 자리는 **하네스가 앱 셸처럼 세워 둔다**. 여기서 또 세우면 카드가 둘이 된다.
async function 열기(onConfirm = jest.fn(), overrides = {}) {
  const view = await renderOverlay(<></>)
  await act(async () => {
    openInputCard({ label: '조각 개수', value: '', onConfirm, ...overrides })
  })
  return { view, onConfirm }
}

describe('InputCardHost', () => {
  afterEach(() => {
    useInputCardStore.setState({ request: null })
  })

  it('부탁이 없으면 아무것도 안 그린다', async () => {
    const view = await renderOverlay(<></>)

    expect(view.queryByTestId('input-card')).toBeNull()
  })

  it('칸을 맡기면 카드가 선다', async () => {
    const { view } = await 열기()

    expect(view.getByTestId('input-card-layer')).toBeTruthy()
    expect(view.getByText('조각 개수')).toBeTruthy()
  })

  it('확인은 값을 넘기고 카드를 닫는다', async () => {
    const { view, onConfirm } = await 열기()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '84')
    })
    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-confirm'))
    })

    expect(onConfirm).toHaveBeenCalledWith('84')
    expect(view.queryByTestId('input-card')).toBeNull()
  })

  it('닫기는 값을 안 넘기고 카드를 닫는다', async () => {
    const { view, onConfirm } = await 열기()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '84')
    })
    await act(async () => {
      fireEvent.press(view.getByTestId('input-card-close'))
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.queryByTestId('input-card')).toBeNull()
  })

  it('안드로이드 뒤로가기는 친 값을 버리고 거기서 끊는다', async () => {
    const 등록 = jest.spyOn(BackHandler, 'addEventListener')
    const { view, onConfirm } = await 열기()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('input-card-value'), '84')
    })
    const 뒤로 = 등록.mock.calls.at(-1)?.[1] as () => boolean
    let 끊었나 = false
    await act(async () => {
      끊었나 = 뒤로()
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.queryByTestId('input-card')).toBeNull()
    // 안 끊으면 카드와 시트가 함께 닫힌다.
    expect(끊었나).toBe(true)
    등록.mockRestore()
  })

  it('재는 방법을 바꿔도 카드는 같은 것을 그린다', async () => {
    const { view } = await 열기(jest.fn(), { tracking: 'reanimated', value: '84', unit: '개' })

    expect(view.getByTestId('input-card-value').props.value).toBe('84')
    expect(view.getByText('개')).toBeTruthy()
  })

  /**
   * 드롭 판매가가 아이템을 잇따라 받는다. 한 건을 끝내고 다음 건의 카드를 여는데, 앞 건에 치던
   * 값이 남으면 안 친 값이 저장된다.
   */
  describe('잇따라 여는 것', () => {
    async function 이어열기(second: Record<string, unknown> = {}) {
      const view = await renderOverlay(<></>)
      await act(async () => {
        openInputCard({
          label: '창세의 뱃지',
          value: '',
          onConfirm: () =>
            openInputCard({
              label: '루즈 컨트롤 머신 마크',
              value: '',
              onConfirm: jest.fn(),
              ...second,
            }),
        })
      })
      return view
    }

    it('확인 안에서 연 카드가 그대로 선다', async () => {
      const view = await 이어열기()

      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-confirm'))
      })

      expect(view.getByText('루즈 컨트롤 머신 마크')).toBeTruthy()
    })

    it('앞 카드에 친 값을 물고 오지 않는다', async () => {
      const view = await 이어열기()

      await act(async () => {
        fireEvent.changeText(view.getByTestId('input-card-value'), '3250000000')
      })
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-confirm'))
      })

      expect(view.getByTestId('input-card-value').props.value).toBe('')
    })

    /**
     * **카드를 다시 세우지 않는다**(사용자 지적). 다시 세우면 칸이 `autoFocus` 를 다시 걸어
     * 키보드가 닫혔다 열린다. 값만 다시 심으면 칸이 살아 있어 키보드가 그대로 있는다.
     *
     * 다시 세우나 안 세우나를 직접 볼 길이 없어 **상태가 살아남나**로 잰다. 다시 세우면 카드가
     * 든 것이 전부 프롭에서 다시 시작한다.
     */
    it('같은 부탁이 그대로면 치던 값이 안 흔들린다', async () => {
      const view = await renderOverlay(<></>)
      await act(async () => {
        openInputCard({ label: '창세의 뱃지', value: '', onConfirm: jest.fn() })
      })

      await act(async () => {
        fireEvent.changeText(view.getByTestId('input-card-value'), '100')
      })
      // 스크림을 눌러 다시 그리게 한다. 부탁은 그대로다.
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-scrim'))
      })

      expect(view.getByTestId('input-card-value').props.value).toBe('100')
    })

    /**
     * 글자 칸은 아톰이 `defaultValue` 로 심는다(한글 조합이 깨져서다). 그 값은 이미 선 칸에서는
     * 안 갈리므로 **글자 칸만 다시 세운다**. 지금 잇따라 여는 흐름은 숫자 칸뿐이지만, 글자 칸이
     * 그 흐름에 들면 안 친 글자가 저장된다.
     */
    it('글자 칸도 다음 카드의 씨앗으로 다시 심는다', async () => {
      const view = await renderOverlay(<></>)
      await act(async () => {
        openInputCard({
          label: '내용',
          text: true,
          value: '앞',
          onConfirm: () => openInputCard({ label: '내용', text: true, value: '뒤', onConfirm: jest.fn() }),
        })
      })
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-confirm'))
      })

      expect(view.getByTestId('input-card-value').props.defaultValue).toBe('뒤')
    })

    it('비율 고르개도 다음 카드의 씨앗으로 다시 심는다', async () => {
      // 내 비율이 1 이 아니라 카드가 `비율` 로 열린다(1 이면 인원 스테퍼가 선다).
      const 비율 = { label: '분배 비율', myShare: 2, sharesTotal: 3 }
      const view = await renderOverlay(<></>)
      await act(async () => {
        openInputCard({
          label: '창세의 뱃지',
          value: '',
          share: 비율,
          onConfirm: () =>
            openInputCard({ label: '루즈 컨트롤 머신 마크', value: '', share: 비율, onConfirm: jest.fn() }),
        })
      })

      await act(async () => {
        fireEvent.press(view.getByLabelText('분배 비율 비율 3'))
      })
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-confirm'))
      })

      expect(view.getByTestId('share-field-ratio-분배 비율')).toHaveTextContent('66.7%')
    })
  })
})
