// 드롭 기록 시트 — 웹판 스무 케이스 중 **RN 에서 옮길 계약이 남은 것**을 다시 썼다.
//
// **라이브러리를 세워 둔다(`jest.mock`).** 진짜 `@gorhom/bottom-sheet` 은 레이아웃 측정과 UI 스레드
// 애니메이션 위에 서 있어 jest 에서 시트 내용이 아예 마운트되지 않는다(`BottomSheet.test.tsx` 가
// 실측해 적어 둔 사실). 껍데기가 [[ADR-039]] 값을 제대로 넘기는지는 그 파일이 보고, 여기서는
// **시트 안에서 무엇을 고르게 하는가**만 본다.
//
// 옮기지 않은 것 셋 — ① 하단 바의 안전영역 패딩(웹은 시트 내용이 직접 줬고 RN 은 **껍데기가
// 준다**) ② 가격 키패드 내부(step 8 몫 — 여기서는 그 자리로 들어갔다 나오는 흐름만 본다)
// ③ 난이도 뱃지의 흐림 정도(값이 아니라 그림이라 육안 대조 목록).
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

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

import { useDropEffectStore } from '@core/features/drop-effect/store'

import { installMemoryPreferences } from '../../../navigation/__tests__/memory-preferences'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { BossDropSheet } from '../BossDropSheet'

// 연출 토글은 전역 스토어라 케이스 사이 오염을 막기 위해 매번 기본값(연출 표시)으로 되돌린다.
// 토글은 저장소까지 내려가므로 포트도 함께 주입한다([[ADR-128]]).
beforeEach(() => {
  installMemoryPreferences()
  useDropEffectStore.setState({ enabled: true })
})

const PRICING = { defaultShare: 3, maxShare: 6, characterName: '지내우시' }

function renderSheet(overrides: Partial<React.ComponentProps<typeof BossDropSheet>> = {}) {
  const onSave = jest.fn()
  const onClose = jest.fn()
  const result = renderOverlay(
    <BossDropSheet
      boss="스우"
      difficulty="하드"
      isComplete
      initialDrops={[]}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { result, onSave, onClose }
}

describe('BossDropSheet — 타일 선택 ([[ADR-040]])', () => {
  it('일반 아이템을 토글하고 추가 완료 시 onSave 에 기록이 담긴다', async () => {
    const { result, onSave, onClose } = renderSheet()
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText(/추가 완료/))
    })

    expect(onSave).toHaveBeenCalledWith([
      { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it('다시 누르면 선택이 풀린다', async () => {
    const { result, onSave } = renderSheet()
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('추가 완료'))
    })

    expect(onSave).toHaveBeenCalledWith([])
  })

  it('고정 드롭은 읽기 전용이라 기록에 담기지 않는다', async () => {
    const { result, onSave } = renderSheet()
    const { getByText } = await result

    await act(async () => {
      fireEvent.press(getByText('추가 완료'))
    })

    expect(getByText('고정')).toBeTruthy()
    expect(onSave).toHaveBeenCalledWith([])
  })
})

describe('BossDropSheet — 난이도 표시 ([[ADR-044]])', () => {
  it('완료면 난이도를 고를 수 없고 완료 난이도만 보여준다', async () => {
    const { result } = renderSheet()
    const { getAllByText, queryByLabelText } = await result

    // 고정 드롭 카드에도 난이도 뱃지가 있어 글자는 여럿이다 — 여기서 보는 것은 **누를 수 있는가**다.
    expect(getAllByText('하드').length).toBeGreaterThan(0)
    expect(queryByLabelText('하드')).toBeNull()
    expect(queryByLabelText('노멀')).toBeNull()
  })

  it('미완료면 드롭 테이블 난이도를 선택 버튼으로 나열한다', async () => {
    const { result } = renderSheet({ isComplete: false })
    const { getByLabelText } = await result

    expect(getByLabelText('하드').props.accessibilityState.selected).toBe(true)
    expect(getByLabelText('노멀').props.accessibilityState.selected).toBe(false)
  })

  it('난이도를 바꾸면 그 난이도에 없는 선택은 초기화된다', async () => {
    const { result, onSave } = renderSheet({ isComplete: false })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('노멀'))
    })
    await act(async () => {
      fireEvent.press(getByText('추가 완료'))
    })

    expect(onSave).toHaveBeenCalledWith([])
  })
})

describe('BossDropSheet — 드롭 연출 ([[ADR-040]] 결정 6 · 정정 4)', () => {
  it('토글은 연출이 켜져 있을 때 켜짐이다(반전 회귀 방지)', async () => {
    const { result } = renderSheet()
    const { getByLabelText } = await result

    expect(getByLabelText('드롭 연출').props.accessibilityState.checked).toBe(true)
  })

  it('누르면 스토어 값이 뒤집힌다', async () => {
    const { result } = renderSheet()
    const { getByLabelText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('드롭 연출'))
    })

    expect(useDropEffectStore.getState().enabled).toBe(false)
  })

  it('연출이 꺼져 있으면 고가 아이템을 추가해도 오버레이가 뜨지 않는다', async () => {
    useDropEffectStore.setState({ enabled: false })
    const { result } = renderSheet()
    const { getByLabelText, queryByTestId } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })

    expect(queryByTestId('drop-effect-overlay-modal')).toBeNull()
  })

  it('연출이 켜져 있으면 고가 아이템 추가에 오버레이가 뜬다', async () => {
    const { result } = renderSheet()
    const { getByLabelText, getByTestId } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })

    expect(getByTestId('drop-effect-overlay-modal')).toBeTruthy()
  })
})

describe('BossDropSheet — 상자 드릴다운 ([[ADR-041]])', () => {
  it('반지 상자를 탭하면 반지와 등급을 골라 기록한다', async () => {
    const { result, onSave } = renderSheet({ boss: '더스크', difficulty: '카오스' })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('흑옥의 보스 반지 상자'))
    })
    // 드릴다운 — 시트는 살아 있고 내용만 갈렸다.
    expect(getByText('흑옥의 보스 반지 상자')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('리스트레인트 링'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('4레벨'))
    })
    await act(async () => {
      fireEvent.press(getByText('이 결과로 기록'))
    })
    await act(async () => {
      fireEvent.press(getByText(/추가 완료/))
    })

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        itemName: '리스트레인트 링',
        boxOrigin: '흑옥의 보스 반지 상자',
        ringLevel: 4,
      }),
    ])
  })

  it('결과가 지정된 상자를 다시 탭하면 드릴다운 없이 선택을 제거한다', async () => {
    const { result, onSave } = renderSheet({ boss: '더스크', difficulty: '카오스' })
    const { getByLabelText, getByText, queryByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('흑옥의 보스 반지 상자'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('리스트레인트 링'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('4레벨'))
    })
    await act(async () => {
      fireEvent.press(getByText('이 결과로 기록'))
    })

    // 타일이 결과 아이템 이름으로 바뀌어 있다 — 그걸 다시 누르면 제거다.
    await act(async () => {
      fireEvent.press(getByLabelText('리스트레인트 링'))
    })
    await act(async () => {
      fireEvent.press(getByText('추가 완료'))
    })

    expect(queryByText('이 결과로 기록')).toBeNull()
    expect(onSave).toHaveBeenCalledWith([])
  })
})

describe('BossDropSheet — 시트 안 가격 입력 ([[ADR-124]] 결정 6)', () => {
  it('아이템을 기록하면 가격을 물어본다 — 기록 자체는 막지 않는다', async () => {
    const { result } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByTestId, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })

    expect(getByTestId('drop-price-prompt')).toBeTruthy()
    // 기록은 이미 끝났다 — 물음이 그것을 막지 않는다([[ADR-040]] 탭 즉시 기록).
    expect(getByText('추가 완료 · 1개')).toBeTruthy()
  })

  it('"나중에" 를 누르면 물음만 사라지고 기록은 남는다', async () => {
    const { result } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByText, queryByTestId } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('나중에'))
    })

    expect(queryByTestId('drop-price-prompt')).toBeNull()
    expect(getByText('추가 완료 · 1개')).toBeTruthy()
  })

  it('다른 아이템을 이어 찍으면 물음이 그쪽으로 갈아탄다', async () => {
    // 한 난이도에 선택 가능한 장비가 둘인 보스라야 이 경우를 만들 수 있다.
    const { result } = renderSheet({ boss: '더스크', difficulty: '카오스', pricing: PRICING })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('거대한 공포'))
    })
    expect(getByText(/거대한 공포 기록됨/)).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('에스텔라 이어링'))
    })
    expect(getByText(/에스텔라 이어링 기록됨/)).toBeTruthy()
  })

  // 키패드 자체는 step 8 이 채운다 — 여기서 지키는 것은 **시트가 살아서 하던 작업을 잇는다** 는
  // 계약이다([[ADR-124]] 결정 6). 그 계약이 없으면 임시 구현이 시트를 닫는 형태로 흘러간다.
  it('"가격 입력" 은 시트를 닫지 않고 들어갔다가 그리드로 돌아온다', async () => {
    const { result, onClose } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByTestId, getByText, queryByTestId } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('가격 입력'))
    })

    expect(getByTestId('drop-price-pad-seam')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.press(getByLabelText('뒤로'))
    })

    expect(queryByTestId('drop-price-pad-seam')).toBeNull()
    expect(getByText('추가 완료 · 1개')).toBeTruthy()
  })

  it('pricing 을 넘기지 않으면 물음도 배지도 뜨지 않는다 — 가격 개념이 없는 호출부 보호', async () => {
    const { result } = renderSheet()
    const { getByLabelText, queryByTestId } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })

    expect(queryByTestId('drop-price-prompt')).toBeNull()
  })

  it('이미 값을 매긴 기록에는 타일 좌상단에 수익 배지가 붙는다', async () => {
    const { result } = renderSheet({
      pricing: PRICING,
      initialDrops: [
        {
          category: 'equipment',
          itemName: '루즈 컨트롤 머신 마크',
          slot: '얼굴장식',
          quantity: 1,
          priceState: 'entered',
          priceMeso: 100_000_000,
          priceShare: 3,
        },
      ],
    })
    const { getByLabelText } = await result

    expect(getByLabelText('가격 입력됨')).toBeTruthy()
  })

  // 스킵은 "기록된 가격"이 아니므로 표식이 없다(= 미입력과 같은 얼굴). [[ADR-124]] 의 세 상태 중
  // 이 화면이 가르는 것은 `entered` 하나뿐이고, 나머지 구분은 가격 기록 화면이 맡는다.
  it('스킵한 기록에는 수익 배지가 붙지 않는다', async () => {
    const { result } = renderSheet({
      pricing: PRICING,
      initialDrops: [
        {
          category: 'equipment',
          itemName: '루즈 컨트롤 머신 마크',
          slot: '얼굴장식',
          quantity: 1,
          priceState: 'excluded',
        },
      ],
    })
    const { queryByLabelText } = await result

    expect(queryByLabelText('가격 입력됨')).toBeNull()
  })
})

describe('BossDropSheet — 드롭 데이터가 없는 보스', () => {
  it('빈 상태로 안내하고 타일을 만들지 않는다', async () => {
    const { result } = renderSheet({ boss: '알 수 없는 보스' })
    const { getByText } = await result

    expect(getByText('이 보스의 드롭 데이터가 아직 없습니다')).toBeTruthy()
  })
})
