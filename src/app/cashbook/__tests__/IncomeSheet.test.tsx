// 수입 기록 시트([[ADR-170]] 결정 1·6).
//
// 지출 시트와 **폼이 통째로 다르다** — 통화가 메소 하나뿐이라 시세도 관세도 수량도 없고,
// 갈래는 첫 칸의 **라벨만** 바꾼다.
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
    BottomSheetScrollView: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, props),
    // 시트 밖과 같게 둔다 — 아톰이 이 값으로 «시트 안인가» 를 묻는다([[ADR-170]] 정정 5).
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다 — 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { clearCountUpMemory } from '../../../lib/use-count-up'
import { IncomeSheet } from '../IncomeSheet'

// 큰 숫자의 카운트업 기억은 **모듈 수준**이라 케이스 사이로 샌다([[ADR-087]] 결정 8).
beforeEach(clearCountUpMemory)

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

/** 고르개가 실제로 고를 것이 있어야 «선택 안함» 이 기본이라는 말에 뜻이 생긴다. */
const 캐릭터둘 = [
  { ocid: 'ocid-1', name: '루디' },
  { ocid: 'ocid-2', name: '아델' },
]

async function 그리기(overrides: Partial<React.ComponentProps<typeof IncomeSheet>> = {}) {
  return renderOverlay(
    <IncomeSheet dateKey="2026-08-23" characters={캐릭터둘} onSave={jest.fn()} onClose={jest.fn()} {...overrides} />,
  )
}

async function 이름으로누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

async function 아이디로누르기(view: Rendered, testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID))
  })
}

/**
 * 큰 숫자를 **직접 치는** 갈래로 연다 — 아이템 판매의 큰 숫자는 합계라 못 친다([[ADR-170]]
 * 정정 9 ④). 금액 칸의 성질(콤마·자리표시자·키보드)은 그 갈래에서 본다.
 */
async function 사냥시트(): Promise<Rendered> {
  const view = await 그리기()
  await act(async () => {
    fireEvent.press(view.getByLabelText('사냥'))
  })
  return view
}

/** 아이템 판매의 치는 자리는 **판매 대금 칸**이다. */
async function 대금치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-gross'), text)
  })
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

/**
 * 금액 칸에 **친다** — OS 숫자 키보드다([[ADR-170]] 정정 4).
 *
 * 커서를 먼저 넣는다: 치는 것은 언제나 포커스가 있는 상태이고, 그때는 큰 숫자가 **친 값을 그대로**
 * 그린다([[ADR-173]] 결정 6 — 커서가 빠져야 굴러간다).
 */
async function 치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent(view.getByTestId('income-sheet-amount'), 'focus')
  })
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-amount'), text)
  })
}

describe('갈래', () => {
  it('사용자가 준 둘과 안전망 하나다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('아이템 판매')).toBeTruthy()
    expect(view.getByLabelText('사냥')).toBeTruthy()
    expect(view.getByLabelText('기타')).toBeTruthy()
  })

  // 폼은 하나다 — 갈래는 첫 칸의 라벨만 바꾼다([[ADR-170]] 결정 1).
  it('갈래가 첫 칸의 이름을 바꾼다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('판매 아이템')

    await 누르기(view, '사냥')

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('사냥터')
  })

  it('기타는 이름을 안 좁힌다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('내용')
  })
})

/**
 * 금액은 **OS 숫자 키보드**다([[ADR-170]] 정정 4) — 이 시트는 이름 칸 때문에 어차피 키보드를
 * 부르므로 앱 키패드를 안 부르는 이득이 없다. 배치는 [[ADR-173]] 이 다시 짰다: 큰 숫자는 화면에
 * 하나이고 저장 바로 위, 억/만은 그 밑 힌트 한 줄, 빠른 칩은 **키보드 위**.
 */
describe('금액 — OS 숫자 키보드다 ([[ADR-170]] 정정 4 · [[ADR-173]])', () => {
  it('앱 키패드를 안 그린다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('한 자리 지우기')).toBeNull()
    expect(view.queryByLabelText('00')).toBeNull()
  })

  it('숫자 키보드를 부른다 — 글자 키보드가 아니다', async () => {
    const view = await 사냥시트()

    expect(view.getByTestId('income-sheet-amount').props.keyboardType).toBe('number-pad')
  })

  it('친 값이 콤마째 선다', async () => {
    const view = await 사냥시트()

    await 치기(view, '1200')

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('1,200')
  })

  // 칸이 콤마를 그리므로 다음 타건은 콤마째 들어온다 — 그것을 걷어야 값이 안 깨진다.
  it('콤마가 섞여 들어와도 값이 안 깨진다', async () => {
    const view = await 사냥시트()

    await 치기(view, '1,2000')

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('12,000')
  })

  // 「0」 을 값으로 두면 그 뒤에 친 숫자가 붙어 자릿수가 하나 는다.
  it('0 이면 칸을 비우고 자리표시자로 「0」 을 둔다', async () => {
    const view = await 사냥시트()

    const 칸 = view.getByTestId('income-sheet-amount')
    expect(칸.props.value).toBe('')
    expect(칸.props.placeholder).toBe('0')
  })

  /**
   * **빠른 칩은 없다**([[ADR-173]] 결정 4 폐기, 사용자 지정 2026-08-26).
   *
   * 폼 안에 두면 저장과 이웃하고, 키보드 위로 내보내면 자리를 못 잡았다(라이브러리 슬롯) —
   * 시트 마지막 자식으로 붙여 본 뒤에도 판정은 *"별로다"* 였다. 자리를 세 번 옮겨도 안 나아지는
   * 것은 **없는 편이 낫다.**
   */
  it('빠른 칩이 없다 — 커서를 넣어도 안 뜬다', async () => {
    const view = await 사냥시트()

    await act(async () => {
      fireEvent(view.getByTestId('income-sheet-amount'), 'focus')
    })

    expect(view.queryByTestId('quick-add-bar')).toBeNull()
    expect(view.queryByLabelText('+1억')).toBeNull()
  })

  // 큰 숫자는 화면에 **하나**다([[ADR-173]] 결정 1) — 합계 카드가 없다.
  it('합계 카드가 없고 억/만은 힌트 한 줄이다', async () => {
    const view = await 사냥시트()
    await 치기(view, '1200000000')

    expect(view.getByTestId('income-sheet-amount-hint')).toHaveTextContent('12억')
  })

  it('금액이 0 이면 저장할 수 없다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

/**
 * **아이템 판매는 경매장 수수료를 뗀 값이 수입**이다([[ADR-170]] 정정 9, 사용자 지정 2026-08-27).
 *
 * 요율은 [[ADR-168]] 의 `FeePercent`(3·5 — [[ADR-006]] 사용자 확인값)를 그대로 쓰고, 계산도
 * `netProceedsMeso` 를 그대로 부른다. 여기서 다시 짜면 분배 계산기와 1 메소가 어긋난다.
 */
describe('판매 수수료 ([[ADR-170]] 정정 9)', () => {
  // 사냥 메소에는 경매장이 없고, 「기타」 에 붙이면 «무엇의 수수료인가» 가 안 읽힌다(정정 9 ②).
  it('판매 대금과 수수료 줄이 아이템 판매에만 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-gross')).toBeTruthy()
    expect(view.getByTestId('income-sheet-fee')).toBeTruthy()

    await 누르기(view, '사냥')
    expect(view.queryByTestId('income-sheet-gross')).toBeNull()
    expect(view.queryByTestId('income-sheet-fee')).toBeNull()

    await 누르기(view, '기타')
    expect(view.queryByTestId('income-sheet-gross')).toBeNull()
    expect(view.queryByTestId('income-sheet-fee')).toBeNull()
  })

  /**
   * **기본이 「없음」** 이다(정정 9 ②) — 직거래는 수수료가 없고, 셋 중 하나를 억지로 세우면
   * 시트를 열기만 해도 금액이 달라진다.
   */
  it('기본이 「없음」 이다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('없음').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('3%')).toBeTruthy()
    expect(view.getByLabelText('5%')).toBeTruthy()
  })

  /** 힌트도 큰 숫자와 같은 것을 적는다 — **받는 돈**이다. */
  it('요율을 고르면 합계가 받는 돈으로 내려간다', async () => {
    const view = await 그리기()
    await 대금치기(view, '1200000000')

    expect(view.getByTestId('income-sheet-amount-hint')).toHaveTextContent('12억')

    await 누르기(view, '5%')

    expect(view.getByTestId('income-sheet-amount-hint')).toHaveTextContent('11억 4,000만')
  })

  /**
   * **친 대금은 그 자리에 남는다**(정정 9 ④) — 요율을 껐다 켰다 해도 판매 대금이 안 부푼다.
   * 큰 숫자는 앱이 세는 합계라 **못 친다**([[ADR-173]] 결정 17 의 「기타」와 같은 모양).
   */
  it('판매 대금은 그 자리에 남고 합계는 못 친다', async () => {
    const view = await 그리기()
    await 대금치기(view, '1200000000')

    await 누르기(view, '5%')
    await 누르기(view, '3%')

    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1,200,000,000')
    // 못 치는 숫자는 칸이 아니라 글자다 — 초기화 버튼도 없다.
    expect(view.getByTestId('income-sheet-amount').props.value).toBeUndefined()
    expect(view.queryByLabelText('금액 초기화')).toBeNull()
  })

  /**
   * **받는 돈과 뗀 몫을 둘 다 박는다**(정정 9 ⑤) — 집계는 `mesoAmount` 한 칸만 보고, 판매 대금은
   * 「받는 돈 + 뗀 몫」 으로 되짚는다.
   */
  it('받는 돈과 뗀 몫을 함께 저장한다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 대금치기(view, '1200000000')
    await 누르기(view, '3%')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '아이템 판매',
      mesoAmount: 1_164_000_000,
      saleFeePercent: 3,
      saleFeeMeso: 36_000_000,
    })
  })

  // 갈래를 옮기면 **골라 둔 요율이 풀린다**(정정 9 ②) — 관세가 갈래를 옮길 때 꺼지는 것과 같다.
  it('갈래를 옮기면 요율이 풀린다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 대금치기(view, '1200000000')
    await 누르기(view, '5%')

    await 누르기(view, '사냥')
    await 누르기(view, '아이템 판매')

    expect(view.getByLabelText('없음').props.accessibilityState?.selected).toBe(true)
    await 누르기(view, '저장')
    expect(onSave.mock.calls[0][0]).toMatchObject({
      mesoAmount: 1_200_000_000,
      saleFeePercent: null,
      saleFeeMeso: null,
    })
  })
})

describe('저장', () => {
  it('갈래와 이름과 금액을 넘긴다 — 통화 칸이 없다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })

    await 누르기(view, '사냥')
    await 치기(view, '12')
    await 누르기(view, '저장')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toEqual({
      ocid: null,
      earnedOn: '2026-08-23',
      category: '사냥',
      item: null,
      mesoAmount: 12,
      // 사냥에는 수수료 줄이 아예 없다([[ADR-170]] 정정 9 ②) — 칸은 `null` 로 나간다.
      saleFeePercent: null,
      saleFeeMeso: null,
      memo: null,
    })
  })

  it('저장하면 닫는다', async () => {
    const onClose = jest.fn()
    const view = await 그리기({ onClose })

    await 대금치기(view, '1')
    await 누르기(view, '저장')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
/**
 * 캐릭터 귀속([[ADR-166]] 결정 3 — 사용자 말: *"캐릭터를 선택해서 입력하는 방법을 추가하는게
 * 좋을거 같아"*). 컬럼은 처음부터 있었고 **화면만 없었다**.
 *
 * **기본은 「선택 안함」**(사용자 지정 2026-08-26) — `ocid = null` 이 계정 단위다.
 */
describe('캐릭터 귀속 ([[ADR-166]] 결정 3)', () => {
  it('기본이 「선택 안함」 이다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-character-trigger')).toHaveTextContent('캐릭터선택 안함')
  })

  it('고르면 그 캐릭터로 저장한다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })

    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-ocid-2')
    await 대금치기(view, '1200')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ ocid: 'ocid-2' })
  })

  it('안 고르면 계정 단위로 저장한다 — `ocid` 가 `null` 이다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 대금치기(view, '1200')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ ocid: null })
  })
})

/**
 * **수정 모드에서는 «무엇인지» 를 못 바꾼다**([[ADR-173]] 결정 15, 사용자 지정 2026-08-26).
 * 갈래를 바꾸면 그 기록은 «다른 것» 이 된다 — 고치는 것이 아니라 새로 적는 것이다.
 */
describe('수정 모드 ([[ADR-173]] 결정 15)', () => {
  const 판매기록 = {
    id: 'inc-9',
    ocid: null,
    earnedOn: '2026-08-23',
    category: '아이템 판매' as const,
    item: '앱솔랩스 케이프',
    mesoAmount: 1_200_000_000,
    saleFeePercent: null,
    saleFeeMeso: null,
    memo: null,
    recordedAt: '2026-08-23T01:00:00.000Z',
  }

  // **제목이 «고른 것»** 이다(사용자 지정) — 수입은 고를 것이 갈래뿐이라 그것이 곧 제목이다.
  it('제목이 갈래이고 칩이 아예 없다', async () => {
    const view = await 그리기({ editing: 판매기록, onDelete: jest.fn() })

    expect(view.getByTestId('income-sheet-title')).toHaveTextContent('아이템 판매')
    expect(view.queryByText('수입 수정')).toBeNull()
    expect(view.queryByLabelText('사냥')).toBeNull()
  })

  it('세부는 그대로 고친다 — 이름·금액·캐릭터', async () => {
    const view = await 그리기({ editing: 판매기록, onDelete: jest.fn() })

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('판매 아이템')
    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1,200,000,000')
    expect(view.getByTestId('income-sheet-character-trigger')).toBeTruthy()
  })

  /**
   * **판매 대금이 정확히 되짚어진다**(정정 9 ⑤) — 「받는 돈 + 뗀 몫」 이다. 요율만 들고 역산하면
   * 내림 때문에 1 메소가 어긋나고, 고쳐 저장할 때마다 그 어긋남이 쌓인다.
   */
  it('뗀 몫을 되돌려 친 판매 대금을 세운다', async () => {
    const view = await 그리기({
      editing: { ...판매기록, mesoAmount: 1_140_000_000, saleFeePercent: 5, saleFeeMeso: 60_000_000 },
      onDelete: jest.fn(),
    })

    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1,200,000,000')
    expect(view.getByLabelText('5%').props.accessibilityState?.selected).toBe(true)
  })
})
