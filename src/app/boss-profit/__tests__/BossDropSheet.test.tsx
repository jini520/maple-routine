// 드롭 기록 시트. 지키는 계약을 적는다.
//
// **라이브러리를 세워 둔다(`jest.mock`).** 진짜 `@gorhom/bottom-sheet` 은 레이아웃 측정과 UI 스레드
// 애니메이션 위에 서 있어 jest 에서 시트 내용이 아예 마운트되지 않는다(`BottomSheet.test.tsx` 가
// 적어 둔 사실). 껍데기가 값을 제대로 넘기는지는 그 파일이 보고, 여기서는
// **시트 안에서 무엇을 고르게 하는가**만 본다.
//
// 옮기지 않은 것 셋. ① 하단 바의 안전영역 패딩(**껍데기가
// 준다**) ② 입력 카드 **내부**(`organisms/InputCard` 의 테스트가 갖는다. 여기서는 카드가 그
// 아이템을 들고 열리는지와 값이 그 기록 하나에 붙는지만 본다) ③ 난이도 뱃지의 흐림 정도(값이
// 아니라 그림이라 육안 대조 목록).
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

// **드랍 연출도 세워 둔다.** 그 오버레이는 `requestAnimationFrame` 루프로 스프라이트를 돌리고
// loop 단계가 **설계상 무한**이라, jest 의 `requestAnimationFrame`
// 대역이 `setTimeout` 이라 테스트가 영원히 안 끝난다. 이 파일이 보는 것은 타일 선택과 `onSave` 라
// 연출은 대상이 아니다. 재생 순서는 `drop-effect-player.test.ts` 가 따로 본다.
// 목이 **같은 testID 를 낸다**. 이 파일에는 "연출이 뜨는가" 를 보는 케이스가 있고, 그 계약은
// 여전히 지켜야 한다. 세우는 것은 재생일 뿐 존재가 아니다.
jest.mock('../../../components/organisms/DropEffectOverlay/DropEffectOverlay', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    // `accessibilityLabel` 은 안 붙인다. 아이템 이름을 그대로 쓰면 같은 이름의 타일과 충돌해
    // `getByLabelText` 가 둘을 찾는다.
    DropEffectOverlay: () => React.createElement(View, { testID: 'drop-effect-overlay-modal' }),
  }
})

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
    // 시트 밖과 같게 둔다. 아톰이 이 값으로 **시트 안인가** 를 묻는다.
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다. 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    // 넘긴 것을 그대로 돌려준다. 시트가 무엇을 넘겼는지는 프롭에서 본다.
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { useDropEffectStore } from '../../../features/drop-effect/store'

import { installMemoryPreferences } from '../../../navigation/__tests__/memory-preferences'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { BossDropSheet } from '../BossDropSheet'

// 연출 토글은 전역 스토어라 케이스 사이 오염을 막기 위해 매번 기본값(연출 표시)으로 되돌린다.
// 토글은 저장소까지 내려가므로 포트도 함께 주입한다.
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
      bossKey="lotus"
      difficulty="hard"
      isComplete
      // 패치 전 주다. 교환권이 서고 소울 에테르가 안 선다.
      periodKey="2026-09-10"
      initialDrops={[]}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { result, onSave, onClose }
}

describe('BossDropSheet: 타일 선택', () => {
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
      {
        category: 'equipment',
        itemKey: 'loose_control_machine_mark',
        itemName: '루즈 컨트롤 머신 마크',
        slot: '얼굴장식',
        quantity: 1,
      },
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

describe('BossDropSheet: 난이도 표시', () => {
  it('완료면 난이도를 고를 수 없고 완료 난이도만 보여준다', async () => {
    const { result } = renderSheet()
    const { getAllByText, queryByLabelText } = await result

    // 고정 드롭 카드에도 난이도 뱃지가 있어 글자는 여럿이다. 여기서 보는 것은 **누를 수 있는가**다.
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

// 2026-09-17 패치. 시트는 그 행의 기간에 나오는 아이템과 고정 보상만 세운다.
describe('BossDropSheet: 기간', () => {
  // 패치는 09-17 오전 10시인데 그 주는 00:00 에 열린다. 시트는 시계까지 보므로 시계를 고정하지
  // 않으면 이 스위트가 하루의 어느 때에 도느냐로 답이 갈린다.
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-17T10:00:00+09:00'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('패치 뒤의 주에는 교환권 대신 소울 에테르가 선다', async () => {
    const { result } = renderSheet({ bossKey: 'kaling', difficulty: 'normal', periodKey: '2026-09-17' })
    const { getByLabelText, queryByLabelText } = await result

    expect(getByLabelText('1단계 소울 에테르')).toBeTruthy()
    expect(queryByLabelText('매지컬 무기 주문서 교환권')).toBeNull()
  })

  it('패치 전의 주는 그대로다', async () => {
    const { result } = renderSheet({ bossKey: 'kaling', difficulty: 'normal', periodKey: '2026-09-10' })
    const { getByLabelText, queryByLabelText } = await result

    expect(getByLabelText('매지컬 무기 주문서 교환권')).toBeTruthy()
    expect(queryByLabelText('1단계 소울 에테르')).toBeNull()
  })

  it('고정 보상도 그 주의 것을 보여 준다 (데미안 하드 메멘토 실버 큐브)', async () => {
    const 전 = await renderSheet({ bossKey: 'damien', difficulty: 'hard', periodKey: '2026-09-10' }).result
    expect(전.queryByLabelText('메멘토 실버 큐브')).not.toBeNull()

    const 후 = await renderSheet({ bossKey: 'damien', difficulty: 'hard', periodKey: '2026-09-17' }).result
    expect(후.queryByLabelText('메멘토 실버 큐브')).toBeNull()
  })
})

describe('BossDropSheet: 드롭 연출', () => {
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

describe('BossDropSheet: 상자 드릴다운', () => {
  it('반지 상자를 탭하면 반지와 등급을 골라 기록한다', async () => {
    const { result, onSave } = renderSheet({ bossKey: 'gloom', difficulty: 'chaos' })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('흑옥의 보스 반지 상자'))
    })
    // 드릴다운. 시트는 살아 있고 내용만 갈렸다.
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
        itemKey: 'restraint_ring',
        itemName: '리스트레인트 링',
        boxOriginKey: 'black_boss_ring_box',
        boxOrigin: '흑옥의 보스 반지 상자',
        ringLevel: 4,
      }),
    ])
  })

  it('결과가 지정된 상자를 다시 탭하면 드릴다운 없이 선택을 제거한다', async () => {
    const { result, onSave } = renderSheet({ bossKey: 'gloom', difficulty: 'chaos' })
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

    // 타일이 결과 아이템 이름으로 바뀌어 있다. 그걸 다시 누르면 제거다.
    await act(async () => {
      fireEvent.press(getByLabelText('리스트레인트 링'))
    })
    await act(async () => {
      fireEvent.press(getByText('추가 완료'))
    })

    expect(queryByText('이 결과로 기록')).toBeNull()
    expect(onSave).toHaveBeenCalledWith([])
  })

  // 타일은 기록의 key 로 찾은 지금 이름을 보인다. 적을 때의 이름이 달라도 따라온다.
  it('기록된 상자 결과는 적어 둔 이름이 아니라 key 로 찾은 이름으로 선다', async () => {
    const { result } = renderSheet({
      bossKey: 'gloom',
      difficulty: 'chaos',
      initialDrops: [
        {
          category: 'consumable',
          itemKey: 'restraint_ring',
          itemName: '옛 반지 이름',
          boxOriginKey: 'black_boss_ring_box',
          boxOrigin: '옛 상자 이름',
          ringLevel: 4,
          quantity: 1,
        },
      ],
    })
    const { getByLabelText, queryByLabelText } = await result

    expect(getByLabelText('리스트레인트 링').props.accessibilityState.selected).toBe(true)
    expect(queryByLabelText('옛 반지 이름')).toBeNull()
  })
})

// 이관이 이름을 못 찾아 key 가 빈 옛 기록. 판정할 key 가 없으므로 지우지 않는다(사용자 결정 2026-09-15).
describe('BossDropSheet: key 가 없는 옛 기록', () => {
  const 옛기록 = { category: 'consumable' as const, itemKey: null, itemName: '익셉셔널 해머', quantity: 1 }

  it('난이도를 바꿔도 남고 저장에 그대로 실린다', async () => {
    const { result, onSave } = renderSheet({ isComplete: false, initialDrops: [옛기록] })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('노멀'))
    })
    await act(async () => {
      fireEvent.press(getByText('추가 완료 · 1개'))
    })

    expect(onSave).toHaveBeenCalledWith([옛기록])
  })

  it('다른 타일을 골라도 옛 기록이 풀리지 않는다', async () => {
    const { result, onSave } = renderSheet({ initialDrops: [옛기록] })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('추가 완료 · 2개'))
    })

    expect(onSave).toHaveBeenCalledWith([옛기록, expect.objectContaining({ itemKey: 'loose_control_machine_mark' })])
  })
})

describe('BossDropSheet: 시트 안 가격 입력', () => {
  it('아이템을 기록하면 가격을 물어본다. 기록 자체는 막지 않는다', async () => {
    const { result } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByTestId, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })

    expect(getByTestId('drop-price-prompt')).toBeTruthy()
    // 기록은 이미 끝났다. 물음이 그것을 막지 않는다(탭 즉시 기록).
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
    const { result } = renderSheet({ bossKey: 'gloom', difficulty: 'chaos', pricing: PRICING })
    const { getByLabelText, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('거대한 공포'))
    })
    expect(getByText(/거대한 공포 기록됨/)).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('에스텔라 이어링'))
    })
    // 둘째를 찍으면 줄이 **외 1건** 으로 센다.
    expect(getByText(/에스텔라 이어링 외 1건 기록됨/)).toBeTruthy()
  })

  // 가운데 있던 가격 입력 시트를 걷었다. 누르기가 넷에서 둘이 된다.
  it('"가격 입력" 은 시트를 안 닫고 카드를 곧장 연다', async () => {
    const { result, onClose } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByTestId, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('가격 입력'))
    })

    expect(getByTestId('input-card-value')).toBeTruthy()
    expect(getByText('판매 가격')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    // 시트는 살아 있다. 카드를 닫으면 고르던 자리로 돌아온다.
    expect(getByText('추가 완료 · 1개')).toBeTruthy()
  })

  it('카드가 분배 인원을 함께 받는다. 씨앗은 그 보스의 기본 인원이다', async () => {
    const { result } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByTestId, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('가격 입력'))
    })

    expect(getByText('분배 인원')).toBeTruthy()
    expect(getByTestId('input-card-stepper-value').props.children).toBe('3인')
  })

  it('카드에서 값을 매기면 그 기록에만 붙는다. 배지가 그 사실을 말한다', async () => {
    const { result, onSave } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getAllByLabelText, getByTestId, getByText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('가격 입력'))
    })
    await act(async () => {
      fireEvent.changeText(getByTestId('input-card-value'), '100')
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-stepper-up'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-confirm'))
    })

    expect(getAllByLabelText('가격 입력됨')).toHaveLength(1)

    await act(async () => {
      fireEvent.press(getByText('추가 완료 · 1개'))
    })
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        itemKey: 'loose_control_machine_mark',
        itemName: '루즈 컨트롤 머신 마크',
        priceState: 'entered',
        priceMeso: 100,
        priceShare: 4,
      }),
    ])
  })

  it('카드의 기록 안함은 값 없이 그 결정만 쓴다', async () => {
    const { result, onSave } = renderSheet({ pricing: PRICING })
    const { getByLabelText, getByTestId, getByText, queryByLabelText } = await result

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크'))
    })
    await act(async () => {
      fireEvent.press(getByText('가격 입력'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-exclude'))
    })

    // 기록된 가격이 아니라 표식이 없다.
    expect(queryByLabelText('가격 입력됨')).toBeNull()

    await act(async () => {
      fireEvent.press(getByText('추가 완료 · 1개'))
    })
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ itemKey: 'loose_control_machine_mark', priceState: 'excluded' }),
    ])
  })

  describe('여러 건을 이어 받는다', () => {
    /** 장비 둘이 서는 보스. 둘을 찍어 놓고 연쇄를 본다. */
    async function 둘찍기() {
      const { result, onSave } = renderSheet({ bossKey: 'gloom', difficulty: 'chaos', pricing: PRICING })
      const view = await result
      await act(async () => {
        fireEvent.press(view.getByLabelText('거대한 공포'))
      })
      await act(async () => {
        fireEvent.press(view.getByLabelText('에스텔라 이어링'))
      })
      return { view, onSave }
    }

    it('둘 이상이면 확인 줄이 `외 n건` 으로 센다', async () => {
      const { view } = await 둘찍기()

      expect(view.getByText(/에스텔라 이어링 외 1건 기록됨/)).toBeTruthy()
    })

    it('저장하면 다음 미입력 건의 카드가 이어 선다', async () => {
      const { view } = await 둘찍기()

      await act(async () => {
        fireEvent.press(view.getByText('가격 입력'))
      })
      // 값을 안 매긴 첫 건이 먼저다. 찍은 차례가 곧 그 차례다.
      expect(view.getByTestId('input-card-context').props.children).toMatch(/거대한 공포/)
      expect(view.getByTestId('input-card-next')).toBeTruthy()

      await act(async () => {
        fireEvent.changeText(view.getByTestId('input-card-value'), '100')
      })
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-confirm'))
      })

      expect(view.getByTestId('input-card-context').props.children).toMatch(/에스텔라 이어링/)
    })

    it('마지막 건을 저장하면 카드가 닫힌다', async () => {
      const { view, onSave } = await 둘찍기()

      await act(async () => {
        fireEvent.press(view.getByText('가격 입력'))
      })
      for (const meso of ['100', '200']) {
        await act(async () => {
          fireEvent.changeText(view.getByTestId('input-card-value'), meso)
        })
        await act(async () => {
          fireEvent.press(view.getByTestId('input-card-confirm'))
        })
      }

      expect(view.queryByTestId('input-card-value')).toBeNull()

      await act(async () => {
        fireEvent.press(view.getByText('추가 완료 · 2개'))
      })
      expect(onSave).toHaveBeenCalledWith([
        expect.objectContaining({ itemName: '거대한 공포', priceMeso: 100 }),
        expect.objectContaining({ itemName: '에스텔라 이어링', priceMeso: 200 }),
      ])
    })

    /** 다음은 아무것도 안 쓴다. 친 값도 버린다(카드를 ✕ 로 닫는 것과 같은 규칙). */
    it('다음은 지금 건을 안 쓰고 넘긴다', async () => {
      const { view, onSave } = await 둘찍기()

      await act(async () => {
        fireEvent.press(view.getByText('가격 입력'))
      })
      await act(async () => {
        fireEvent.changeText(view.getByTestId('input-card-value'), '100')
      })
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-next'))
      })

      expect(view.getByTestId('input-card-context').props.children).toMatch(/에스텔라 이어링/)

      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-close'))
      })
      await act(async () => {
        fireEvent.press(view.getByText('추가 완료 · 2개'))
      })
      // 값도 결정도 안 붙었다. 둘 다 미입력으로 남는다.
      const saved = onSave.mock.calls[0]?.[0] as { itemName: string; priceState?: string }[]
      expect(saved.map((drop) => [drop.itemName, drop.priceState])).toEqual([
        ['거대한 공포', undefined],
        ['에스텔라 이어링', undefined],
      ])
    })

    it('하나뿐이면 다음 버튼이 안 선다', async () => {
      const { result } = renderSheet({ pricing: PRICING })
      const view = await result

      await act(async () => {
        fireEvent.press(view.getByLabelText('루즈 컨트롤 머신 마크'))
      })
      await act(async () => {
        fireEvent.press(view.getByText('가격 입력'))
      })

      expect(view.queryByTestId('input-card-next')).toBeNull()
    })
  })

  it('pricing 을 넘기지 않으면 물음도 배지도 뜨지 않는다. 가격 개념이 없는 호출부 보호', async () => {
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
          itemKey: 'loose_control_machine_mark',
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

  // 스킵은 "기록된 가격"이 아니므로 표식이 없다(= 미입력과 같은 얼굴). 가격의 세 상태 중
  // 이 화면이 가르는 것은 `entered` 하나뿐이고, 나머지 구분은 가격 기록 화면이 맡는다.
  it('스킵한 기록에는 수익 배지가 붙지 않는다', async () => {
    const { result } = renderSheet({
      pricing: PRICING,
      initialDrops: [
        {
          category: 'equipment',
          itemKey: 'loose_control_machine_mark',
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

describe('BossDropSheet: 타일 배치', () => {
  /**
   * 계열마다 **한 줄**이다. 4열로 접히던 시절에는 소비가 다섯을 넘으면 두 줄이 되어, 시트 높이가
   * 계열마다 몇 개냐에 달렸다.
   */
  it('계열마다 가로로 구르는 줄 하나를 둔다', async () => {
    const { result } = renderSheet()
    const { getByTestId } = await result

    const 장비 = getByTestId('drop-tile-row-equipment')
    expect(장비.props.horizontal).toBe(true)
    expect(getByTestId('drop-tile-row-consumable').props.horizontal).toBe(true)
  })

  it('타일은 72 폭으로 못박힌다. 굴러야 하므로 비율로 둘 수 없다', async () => {
    const { result } = renderSheet()
    const { getByLabelText } = await result

    expect(flattenStyle(getByLabelText('루즈 컨트롤 머신 마크').props.style)).toMatchObject({ width: 72 })
  })
})

describe('BossDropSheet: 고정 영역', () => {
  /** 배지가 자기 줄을 먹던 것을 합쳤다. 상자 안쪽 여백은 아이템 기준 위아래가 같다. */
  it('난이도 배지가 아이템과 같은 줄에 선다', async () => {
    const { result } = renderSheet({ bossKey: 'lotus', difficulty: 'hard' })
    const { getByTestId } = await result

    const 줄 = getByTestId('fixed-drop-row-hard')
    const style = flattenStyle(줄.props.style)
    expect(style).toMatchObject({ flexDirection: 'row' })
    expect(style.paddingTop).toBe(style.paddingBottom)
  })
})

describe('BossDropSheet: 드롭 데이터가 없는 보스', () => {
  it('빈 상태로 안내하고 타일을 만들지 않는다', async () => {
    const { result } = renderSheet({ bossKey: 'unknown_boss' })
    const { getByText } = await result

    expect(getByText('이 보스의 드롭 데이터가 아직 없습니다')).toBeTruthy()
  })
})
