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
  // 레벨은 사냥 계산기가 쓴다([[ADR-175]] 결정 6) — 둘의 레벨을 갈라 두어야 «창이 캐릭터를
  // 따라 움직이는가» 를 잴 수 있다.
  { ocid: 'ocid-1', name: '루디', level: 294 },
  { ocid: 'ocid-2', name: '아델', level: 210 },
]

async function 그리기(overrides: Partial<React.ComponentProps<typeof IncomeSheet>> = {}) {
  return renderOverlay(
    <IncomeSheet
      dateKey="2026-08-23"
      characters={캐릭터둘}
      lastPointRate={null}
      onSave={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />,
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
 * 큰 숫자를 **직접 치는** 갈래로 연다 — 금액 칸의 성질(콤마·자리표시자·키보드)을 여기서 본다.
 *
 * 그 갈래가 「사냥」 이었는데 [[ADR-175]] 로 사냥이 **계산기**가 되면서(큰 숫자는 못 치는 합계다)
 * 「기타」로 옮겼다. 아이템 판매의 큰 숫자도 합계라 못 친다([[ADR-170]] 정정 9 ④) — 직접 치는
 * 갈래는 이제 「기타」 하나뿐이다.
 */
async function 직접치는시트(): Promise<Rendered> {
  const view = await 그리기()
  await act(async () => {
    fireEvent.press(view.getByLabelText('기타'))
  })
  return view
}

/** 아이템 판매의 치는 자리는 **판매 대금 칸**이다. */
async function 대금치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-gross'), text)
  })
}

/** 아이디로 집은 칸에 친다 — 큰 숫자가 아닌 폼 안의 입력들이다. */
async function 아이디로치기(view: Rendered, testID: string, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId(testID), text)
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

  // 갈래는 첫 칸의 라벨만 바꾼다([[ADR-170]] 결정 1) — **사냥만 빼고**([[ADR-175]] 결정 1).
  it('갈래가 첫 칸의 이름을 바꾼다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('판매 아이템')

    await 누르기(view, '기타')

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('내용')
  })

  // 사냥은 자유 입력이 아니라 **고르개 둘**이다([[ADR-175]] 결정 1) — 그 칸이 아예 안 선다.
  it('사냥에는 이름 칸이 없다 — 사냥터는 고르는 것이다', async () => {
    const view = await 그리기()

    await 누르기(view, '사냥')

    expect(view.queryByTestId('income-sheet-name-label')).toBeNull()
    expect(view.getByTestId('income-sheet-region-trigger')).toBeTruthy()
    expect(view.getByTestId('income-sheet-ground-trigger')).toBeTruthy()
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
    const view = await 직접치는시트()

    expect(view.getByTestId('income-sheet-amount').props.keyboardType).toBe('number-pad')
  })

  it('친 값이 콤마째 선다', async () => {
    const view = await 직접치는시트()

    await 치기(view, '1200')

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('1,200')
  })

  // 칸이 콤마를 그리므로 다음 타건은 콤마째 들어온다 — 그것을 걷어야 값이 안 깨진다.
  it('콤마가 섞여 들어와도 값이 안 깨진다', async () => {
    const view = await 직접치는시트()

    await 치기(view, '1,2000')

    expect(view.getByTestId('income-sheet-amount').props.value).toBe('12,000')
  })

  // 「0」 을 값으로 두면 그 뒤에 친 숫자가 붙어 자릿수가 하나 는다.
  it('0 이면 칸을 비우고 자리표시자로 「0」 을 둔다', async () => {
    const view = await 직접치는시트()

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
    const view = await 직접치는시트()

    await act(async () => {
      fireEvent(view.getByTestId('income-sheet-amount'), 'focus')
    })

    expect(view.queryByTestId('quick-add-bar')).toBeNull()
    expect(view.queryByLabelText('+1억')).toBeNull()
  })

  // 큰 숫자는 화면에 **하나**다([[ADR-173]] 결정 1) — 합계 카드가 없다.
  it('합계 카드가 없고 억/만은 힌트 한 줄이다', async () => {
    const view = await 직접치는시트()
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
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
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
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
    })
  })
})

describe('저장', () => {
  it('갈래와 이름과 금액을 넘긴다 — 통화 칸이 없다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })

    await 누르기(view, '기타')
    await 치기(view, '12')
    await 누르기(view, '저장')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toEqual({
      ocid: null,
      earnedOn: '2026-08-23',
      category: '기타',
      item: null,
      mesoAmount: 12,
      // 「기타」에는 수수료 줄이 아예 없다([[ADR-170]] 정정 9 ②) — 칸은 `null` 로 나간다.
      saleFeePercent: null,
      saleFeeMeso: null,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      // 계산기가 아니므로 사냥 칸 여섯은 안 실린다([[ADR-175]] 결정 9).
      hunt: null,
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
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    // 계산기 이전의 행이다([[ADR-175]] 결정 9).
    hunt: null,
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

/**
 * **수입에도 통화가 있다**([[ADR-170]] 정정 15) — 이벤트 보상이 메포·캐시로도 들어온다.
 *
 * 서는 자리는 **「기타」 하나**다(결정 2): 아이템 판매는 경매장이라 메소이고 사냥도 메소다.
 * 재는 규칙은 지출과 같다(결정 1) — 메포는 시세로 환산해 합계에 들고, 캐시는 안 든다.
 */
describe('통화 ([[ADR-170]] 정정 15)', () => {
  it('「기타」에만 통화 줄이 선다', async () => {
    const view = await 그리기()

    expect(view.queryByTestId('income-sheet-currency')).toBeNull()

    await 이름으로누르기(view, '기타')

    expect(view.getByTestId('income-sheet-currency')).toBeTruthy()
  })

  it('메포를 고르면 시세 줄이 서고, 시세가 없으면 저장이 막힌다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '기타')

    await 이름으로누르기(view, '메포')
    await 치기(view, '3000')

    expect(view.getByTestId('income-sheet-rate')).toBeTruthy()
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  it('메포는 메포 칸에 담기고 시세가 함께 실린다 — 메소 칸은 비운다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 이름으로누르기(view, '기타')
    await 이름으로누르기(view, '메포')
    await 치기(view, '3000')

    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      mesoAmount: null,
      pointAmount: 3_000,
      pointPer100mMeso: 1_180,
      cashAmount: null,
    })
  })

  it('캐시는 캐시 칸에 담기고 «환산하지 않는다» 고 말한다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 이름으로누르기(view, '기타')
    await 이름으로누르기(view, '캐시')
    await 치기(view, '15000')

    expect(view.getByTestId('income-sheet-amount-hint')).toHaveTextContent('캐시는 메소로 환산하지 않아요')

    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      mesoAmount: null,
      pointAmount: null,
      cashAmount: 15_000,
    })
  })

  it('수정으로 열면 찬 칸이 통화를 되짚는다', async () => {
    const view = await 그리기({
      editing: {
        id: 'inc-9',
        ocid: null,
        earnedOn: '2026-08-23',
        category: '기타' as const,
        item: '이벤트 보상',
        mesoAmount: null,
        saleFeePercent: null,
        saleFeeMeso: null,
        pointAmount: 3_000,
        pointPer100mMeso: 1_180,
        cashAmount: null,
        hunt: null,
        memo: null,
        recordedAt: '2026-08-23T01:00:00.000Z',
      },
      onDelete: jest.fn(),
    })

    expect(view.getByLabelText('메포').props.accessibilityState?.selected).toBe(true)
    expect(view.getByTestId('income-sheet-rate').props.value).toBe('1180')
  })
})

/**
 * **판매 대금 뒤에 단위를 적는다**([[ADR-170]] 정정 14 ④) — 큰 숫자가 수수료를 뗀 합계라
 * 이 줄과 축이 같은지 헷갈린다.
 */
describe('판매 대금의 단위 ([[ADR-170]] 정정 14 ④)', () => {
  it('메소라고 적는다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-gross-unit')).toHaveTextContent('메소')
  })
})

/**
 * 「사냥」 갈래는 **계산기**다 ([[ADR-175]]).
 *
 * 나머지 둘은 «얼마 벌었나» 를 사람이 알지만 사냥 메소는 맵이 정해지면 셀 수 있는 값이라 앱이
 * 낸다. 그래서 이 갈래에서만 줄이 여럿 서고 큰 숫자가 **못 치는 합계**가 된다.
 */
describe('사냥 계산기 ([[ADR-175]])', () => {
  /** 사냥 갈래를 열고 탈라하트 「밤의 길 3」(lv.294 · 40마리)까지 고른다. */
  async function 밤의길3(view: Rendered): Promise<void> {
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-tallahart')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')
    await 아이디로누르기(view, 'income-sheet-ground-option-밤의 길 3')
  }

  async function 루디고르기(view: Rendered): Promise<void> {
    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-ocid-1')
  }

  it('지역 목록이 **±20 안의 몬스터가 있는** 것만 선다 (결정 6)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    // 루디는 294 — 탈라하트(몬스터 290-294)는 들고 츄츄 아일랜드(210-219)는 안 든다.
    await 루디고르기(view)
    await 아이디로누르기(view, 'income-sheet-region-trigger')

    expect(view.getByTestId('income-sheet-region-option-tallahart')).toBeTruthy()
    expect(view.queryByTestId('income-sheet-region-option-chewChew')).toBeNull()
    // **적힌 범위로 재지 않는다**(사용자 지적 2026-08-28) — 소멸의 여로는 200-290 이라 겹침으로
    // 재면 떴는데, 거기 몬스터는 200-209 라 lv.294 가 골라도 0 이 나온다.
    expect(view.queryByTestId('income-sheet-region-option-roadOfVanishing')).toBeNull()
  })

  it('캐릭터를 안 고르면 **전부** 서고, 페널티가 0 이라고 말한다 (결정 6)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')

    expect(view.getByTestId('income-sheet-region-option-tallahart')).toBeTruthy()
    expect(view.getByTestId('income-sheet-region-option-chewChew')).toBeTruthy()
    // **조용히 후한 숫자를 내지 않는다** — 안 적으면 사용자는 그것이 참인 줄 안다.
    expect(view.getByTestId('income-sheet-hunt-level-notice')).toBeTruthy()
  })

  it('캐릭터를 고르면 그 안내가 걷힌다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 루디고르기(view)

    expect(view.queryByTestId('income-sheet-hunt-level-notice')).toBeNull()
  })

  it('캐릭터를 바꿔 창 밖으로 나간 지역은 **풀린다**', async () => {
    const view = await 그리기()
    await 밤의길3(view)
    expect(view.getByTestId('income-sheet-ground-trigger')).toHaveTextContent('사냥터밤의 길 3')

    // 아델은 210 — 탈라하트(290-294)가 창(190~230) 밖이다. 안 풀면 화면에는 다른 지역이
    // 적히는데 계산은 옛 사냥터로 도는 상태가 된다.
    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-ocid-2')

    // 지역이 풀리면 사냥터 고르개는 **고를 것이 없다**고 말한다 — 둘이 함께 풀린 증거다.
    expect(view.getByTestId('income-sheet-region-trigger')).toHaveTextContent('지역선택 안함')
    expect(view.getByTestId('income-sheet-ground-trigger')).toHaveTextContent(
      '사냥터지역을 먼저 고르세요',
    )
  })

  it('지역을 옮기면 사냥터가 풀린다 — 남의 맵으로 계산이 돌지 않는다', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-geardrak')

    expect(view.getByTestId('income-sheet-ground-trigger')).toHaveTextContent('사냥터선택 안함')
  })

  it('사냥터를 고르면 **획득 메소가 선다** — 사용자가 준 그 예시다', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    // 기본은 1소재(30분) · 효율 100% · 버프 없음 · 캐릭터 미선택(페널티 0).
    // 294 × 7.5 × 40 × 8 × 30 = 21,168,000
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('21,168,000')
  })

  it('고른 사냥터의 값이 **자기 줄**로 선다 — 포스 배지·레벨·마릿수 (결정 10)', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    expect(view.getByTestId('income-sheet-ground-detail')).toHaveTextContent('700lv.29440마리')
    // 배지의 읽어 주는 이름은 그림이 있든 없든 온전한 말이다.
    expect(view.getAllByLabelText('어센틱 포스 700').length).toBeGreaterThan(0)
  })

  it('소재를 늘리면 메소가 그만큼 는다 — 하나가 30분이다 (결정 7)', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    await 누르기(view, '소재 늘리기')

    expect(view.getByTestId('income-sheet-sojae')).toHaveTextContent('2')
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('42,336,000')
  })

  /**
   * **효율 조각은 맵이 정한다**([[ADR-175]] 결정 3, 사용자 지정 2026-08-28) — 고르는 것은 «몇
   * 마리를 놓치나» 이고 %는 그 결과다. 40마리에서 하나를 놓치면 98%, 22마리면 95% 다.
   */
  it('효율 조각이 **맵의 마릿수**에서 나온다', async () => {
    const view = await 그리기()
    await 밤의길3(view) // 40마리

    expect(view.getByLabelText('100%')).toBeTruthy()
    expect(view.getByLabelText('98%')).toBeTruthy() // 39/40
    expect(view.getByLabelText('95%')).toBeTruthy() // 38/40
    expect(view.getByLabelText('93%')).toBeTruthy() // 37/40
    expect(view.getByLabelText('90%')).toBeTruthy() // 36/40
    // 옛 고정 조각(85%)은 40마리에서 나오지 않는다.
    expect(view.queryByLabelText('85%')).toBeNull()
  })

  it('맵을 바꾸면 조각 글자가 다시 계산된다 — 고른 조각은 그대로다', async () => {
    const view = await 그리기()
    await 밤의길3(view)
    await 누르기(view, '95%') // 40마리에서 둘을 놓친다

    // 「풍화된 기쁨의 땅」 은 22마리(이 데이터의 최솟값) — 둘을 놓치면 20/22 = 91% 다.
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-roadOfVanishing')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')
    await 아이디로누르기(view, 'income-sheet-ground-option-풍화된 기쁨의 땅')

    expect(view.getByLabelText('91%').props.accessibilityState?.selected).toBe(true)
    expect(view.getByTestId('income-sheet-killed-mobs')).toHaveTextContent('20마리')
  })

  it('놓친 만큼 덜 잡는다 — 요약 줄의 마릿수가 준다 (사용자 지정)', async () => {
    const view = await 그리기()
    await 밤의길3(view)
    expect(view.getByTestId('income-sheet-killed-mobs')).toHaveTextContent('40마리')

    await 누르기(view, '95%') // 둘을 놓친다 → 38마리

    expect(view.getByTestId('income-sheet-killed-mobs')).toHaveTextContent('38마리')
    // 21,168,000 × 38/40
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('20,109,600')
  })

  /**
   * 사냥터 차례는 **레벨 차이가 적은 순, 같으면 마릿수가 많은 순**이다([[ADR-175]] 결정 6-1,
   * 사용자 지정 2026-08-28) — 참조표 순서를 그대로 쓰면 «지금 갈 만한 곳» 이 한가운데 묻힌다.
   */
  it('사냥터가 **레벨 차이 · 마릿수** 순으로 선다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 루디고르기(view) // 294
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-odium')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')

    const 이름들 = view
      .getAllByTestId(/^income-sheet-ground-option-/)
      .map((each) => each.props.testID.replace('income-sheet-ground-option-', ''))

    // 오디움은 몬스터가 270-274 이고 루디는 294 — 274 짜리가 가장 가깝다.
    // 첫 칸은 「선택 안함」(값이 `null` 이라 이름이 빈 글자다).
    expect(이름들.slice(0, 5)).toEqual([
      '',
      '잠긴 문 뒤 실험실 3', // 274 · 39마리
      '잠긴 문 뒤 실험실 4', // 274 · 39마리
      '잠긴 문 뒤 실험실 2', // 273-274 · 39마리
      '잠긴 문 뒤 실험실 1', // 273 · 34마리
    ])
    // 참조표에서 맨 앞이던 「성문으로 가는 길 1」(270)은 뒤로 밀린다.
    expect(이름들.indexOf('성문으로 가는 길 1')).toBeGreaterThan(10)
  })

  it('사냥터를 고르기 전에는 효율 줄이 안 선다 — 적을 글자가 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    expect(view.queryByTestId('income-sheet-efficiency')).toBeNull()
    expect(view.queryByLabelText('100%')).toBeNull()
  })

  it('아이템은 **합연산**이다 — 둘을 켜면 ×1.7 이다', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    await 누르기(view, '유니온의 부')
    await 누르기(view, '소형 재물 획득의 비약')

    // 21,168,000 × 1.7 = 35,985,600 (곱연산이면 38,102,400 이 된다)
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('35,985,600')
  })

  it('레벨 차이가 벌어지면 깎인다 (결정 4)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-odium')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')
    await 아이디로누르기(view, 'income-sheet-ground-option-성문으로 가는 길 1')

    // 캐릭터를 안 골랐으면 페널티가 0 이다: 270 × 7.5 × 34 × 8 × 30 = 16,524,000
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('16,524,000')

    // 루디는 294 — 몬스터가 24 낮으니 20% 에 5·6·7·8 을 더해 −46% 다. 오디움은 루디의 바닥
    // (274)에 걸쳐 있어 목록에 남는다 — 남으면서 가장 많이 깎이는 자리다.
    await 루디고르기(view)

    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('8,922,960')
  })

  it('**큰 숫자는 합계이고 못 친다** (결정 1)', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 밤의길3(view)

    // 조각 12개 × 800만 = 9,600만
    await 아이디로치기(view, 'income-sheet-fragments', '12')
    await 아이디로치기(view, 'income-sheet-fragment-price', '8000000')

    // `readOnly` 면 `AmountFigure` 가 입력이 아니라 글자를 그린다 — 「금액」 칸도 초기화도 없다.
    // (글자 자체는 굴러가는 도중값이라 단언할 것이 못 된다 — `useCountUp`.)
    expect(view.queryByLabelText('금액')).toBeNull()
    expect(view.queryByLabelText('금액 초기화')).toBeNull()

    // 그 합계가 얼마인지는 **저장이 넘기는 값**이 말한다: 21,168,000 + 96,000,000.
    await 이름으로누르기(view, '저장')
    expect(onSave.mock.calls[0][0]).toMatchObject({ mesoAmount: 117_168_000 })
  })

  /**
   * **조각은 스테퍼가 아니라 치는 칸이다**(사용자 지적 2026-08-28) — 30분에 10개 내외라
   * 8소재면 80개가 넘는데, 스테퍼로는 여든 번을 눌러야 한다.
   */
  it('조각을 한 번에 친다 — 스테퍼 버튼이 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    await 아이디로치기(view, 'income-sheet-fragments', '83')

    expect(view.getByTestId('income-sheet-fragments').props.value).toBe('83')
    expect(view.queryByLabelText('솔 에르다 조각 늘리기')).toBeNull()
    // 소재는 그대로 스테퍼다 — 0~여남은이라 누를 만하다.
    expect(view.getByLabelText('소재 늘리기')).toBeTruthy()
  })

  // 칸이 콤마를 그리므로 다음 타건은 콤마째 들어온다 — 조각 가격과 같은 파서를 쓴다.
  it('조각 칸도 콤마가 섞여 들어와 값이 안 깨진다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    await 아이디로치기(view, 'income-sheet-fragments', '1,2340')

    expect(view.getByTestId('income-sheet-fragments').props.value).toBe('12,340')
  })

  it('사냥터를 안 골라도 조각만으로 적을 수 있다 — 계산기가 반쯤 찬 상태다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '사냥')
    await 아이디로치기(view, 'income-sheet-fragments', '1')
    await 아이디로치기(view, 'income-sheet-fragment-price', '1000000')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ item: null, mesoAmount: 1_000_000 })
  })

  it('아무것도 안 고르면 저장이 안 된다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '사냥')
    await 이름으로누르기(view, '저장')

    expect(onSave).not.toHaveBeenCalled()
  })

  /**
   * **계산 입력을 함께 남긴다**(결정 9) — 없으면 수정 시트가 빈 계산기로 열려 만지는 순간
   * 금액이 덮인다([[ADR-171]] 결정 2 가 걸어 둔 계약).
   */
  it('저장이 계산 입력 여섯을 함께 넘긴다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 밤의길3(view)
    await 루디고르기(view)
    await 누르기(view, '90%') // 40마리에서 넷을 놓친다
    await 누르기(view, '유니온의 부')
    await 누르기(view, '소재 늘리기')
    await 아이디로치기(view, 'income-sheet-fragments', '35')
    await 아이디로치기(view, 'income-sheet-fragment-price', '8000000')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '사냥',
      // 사냥터는 `item` 에 이름 그대로 — 전역 유일이라 지역이 따라온다(결정 2).
      item: '밤의 길 3',
      ocid: 'ocid-1',
      hunt: {
        // **그때의** 레벨이다 — 캐릭터가 레벨업해도 이 기록의 금액은 안 흔들린다.
        characterLevel: 294,
        missedMobs: 4,
        boosts: ['union'],
        sojae: 2,
        fragments: 35,
        fragmentPrice: 8_000_000,
      },
    })
  })

  it('수정으로 열면 **저장해 둔 것이 그대로 선다** (결정 9)', async () => {
    const view = await 그리기({
      editing: {
        id: 'inc-h',
        ocid: 'ocid-1',
        earnedOn: '2026-08-23',
        category: '사냥' as const,
        item: '밤의 길 3',
        mesoAmount: 50_000_000,
        saleFeePercent: null,
        saleFeeMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        hunt: {
          characterLevel: 294,
          missedMobs: 3,
          boosts: ['union', 'potion'],
          sojae: 3,
          fragments: 7,
          fragmentPrice: 8_000_000,
        },
        memo: null,
        recordedAt: '2026-08-23T01:00:00.000Z',
      },
      onDelete: jest.fn(),
    })

    expect(view.getByTestId('income-sheet-region-trigger')).toHaveTextContent('지역탈라하트')
    expect(view.getByTestId('income-sheet-ground-trigger')).toHaveTextContent('사냥터밤의 길 3')
    // 저장된 것은 «셋을 놓쳤다» 이고, 40마리 맵이라 글자가 93% 로 선다.
    expect(view.getByLabelText('93%').props.accessibilityState?.selected).toBe(true)
    expect(view.getByTestId('income-sheet-killed-mobs')).toHaveTextContent('37마리')
    expect(view.getByLabelText('유니온의 부').props.accessibilityState?.selected).toBe(true)
    expect(view.getByTestId('income-sheet-sojae')).toHaveTextContent('3')
    expect(view.getByTestId('income-sheet-fragments').props.value).toBe('7')
    expect(view.getByTestId('income-sheet-fragment-price').props.value).toBe('8,000,000')
  })

  /**
   * **[[ADR-175]] 이전에 적힌 사냥 행**은 계산 입력이 없다(결정 9). 없는 입력을 지어내면
   * «내가 그렇게 골랐나» 가 되므로, 그때는 계산기가 아니라 종전 모양으로 연다.
   */
  it('옛 사냥 기록은 계산기가 아니라 **옛 모양**으로 열린다', async () => {
    const view = await 그리기({
      editing: {
        id: 'inc-old',
        ocid: null,
        earnedOn: '2026-08-23',
        category: '사냥' as const,
        item: '엘리시움',
        mesoAmount: 1_200_000_000,
        saleFeePercent: null,
        saleFeeMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        hunt: null,
        memo: null,
        recordedAt: '2026-08-23T01:00:00.000Z',
      },
      onDelete: jest.fn(),
    })

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('사냥터')
    expect(view.queryByTestId('income-sheet-region-trigger')).toBeNull()
    // 금액은 여전히 **친다** — 앱이 셀 근거가 그 행에 없다.
    expect(view.getByLabelText('금액')).toBeTruthy()
    expect(view.getByTestId('income-sheet-amount').props.value).toBe('1,200,000,000')
  })
})
