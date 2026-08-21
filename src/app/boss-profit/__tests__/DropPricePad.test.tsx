// 가격 입력 키패드([[ADR-124]] 결정 5) — **웹에는 이 파일이 없다**(키패드 케이스가 화면 테스트에
// 섞여 있었다). RN 에서는 두 자리(가격 기록 화면의 시트 · 드롭 시트의 드릴다운)가 같은 본문을
// 쓰므로 본문 계약을 여기 모아 두고, 두 호출부 테스트는 **그 자리로 들어갔다 나오는 흐름**만 본다.
//
// 여기서 지키는 것 넷
// ① 자릿수 전체가 주 표기다 — 억/만은 보조 줄이고 값이 0이면 그 줄이 **비되 자리는 남는다**
// ② **`0` 은 저장할 수 없다**([[ADR-124]]) — 미입력과 0원은 다른 사실이라 저장 버튼이 잠긴다
// ③ 대상이 갈리면 값이 그 아이템의 것으로 되돌아간다(순차 모드·드릴다운은 언마운트가 없다)
// ④ 스킵은 순차 모드에서만 뜨고 **아무것도 저장하지 않는다**(결정 6 정정)
import { useState, type ReactNode } from 'react'
import { Pressable } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'

// 시트 껍데기는 `BossDropSheet.test.tsx` 와 같은 이유로 세워 둔다(진짜 라이브러리는 레이아웃 측정
// 위에 서 있어 jest 에서 내용이 마운트되지 않는다).
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import weeklyBossesData from '@core/data/weekly-bosses.json'
import type { RecordedDrop } from '@core/types/drops'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { DropPricePad, DropPricePadContent } from '../DropPricePad'

// 보스 이름·난이도는 게임 레퍼런스 데이터에서 뽑는다([[ADR-006]] — 테스트가 베끼면 두 벌이 된다).
const 주간보스 = weeklyBossesData.weekly[0].boss

function 드롭(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', quantity: 1, ...overrides }
}

function renderPad(overrides: Partial<React.ComponentProps<typeof DropPricePadContent>> = {}) {
  const onSave = jest.fn()
  const onExclude = jest.fn()
  const result = renderOverlay(
    <DropPricePadContent
      drop={드롭()}
      boss={주간보스}
      difficulty="하드"
      characterName="지내우시"
      defaultShare={3}
      maxShare={6}
      onSave={onSave}
      onExclude={onExclude}
      {...overrides}
    />,
  )
  return { result, onSave, onExclude }
}

describe('DropPricePad — 금액 입력 ([[ADR-124]] 결정 5)', () => {
  it('키를 누른 순서대로 자릿수가 자란다 — 접지 않고 원시 표기다', async () => {
    const { result } = renderPad()
    const { getByLabelText, getByTestId } = await result

    for (const key of ['1', '2', '3', '00']) {
      await act(async () => {
        fireEvent.press(getByLabelText(key))
      })
    }

    expect(getByTestId('drop-price-amount').props.children).toBe('12,300')
  })

  it('억/만 환산은 보조 줄이고, 0이면 비되 자리는 남는다', async () => {
    const { result } = renderPad()
    const { getByText, queryByText } = await result

    // 값이 0인 동안에는 환산 문구가 없다 — 자리(높이)만 지킨다. 정확 일치로 묻는 이유는 단위 칩이
    // `+1억` 이라 부분 일치로는 칩이 걸리기 때문이다.
    expect(queryByText('1억')).toBeNull()

    await act(async () => {
      fireEvent.press(getByText('+1억'))
    })
    expect(queryByText('1억')).toBeTruthy()
  })

  it('⌫ 는 한 자리만 지우고 초기화는 통째로 지운다', async () => {
    const { result } = renderPad()
    const { getByLabelText, getByTestId, getByText } = await result

    await act(async () => {
      fireEvent.press(getByText('+100만'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('한 자리 지우기'))
    })
    expect(getByTestId('drop-price-amount').props.children).toBe('100,000')

    await act(async () => {
      fireEvent.press(getByLabelText('가격 초기화'))
    })
    expect(getByTestId('drop-price-amount').props.children).toBe('0')
  })

  // **미입력은 0원이 아니다**([[ADR-124]]) — 0을 저장할 수 있으면 "값을 매겼는데 0원"이라는
  // 없는 사실이 기록된다. 그래서 저장은 값이 있어야만 눌린다.
  it('0 은 저장할 수 없다', async () => {
    const { result, onSave } = renderPad()
    const { getByText } = await result

    expect(getByText('저장').parent?.props.accessibilityState.disabled).toBe(true)

    await act(async () => {
      fireEvent.press(getByText('저장'))
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('저장하면 금액과 분배 인원을 함께 넘긴다', async () => {
    const { result, onSave } = renderPad()
    const { getByText } = await result

    await act(async () => {
      fireEvent.press(getByText('+1억'))
    })
    await act(async () => {
      fireEvent.press(getByText('저장'))
    })

    expect(onSave).toHaveBeenCalledWith(100_000_000, 3)
  })
})

describe('DropPricePad — 분배 인원 ([[ADR-124]] 결정 2)', () => {
  it('기본값은 그 행의 파티원 수이고, 저장된 값이 있으면 그쪽이 이긴다', async () => {
    const { result } = renderPad()
    const { getByText } = await result
    expect(getByText('3인')).toBeTruthy()

    const 저장됨 = renderPad({
      drop: 드롭({ priceState: 'entered', priceMeso: 500, priceShare: 5 }),
    })
    const { getByText: getSaved } = await 저장됨.result
    expect(getSaved('5인')).toBeTruthy()
  })

  it('1 미만·최대 초과로는 못 간다', async () => {
    const { result } = renderPad({ defaultShare: 1, maxShare: 2 })
    const { getByLabelText, getByText } = await result

    expect(getByLabelText('분배 인원 감소').props.accessibilityState.disabled).toBe(true)

    await act(async () => {
      fireEvent.press(getByLabelText('분배 인원 증가'))
    })
    expect(getByText('2인')).toBeTruthy()
    expect(getByLabelText('분배 인원 증가').props.accessibilityState.disabled).toBe(true)
  })

  it('1인이면 1인당 금액을 말하지 않는다 — 나눌 상대가 없다', async () => {
    const { result } = renderPad({ defaultShare: 1 })
    const { getByText, queryByText } = await result

    await act(async () => {
      fireEvent.press(getByText('+1억'))
    })
    expect(queryByText(/1인당/)).toBeNull()
  })

  it('2인 이상이면 1인당 금액을 내림으로 보여준다', async () => {
    const { result } = renderPad({ defaultShare: 3 })
    const { getByText } = await result

    await act(async () => {
      fireEvent.press(getByText('+100만'))
    })
    expect(getByText('1인당 333,333 메소')).toBeTruthy()
  })
})

// 순차 모드와 드릴다운은 컴포넌트를 언마운트하지 않고 `drop` 만 갈아 끼운다 — 두지 않으면 앞
// 아이템에 치던 금액과 인원이 그대로 남아 다음 아이템에 얹힌다.
//
// **대상 교체를 `rerender` 로 하지 않는다** — 그것은 루트를 통째로 갈아치워 프로바이더까지 날린다
// (step 3 이 실측해 적어 둔 함정). 부모가 상태를 들고 버튼으로 바꾼다.
function PadHost(): React.JSX.Element {
  const [name, setName] = useState('루즈 컨트롤 머신 마크')
  return (
    <>
      <Pressable role="button" aria-label="다음 아이템" onPress={() => setName('가디언 엔젤 링')} />
      <DropPricePadContent
        drop={드롭({ itemName: name })}
        boss={주간보스}
        difficulty="하드"
        characterName="지내우시"
        defaultShare={3}
        maxShare={6}
        onSave={jest.fn()}
        onExclude={jest.fn()}
      />
    </>
  )
}

describe('DropPricePad — 대상이 갈리면 값이 따라간다', () => {
  it('다른 아이템으로 바뀌면 금액과 인원이 그 아이템의 것으로 되돌아간다', async () => {
    const { getByLabelText, getByTestId, getByText } = await renderOverlay(<PadHost />)

    await act(async () => {
      fireEvent.press(getByText('+1억'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('분배 인원 증가'))
    })
    expect(getByText('4인')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('다음 아이템'))
    })

    expect(getByTestId('drop-price-amount').props.children).toBe('0')
    expect(getByText('3인')).toBeTruthy()
  })
})

describe('DropPricePad — 기록 안함 · 스킵 ([[ADR-124]] 결정 6 정정)', () => {
  it('"기록 안함" 은 값 없이도 눌리고 결정을 올려보낸다', async () => {
    const { result, onExclude } = renderPad()
    const { getByText } = await result

    await act(async () => {
      fireEvent.press(getByText('기록 안함'))
    })
    expect(onExclude).toHaveBeenCalled()
  })

  it('스킵은 순차 모드에서만 뜨고 저장 버튼 문구도 함께 갈린다', async () => {
    const { result } = renderPad()
    const { queryByText, getByText } = await result
    expect(queryByText('스킵')).toBeNull()
    expect(getByText('저장')).toBeTruthy()

    const 순차 = renderPad({ onLater: jest.fn(), progress: { current: 1, total: 3 } })
    const { getByText: getSeq } = await 순차.result
    expect(getSeq('스킵')).toBeTruthy()
    expect(getSeq('다음')).toBeTruthy()
    expect(getSeq('1 / 3')).toBeTruthy()
  })

  it('스킵은 아무것도 저장하지 않는다 — 미입력에 그대로 둔다', async () => {
    const onLater = jest.fn()
    const { result, onSave, onExclude } = renderPad({ onLater, progress: { current: 1, total: 2 } })
    const { getByText } = await result

    await act(async () => {
      fireEvent.press(getByText('스킵'))
    })

    expect(onLater).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    expect(onExclude).not.toHaveBeenCalled()
  })
})

describe('DropPricePad — 두 자리가 같은 본문을 쓴다', () => {
  it('드릴다운(onBack)에만 뒤로 버튼이 있다', async () => {
    const { result } = renderPad()
    const { queryByLabelText } = await result
    expect(queryByLabelText('뒤로')).toBeNull()

    const 드릴다운 = renderPad({ onBack: jest.fn() })
    const { getByLabelText } = await 드릴다운.result
    expect(getByLabelText('뒤로')).toBeTruthy()
  })

  it('단독 시트는 같은 본문을 껍데기로 감싼다', async () => {
    const result = renderOverlay(
      <DropPricePad
        drop={드롭()}
        boss={주간보스}
        difficulty="하드"
        characterName="지내우시"
        defaultShare={3}
        maxShare={6}
        onSave={jest.fn()}
        onExclude={jest.fn()}
        onClose={jest.fn()}
      />,
    )
    const { getByTestId } = await result

    expect(getByTestId('drop-price-pad')).toBeTruthy()
    expect(getByTestId('drop-price-amount')).toBeTruthy()
  })
})
