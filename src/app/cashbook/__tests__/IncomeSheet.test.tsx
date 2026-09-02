// 수입 기록 시트.
//
// 지출 시트와 **폼이 통째로 다르다** — 통화가 메소 하나뿐이라 시세도 관세도 수량도 없고,
// 갈래는 첫 칸의 **라벨만** 바꾼다.
import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

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
    // 시트 밖과 같게 둔다 — 아톰이 이 값으로 «시트 안인가» 를 묻는다.
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다 — 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { IncomeSheet } from '../IncomeSheet'

// 큰 숫자의 카운트업 기억은 **모듈 수준**이라 케이스 사이로 샌다.

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

/** 고르개가 실제로 고를 것이 있어야 «선택 안함» 이 기본이라는 말에 뜻이 생긴다. */
const 캐릭터둘 = [
  // 레벨은 사냥 계산기가 쓴다 — 둘의 레벨을 갈라 두어야 «창이 캐릭터를
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
      // 기본은 **0** 이다 — 시절 테스트가 세는 금액을 흔들지 않는다.
      // 메획이 든 계산은 아래 describe 가 값을 직접 준다.
      loadMesoRate={async () => ({ kind: 'read' as const, percent: 0 })}
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
 * 금액 칸의 성질(글자·자리표시자·키보드)을 여기서 본다.
 *
 * 그 갈래가 「사냥」 이었는데 로 사냥이 **계산기**가 되면서(큰 숫자는 못 치는 합계다)
 * 「기타」로 옮겼다. 아이템 판매의 큰 숫자도 합계라 못 친다 — 직접 치는
 * 갈래는 이제 「기타」 하나뿐이다.
 */
async function 직접치는시트(): Promise<Rendered> {
  const view = await 그리기()
  await act(async () => {
    fireEvent.press(view.getByLabelText('기타'))
  })
  return view
}

/**
 * 「아이템 판매」로 연다 — **열자마자 그 갈래인 것이 아니다**.
 *
 * 기본 갈래는 차례의 첫째(`INCOME_CATEGORIES[0]`)이고 그것이 「사냥」 으로 바뀌었다. 판매 갈래의
 * 성질을 재는 케이스는 그래서 **칩을 한 번 누르고** 시작한다.
 */
async function 판매시트(
  overrides: Partial<React.ComponentProps<typeof IncomeSheet>> = {},
): Promise<Rendered> {
  const view = await 그리기(overrides)
  await act(async () => {
    fireEvent.press(view.getByLabelText('아이템 판매'))
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

/**
 *  이전에 적힌 사냥 행. 계산 입력이 없고(`hunt: null`) 사냥터 이름이 `item` 에 글자로
 * 들어 있다. 그 행을 어떻게 여는지가 이다.
 */
const 옛사냥행 = {
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
  quantity: null,
  memo: null,
  recordedAt: '2026-08-23T01:00:00.000Z',
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

/**
 * 「기타」가 치는 자리는 **금액 칸**이다 — 큰 숫자는 못 친다(결정 1).
 *
 * 합계는 `금액 × 수량` 이라 이 칸만 치면 수량 1 이 곱해져 친 값이 곧 합계가 된다.
 */
async function 치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-unit-price'), text)
  })
}

describe('갈래', () => {
  it('사용자가 준 둘과 안전망 하나다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('아이템 판매')).toBeTruthy()
    expect(view.getByLabelText('사냥')).toBeTruthy()
    expect(view.getByLabelText('기타')).toBeTruthy()
  })

  // 갈래는 첫 칸의 라벨만 바꾼다 — **사냥만 빼고**.
  it('갈래가 첫 칸의 이름을 바꾼다', async () => {
    const view = await 판매시트()

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('판매 아이템')

    await 누르기(view, '기타')

    expect(view.getByTestId('income-sheet-name-label')).toHaveTextContent('내용')
  })

  // 사냥은 자유 입력이 아니라 **고르개 둘**이다 — 그 칸이 아예 안 선다.
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
 * 금액은 **OS 숫자 키보드**다 — 이 시트는 이름 칸 때문에 어차피 키보드를
 * 부르므로 앱 키패드를 안 부르는 이득이 없다. 배치는 이 다시 짰다: 큰 숫자는 화면에
 * 하나이고 저장 바로 위, 억/만은 그 밑 힌트 한 줄.
 *
 * **치는 자리는 「금액」 칸**이다 — 큰 숫자는 그 곱을 그리기만 한다.
 */
describe('금액 — OS 숫자 키보드다', () => {
  it('앱 키패드를 안 그린다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('한 자리 지우기')).toBeNull()
    expect(view.queryByLabelText('00')).toBeNull()
  })

  it('숫자 키보드를 부른다 — 글자 키보드가 아니다', async () => {
    const view = await 직접치는시트()

    expect(view.getByTestId('income-sheet-unit-price').props.keyboardType).toBe('number-pad')
  })

  // 칸은 **친 글자 그대로**다 — 콤마는 밑의 큰 숫자가 단위로 대신한다.
  it('친 글자가 그대로 선다', async () => {
    const view = await 직접치는시트()

    await 치기(view, '1200')

    expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('1200')
    // 큰 숫자는 `금액 × 수량` 이고 수량 기본값이 1 이라 친 값이 곧 합계다.
    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('1200')
  })

  // 붙여넣기·자동완성이 숫자 아닌 것을 들여보낸다 — 그것을 걷어야 값이 안 깨진다.
  it('콤마가 섞여 들어와도 값이 안 깨진다', async () => {
    const view = await 직접치는시트()

    await 치기(view, '1,2000')

    expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('12000')
  })

  /**
   * **가운데를 고쳐도 칸이 안 비워진다**.
   *
   * 값에서 글자를 다시 만들던 때는 `80000000000` 에서 `8` 을 지운 `0000000000` 이 0 으로 접혀
   * 칸이 통째로 비었다 — 처음부터 다시 쳐야 했다(사용자 보고 2026-09-02).
   */
  it('앞자리를 지워도 나머지가 남는다 — 처음부터 다시 안 친다', async () => {
    const view = await 직접치는시트()
    await 치기(view, '80000000000')

    // 커서를 8 뒤에 두고 지운 결과가 이 글자다.
    await 치기(view, '0000000000')

    expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('0000000000')

    // 그 자리에 6 을 치면 원하던 값이 된다.
    await 치기(view, '60000000000')

    expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('60000000000')
  })

  // 정리는 **커서가 빠질 때**만 한다(결정 2) — 타건마다 하면 위의 편집이 다시 깨진다.
  it('커서가 빠지면 앞자리 0 을 걷는다', async () => {
    const view = await 직접치는시트()
    await 치기(view, '0000000000')

    await act(async () => {
      fireEvent(view.getByTestId('income-sheet-unit-price'), 'blur')
    })

    expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('')
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // 「0」 을 값으로 두면 그 뒤에 친 숫자가 붙어 자릿수가 하나 는다.
  it('0 이면 칸을 비우고 자리표시자로 「0」 을 둔다', async () => {
    const view = await 직접치는시트()

    const 칸 = view.getByTestId('income-sheet-unit-price')
    expect(칸.props.value).toBe('')
    expect(칸.props.placeholder).toBe('0')
  })

  /**
   * **빠른 칩은 없다**(폐기, 사용자 지정 2026-08-26).
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

  // 큰 숫자는 화면에 **하나**다 — 합계 카드도 힌트 줄도 없고, 억/만 환산은
  // 그 숫자가 직접 한다.
  it('합계 카드도 힌트 줄도 없고 큰 숫자가 억/만으로 접힌다', async () => {
    const view = await 직접치는시트()
    await 치기(view, '1200000000')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('12억')
    expect(view.queryByTestId('income-sheet-amount-hint')).toBeNull()
  })

  it('금액이 0 이면 저장할 수 없다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

/**
 * **아이템 판매는 경매장 수수료를 뗀 값이 수입**이다(사용자 지정 2026-08-27).
 *
 * 요율은 의 `FeePercent`(3·5 — 사용자 확인값)를 그대로 쓰고, 계산도
 * `netProceedsMeso` 를 그대로 부른다. 여기서 다시 짜면 분배 계산기와 1 메소가 어긋난다.
 */
describe('판매 수수료', () => {
  // 사냥 메소에는 경매장이 없고, 「기타」 에 붙이면 «무엇의 수수료인가» 가 안 읽힌다(정정 9 ②).
  it('판매 대금과 수수료 줄이 아이템 판매에만 선다', async () => {
    const view = await 판매시트()

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
    const view = await 판매시트()

    expect(view.getByLabelText('없음').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('3%')).toBeTruthy()
    expect(view.getByLabelText('5%')).toBeTruthy()
  })

  /** 큰 숫자가 적는 것은 **받는 돈**이다 — 판매 대금이 아니라 수수료를 뗀 값. */
  it('요율을 고르면 합계가 받는 돈으로 내려간다', async () => {
    const view = await 판매시트()
    await 대금치기(view, '1200000000')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('12억')

    await 누르기(view, '5%')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('11억 4천만')
  })

  /**
   * **친 대금은 그 자리에 남는다**(정정 9 ④) — 요율을 껐다 켰다 해도 판매 대금이 안 부푼다.
   * 큰 숫자는 앱이 세는 합계라 **못 친다**(의 「기타」와 같은 모양).
   */
  it('판매 대금은 그 자리에 남고 합계는 못 친다', async () => {
    const view = await 판매시트()
    await 대금치기(view, '1200000000')

    await 누르기(view, '5%')
    await 누르기(view, '3%')

    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1200000000')
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
    const view = await 판매시트({ onSave })
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

  /**
   * 갈래를 옮기면 **골라 둔 것이 통째로 풀린다**.
   *
   * 종전에는 요율만 손으로 풀고(정정 9 ②) 친 금액은 남았다 — 갈래마다 상태를 한 함수가 들고
   * 있었기 때문이다. 이제 갈래가 폼을 가르므로 옮기는 순간 **언마운트**되고, 지울 것을 손으로
   * 세지 않는다.
   */
  it('갈래를 옮기면 요율도 친 금액도 풀린다', async () => {
    const onSave = jest.fn()
    const view = await 판매시트({ onSave })
    await 대금치기(view, '1200000000')
    await 누르기(view, '5%')

    await 누르기(view, '사냥')
    await 누르기(view, '아이템 판매')

    expect(view.getByLabelText('없음').props.accessibilityState?.selected).toBe(true)
    // 친 금액도 함께 풀린다 — 그래서 저장이 아직 안 열린다(합계가 0 이다).
    expect(view.getByTestId('income-sheet-gross').props.value).toBe('')
    await 누르기(view, '저장')
    expect(onSave).not.toHaveBeenCalled()
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
      // 「기타」에는 수수료 줄이 아예 없다 — 칸은 `null` 로 나간다.
      saleFeePercent: null,
      saleFeeMeso: null,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      // 계산기가 아니므로 사냥 칸 여섯은 안 실린다.
      hunt: null,
      // 「기타」는 금액 × 수량이고 수량 기본값이 1 이다.
      quantity: 1,
      memo: null,
    })
  })

  it('저장하면 닫는다', async () => {
    const onClose = jest.fn()
    const view = await 판매시트({ onClose })

    await 대금치기(view, '1')
    await 누르기(view, '저장')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
/**
 * 캐릭터 귀속(— 사용자 말: *"캐릭터를 선택해서 입력하는 방법을 추가하는게
 * 좋을거 같아"*). 컬럼은 처음부터 있었고 **화면만 없었다**.
 *
 * **기본은 「선택 안함」**(사용자 지정 2026-08-26) — `ocid = null` 이 계정 단위다.
 */
describe('캐릭터 귀속', () => {
  it('기본이 「선택 안함」 이다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('income-sheet-character-trigger')).toHaveTextContent('캐릭터선택 안함')
  })

  it('고르면 그 캐릭터로 저장한다', async () => {
    const onSave = jest.fn()
    const view = await 판매시트({ onSave })

    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-ocid-2')
    await 대금치기(view, '1200')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ ocid: 'ocid-2' })
  })

  it('안 고르면 계정 단위로 저장한다 — `ocid` 가 `null` 이다', async () => {
    const onSave = jest.fn()
    const view = await 판매시트({ onSave })
    await 대금치기(view, '1200')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ ocid: null })
  })
})

/**
 * **수정 모드에서는 «무엇인지» 를 못 바꾼다**(사용자 지정 2026-08-26).
 * 갈래를 바꾸면 그 기록은 «다른 것» 이 된다 — 고치는 것이 아니라 새로 적는 것이다.
 */
describe('수정 모드', () => {
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
    // 계산기 이전의 행이다.
    hunt: null,
    quantity: null,
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
    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1200000000')
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

    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1200000000')
    expect(view.getByLabelText('5%').props.accessibilityState?.selected).toBe(true)
  })
})

/**
 * **수입에도 통화가 있다** — 이벤트 보상이 메포·캐시로도 들어온다.
 *
 * 서는 자리는 **「기타」 하나**다(결정 2): 아이템 판매는 경매장이라 메소이고 사냥도 메소다.
 * 재는 규칙은 지출과 같다(결정 1) — 메포는 시세로 환산해 합계에 들고, 캐시는 안 든다.
 */
describe('통화', () => {
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

    // 「캐시는 메소로 환산하지 않아요」 줄은 가 걷었다. 캐시가 메소 축에 안
    // 든다는 사실은 저장된 칸(`cashAmount` 만 참)이 말한다.
    expect(view.queryByTestId('income-sheet-amount-hint')).toBeNull()

    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      mesoAmount: null,
      pointAmount: null,
      cashAmount: 15_000,
    })
  })

  /**
   * 「기타」는 **금액 × 수량**이다 — 지출 「기타」와 같은 식이다.
   *
   * 수량은 `income_records.quantity` 에 박힌다(결정 4). 안 남기면 그 행을 다시 열 때 되짚을 길이
   * 없어 수량이 1 로 서고 금액 칸에 총액이 들어간다 — 사용자가 안 적은 값을 적은 값처럼 보여 준다.
   */
  describe('금액 × 수량', () => {
    it('수량을 올리면 큰 숫자가 곱이 되고 총액이 저장된다', async () => {
      const onSave = jest.fn()
      const view = await 그리기({ onSave })
      await 이름으로누르기(view, '기타')
      await 치기(view, '30000000')

      await 이름으로누르기(view, '수량 늘리기')

      expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('6천만')

      await 이름으로누르기(view, '저장')

      // 통화 칸에는 **곱한 총액**이 들어가고 수량은 자기 칸에 남는다.
      expect(onSave.mock.calls[0][0]).toMatchObject({ mesoAmount: 60_000_000, quantity: 2 })
    })

    it('수정으로 열면 금액을 되짚는다 — `총액 ÷ 수량` 이다', async () => {
      const view = await 그리기({
        editing: {
          id: 'inc-q',
          ocid: null,
          earnedOn: '2026-08-23',
          category: '기타' as const,
          item: '이벤트 보상',
          mesoAmount: 60_000_000,
          saleFeePercent: null,
          saleFeeMeso: null,
          pointAmount: null,
          pointPer100mMeso: null,
          cashAmount: null,
          hunt: null,
          quantity: 2,
          memo: null,
          recordedAt: '2026-08-23T05:00:00.000Z',
        },
        onDelete: jest.fn(),
      })

      // 총액(60,000,000)을 그대로 금액 칸에 넣으면 저장 한 번에 1.2억이 된다.
      expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('30000000')
      expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('6천만')
    })

    // 이 칸이 없던 시절의 행 — `quantity` 가 `null` 이라 수량 1 로 열리고 총액이 곧 금액이다.
    it('수량이 없는 옛 행은 수량 1 로 열린다 — 금액이 안 바뀐다', async () => {
      const view = await 그리기({
        editing: {
          id: 'inc-old',
          ocid: null,
          earnedOn: '2026-08-23',
          category: '기타' as const,
          item: '이벤트 보상',
          mesoAmount: 15_000,
          saleFeePercent: null,
          saleFeeMeso: null,
          pointAmount: null,
          pointPer100mMeso: null,
          cashAmount: null,
          hunt: null,
          quantity: null,
          memo: null,
          recordedAt: '2026-08-23T05:00:00.000Z',
        },
        onDelete: jest.fn(),
      })

      expect(view.getByTestId('income-sheet-unit-price').props.value).toBe('15000')
      expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('1만 5000')
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
        quantity: null,
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
 * **판매 대금 뒤에 단위를 적는다** — 큰 숫자가 수수료를 뗀 합계라
 * 이 줄과 축이 같은지 헷갈린다.
 */
describe('판매 대금의 단위', () => {
  it('메소라고 적는다', async () => {
    const view = await 판매시트()

    expect(view.getByTestId('income-sheet-gross-unit')).toHaveTextContent('메소')
  })
})

/**
 * 「사냥」 갈래는 **계산기**다.
 *
 * 나머지 둘은 «얼마 벌었나» 를 사람이 알지만 사냥 메소는 맵이 정해지면 셀 수 있는 값이라 앱이
 * 낸다. 그래서 이 갈래에서만 줄이 여럿 서고 큰 숫자가 **못 치는 합계**가 된다.
 */
/**
 * 갈래마다 **자기 폼**이다.
 *
 * 한 함수가 갈래 셋의 상태를 전부 들고 조건문으로 그리던 것이 «갈래를 옮겨도 값을 들고 다닌다» 의
 * 원인이었다(사용자 보고 2026-08-29). 이제 갈래가 폼을 가르므로 옮기면 언마운트된다.
 */
describe('갈래마다 자기 폼', () => {
  async function 루디고르기(view: Rendered): Promise<void> {
    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-ocid-1')
  }

  it('고른 캐릭터가 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 루디고르기(view)
    expect(view.getByTestId('income-sheet-character-trigger')).toHaveTextContent('캐릭터루디')

    await 누르기(view, '아이템 판매')

    expect(view.getByTestId('income-sheet-character-trigger')).toHaveTextContent('캐릭터선택 안함')
  })

  it('고른 지역·사냥터가 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-tallahart')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')
    await 아이디로누르기(view, 'income-sheet-ground-option-밤의 길 3')
    expect(view.getByTestId('income-sheet-ground-trigger')).toHaveTextContent('사냥터밤의 길 3')

    await 누르기(view, '기타')
    await 누르기(view, '사냥')

    expect(view.getByTestId('income-sheet-region-trigger')).toHaveTextContent('지역선택 안함')
    expect(view.getByTestId('income-sheet-ground-trigger')).toHaveTextContent('사냥터지역을 먼저 고르세요')
  })

  it('「기타」의 통화도 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 누르기(view, '기타')
    await 누르기(view, '캐시')
    expect(view.getByLabelText('캐시').props.accessibilityState?.selected).toBe(true)

    await 누르기(view, '사냥')
    await 누르기(view, '기타')

    expect(view.getByLabelText('메소').props.accessibilityState?.selected).toBe(true)
  })
})

describe('사냥 계산기', () => {
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

  it('캐릭터를 안 고르면 지역이 **전부** 선다 (결정 6)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')

    expect(view.getByTestId('income-sheet-region-option-tallahart')).toBeTruthy()
    expect(view.getByTestId('income-sheet-region-option-chewChew')).toBeTruthy()
  })

  /**
   * **안내 줄은 걷었다**(정정, 사용자 지정 2026-08-29).
   *
   * «캐릭터를 고르면 레벨 차이가 반영돼요» 한 줄이 계산기 한가운데 상시로 서 있었다. 캐릭터
   * 고르개가 바로 위에 **비어 있는 채로** 있으므로 그 사실은 이미 화면에 있고, 문장은 자리만
   * 차지했다(시트가 82vh 를 넘기던 그 자리다 —).
   */
  it('레벨 안내 줄이 없다 — 빈 캐릭터 고르개가 이미 그 말을 한다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    expect(view.queryByTestId('income-sheet-hunt-level-notice')).toBeNull()
    expect(view.getByTestId('income-sheet-character-trigger')).toHaveTextContent('캐릭터선택 안함')
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
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 21,168,000')
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
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 42,336,000')
  })

  /**
   * **효율 조각은 맵이 정한다**(사용자 지정 2026-08-28) — 고르는 것은 «몇
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
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 20,109,600')
  })

  /**
   * 사냥터 차례는 **레벨 차이가 적은 순, 같으면 마릿수가 많은 순**이다(
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

  /**
   * **거는 자리가 둘로 갈린다**(사용자 지정 2026-08-28):
   *
   *   (기본 100% + 템메획 + 유니온의 부 + 어빌/유니온/스킬) × 재획비(1.2배)
   *
   * 유니온의 부는 합산 통 안이고 재획비는 그 결과 전체에 곱한다. 는 둘을 한 통에 넣어
   * ×1.7 을 냈는데, 그 값이 정정으로 갈렸다.
   */
  it('유니온의 부는 통 안, 재획비는 통 밖이다 — 둘을 켜면 ×1.8', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    await 누르기(view, '유니온의 부')
    await 누르기(view, '소형 재물 획득의 비약')

    // 21,168,000 × 1.5 × 1.2 = 38,102,400 (한 통에 넣으면 35,985,600 이 된다)
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 38,102,400')
  })

  it('재획비만 켜면 ×1.2 가 걸린다 — 다만 칩엔 수를 안 적는다', async () => {
    const view = await 그리기()
    await 밤의길3(view)
    await 누르기(view, '소형 재물 획득의 비약')

    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 25,401,600')
    // **칩은 그림이다** — 증가율은 이미 아는 값이라 안 적는다.
    expect(view.getByLabelText('소형 재물 획득의 비약')).toHaveTextContent('')
    expect(view.getByLabelText('유니온의 부')).toHaveTextContent('')
  })

  it('칩은 **그림**이고 이름은 읽어 주는 라벨로만 남는다', async () => {
    const view = await 그리기()
    await 밤의길3(view)

    for (const [id, label] of [
      ['union', '유니온의 부'],
      ['potion', '소형 재물 획득의 비약'],
    ]) {
      // 번들 에셋이 실제로 실린다 — 파일명이 어긋나면 칩이 조용히 빈다.
      // 그림은 `aria-hidden` 이라(이름은 누르개가 든다) 기본 쿼리에서 숨겨진다.
      expect(
        view.getByTestId(`income-sheet-boost-icon-${id}`, { includeHiddenElements: true }).props
          .source,
      ).toBeTruthy()
      // 이름은 **읽어 주는 라벨**로만 남는다(글자로는 안 그린다).
      expect(view.getByLabelText(label)).toHaveTextContent('')
    }
  })

  it('레벨 차이가 벌어지면 깎인다 (결정 4)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-odium')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')
    await 아이디로누르기(view, 'income-sheet-ground-option-성문으로 가는 길 1')

    // 캐릭터를 안 골랐으면 페널티가 0 이다: 270 × 7.5 × 34 × 8 × 30 = 16,524,000
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 16,524,000')

    // 루디는 294 — 몬스터가 24 낮으니 20% 에 5·6·7·8 을 더해 −46% 다. 오디움은 루디의 바닥
    // (274)에 걸쳐 있어 목록에 남는다 — 남으면서 가장 많이 깎이는 자리다.
    await 루디고르기(view)

    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 8,922,960')
  })

  it('**큰 숫자는 합계이고 못 친다** (결정 1)', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 밤의길3(view)

    // 조각 12개 × 800만 = 9,600만
    await 아이디로치기(view, 'income-sheet-fragments', '12')
    await 아이디로치기(view, 'income-sheet-fragment-price', '8000000')

    // `readOnly` 면 `AmountFigure` 가 입력이 아니라 글자를 그린다 — 「금액」 칸도 초기화도 없다.
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

  // 붙여넣기가 숫자 아닌 것을 들여보낸다 — 조각 가격과 같은 규칙을 쓴다.
  it('조각 칸도 콤마가 섞여 들어와 값이 안 깨진다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    await 아이디로치기(view, 'income-sheet-fragments', '1,2340')

    expect(view.getByTestId('income-sheet-fragments').props.value).toBe('12340')
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
   * 금액이 덮인다(가 걸어 둔 계약).
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
        quantity: null,
        hunt: {
          mode: 'calculator' as const,
          characterLevel: 294,
          missedMobs: 3,
          boosts: ['union', 'potion'],
          sojae: 3,
          fragments: 7,
          fragmentPrice: 8_000_000,
          mesoRate: 161,
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
    // 켜고 끄는 것이라 **체크박스**다 — 상태가 `selected` 가 아니라 `checked` 다.
    expect(view.getByLabelText('유니온의 부').props.accessibilityState?.checked).toBe(true)
    expect(view.getByTestId('income-sheet-sojae')).toHaveTextContent('3')
    expect(view.getByTestId('income-sheet-fragments').props.value).toBe('7')
    expect(view.getByTestId('income-sheet-fragment-price').props.value).toBe('8000000')
  })

  // 계산기로 적힌 기록은 계산기로 열린다. 모드를 고르는 칸은 안 뜬다.
  it('계산기로 적힌 기록은 계산기로 열리고, 모드를 못 바꾼다', async () => {
    const view = await 그리기({
      editing: {
        ...옛사냥행,
        item: '밤의 길 3',
        hunt: {
          mode: 'calculator' as const,
          characterLevel: 294,
          missedMobs: 0,
          boosts: [],
          sojae: 2,
          fragments: 0,
          fragmentPrice: 0,
          mesoRate: 0,
        },
      },
      onDelete: jest.fn(),
    })

    expect(view.getByTestId('income-sheet-region-trigger')).toBeTruthy()
    expect(view.queryByLabelText('직접 입력')).toBeNull()
  })
})

/**
 * 사냥 **수동 입력**.
 *
 * 계산기는 사냥터 하나에 머무는 것을 전제하고 그 사냥터가 참조표 안에 있어야 한다. 그 밖의 사냥은
 * 획득 메소를 사람이 친다.
 */
describe('사냥 수동 입력', () => {
  async function 직접입력켜기(view: Rendered): Promise<void> {
    await 이름으로누르기(view, '직접 입력')
  }

  it('켜면 계산기 줄이 걷히고 획득 메소가 치는 칸이 된다 (결정 1)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    expect(view.getByTestId('income-sheet-region-trigger')).toBeTruthy()

    await 직접입력켜기(view)

    expect(view.queryByTestId('income-sheet-region-trigger')).toBeNull()
    expect(view.queryByTestId('income-sheet-ground-trigger')).toBeNull()
    expect(view.queryByTestId('income-sheet-efficiency')).toBeNull()
    // 같은 자리·같은 라벨인데 못 치던 줄이 치는 칸이 된다.
    expect(view.getByTestId('income-sheet-hunt-meso').props.editable).not.toBe(false)
  })

  it('합계는 친 메소 + 조각 × 가격이다 (결정 1)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 직접입력켜기(view)

    await 아이디로치기(view, 'income-sheet-hunt-meso', '1000000000')
    await 아이디로치기(view, 'income-sheet-fragments', '83')
    await 아이디로치기(view, 'income-sheet-fragment-price', '8000000')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('16억 6400만')
  })

  it('조각을 안 넣으면 친 메소가 곧 합계다 (결정 1)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 직접입력켜기(view)

    await 아이디로치기(view, 'income-sheet-hunt-meso', '500000000')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('5억')
  })

  // `≈` 는 **미리 세어 둔 값**이라는 뜻이다. 친 값에 붙이면 아무것도 안 가른다.
  it('합계에 `≈` 가 안 붙는다 (결정 2)', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 직접입력켜기(view)

    await 아이디로치기(view, 'income-sheet-hunt-meso', '500000000')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('5억')
    expect(view.getByTestId('income-sheet-amount')).not.toHaveTextContent('≈')
  })

  it('저장하면 수동으로 적힌 행이 되고 사냥터 이름은 비어 있다 (결정 3·7)', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '사냥')
    await 직접입력켜기(view)

    await 아이디로치기(view, 'income-sheet-hunt-meso', '1000000000')
    await 아이디로치기(view, 'income-sheet-fragments', '83')
    await 아이디로치기(view, 'income-sheet-fragment-price', '8000000')
    await 이름으로누르기(view, '저장')

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        category: '사냥',
        item: null,
        mesoAmount: 1_664_000_000,
        hunt: { mode: 'manual', typedMeso: 1_000_000_000, fragments: 83, fragmentPrice: 8_000_000 },
      }),
    )
  })

  /**
   *  이전에 적힌 사냥 행. 조각이 없어 **합계가 곧 획득 메소**라
   * 되짚는 것이지 지어내는 것이 아니다.
   */
  it('옛 사냥 기록은 수동 입력으로 열리고 저장된 금액이 선다 (결정 4)', async () => {
    const view = await 그리기({ editing: 옛사냥행, onDelete: jest.fn() })

    expect(view.queryByTestId('income-sheet-region-trigger')).toBeNull()
    expect(view.getByTestId('income-sheet-hunt-meso').props.value).toBe('1200000000')
    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('12억')
    // 모드는 기록이 정했다 — 바꾸는 칸이 없다(결정 5).
    expect(view.queryByLabelText('직접 입력')).toBeNull()
  })

  // 칸이 없다는 것과 값을 지운다는 것은 다르다. 목록이 그 이름을 적고 있다.
  it('옛 행을 고쳐 저장해도 사냥터 이름이 안 지워진다 (결정 7)', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ editing: 옛사냥행, onDelete: jest.fn(), onSave })

    await 아이디로치기(view, 'income-sheet-hunt-meso', '900000000')
    await 이름으로누르기(view, '수정')

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        item: '엘리시움',
        mesoAmount: 900_000_000,
        hunt: { mode: 'manual', typedMeso: 900_000_000, fragments: 0, fragmentPrice: 0 },
      }),
    )
  })
})

/**
 * 메소 획득량.
 *
 * 캐릭터에 박힌 메획(장비 잠재·에디셔널 · 어빌리티 · 심볼 · 유니온 공격대 · 유니온 아티팩트)을
 * **최대 세팅**으로 읽어 계산에 넣는다. 화면에서는 **자동값이고 못 친다** — 앱이 센 값을 사람이
 * 덮어쓰면 어느 쪽이 참인지 사라진다(결정 7).
 */
describe('메소 획득량', () => {
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

  /**
   * **언제나 선다**(사용자 지정 2026-08-29) — 캐릭터를 안 골랐어도 자리는 있다. 안 세우면 캐릭터를
   * 고르는 순간 줄이 생겨 아래가 밀리고, «메획이 안 든다» 는 사실도 화면이 말하지 않는다.
   */
  it('캐릭터를 안 골라도 줄이 서고 **0%** 다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('0%')
    // 고르지도 않은 캐릭터의 메획을 물을 수는 없다 — 치는 칸이 아니다.
    expect(view.queryByTestId('income-sheet-meso-rate-input')).toBeNull()
  })

  it('캐릭터가 없어도 켠 것은 든다 — 유니온의 부만 켜면 50%', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 누르기(view, '유니온의 부')

    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('50%')
  })

  it('캐릭터를 고르면 읽어서 **자동값**으로 세운다', async () => {
    const loadMesoRate = jest.fn(async () => ({ kind: 'read' as const, percent: 149 }))
    const view = await 그리기({ loadMesoRate })
    await 누르기(view, '사냥')
    await 루디고르기(view)

    expect(loadMesoRate).toHaveBeenCalledWith('ocid-1')
    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('149%')
    // **못 친다** — 자동값 자리에는 입력 칸이 없다.
    expect(view.queryByTestId('income-sheet-meso-rate-input')).toBeNull()
  })

  it('메획은 아이템 부스트와 **같은 합연산 통**이다 (결정 6)', async () => {
    const view = await 그리기({ loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }) })
    await 밤의길3(view)
    await 루디고르기(view)

    // 294 × 7.5 × (40 × 8) × 30분 = 21,168,000 → × (1 + 149/100) = 52,708,320
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 52,708,320')
  })

  it('메획 0 을 읽은 캐릭터는 곱이 ×1 이다 — 「못 읽었다」와 다르다', async () => {
    const view = await 그리기({
      loadMesoRate: async () => ({ kind: 'read' as const, percent: 0 }),
    })
    await 밤의길3(view)
    await 루디고르기(view)

    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 21,168,000')
    expect(view.queryByTestId('income-sheet-meso-rate-input')).toBeNull()
  })

  it('못 읽으면 **치는 칸**이 되고 기본값은 마지막 성공값이다 (결정 7)', async () => {
    const view = await 그리기({
      loadMesoRate: async () => ({ kind: 'fallback' as const, percent: 161 }),
    })
    await 밤의길3(view)
    await 루디고르기(view)

    expect(view.getByTestId('income-sheet-meso-rate-input').props.value).toBe('161')
    // 161% 로 센다 — 21,168,000 × 2.61 = 55,248,480
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 55,248,480')
  })

  it('마지막 성공값도 없으면 빈 칸이고 0 으로 센다', async () => {
    const view = await 그리기({
      loadMesoRate: async () => ({ kind: 'fallback' as const, percent: null }),
    })
    await 밤의길3(view)
    await 루디고르기(view)

    expect(view.getByTestId('income-sheet-meso-rate-input').props.value).toBe('')
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 21,168,000')
  })

  it('폴백 칸에 친 값이 계산에 든다', async () => {
    const view = await 그리기({
      loadMesoRate: async () => ({ kind: 'fallback' as const, percent: null }),
    })
    await 밤의길3(view)
    await 루디고르기(view)
    await 아이디로치기(view, 'income-sheet-meso-rate-input', '100')

    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 42,336,000')
  })

  it('캐릭터를 바꾸면 **다시 읽는다** — 그건 사용자가 한 일이다', async () => {
    const loadMesoRate = jest.fn(async (ocid: string) => ({
      kind: 'read' as const,
      percent: ocid === 'ocid-1' ? 149 : 46,
    }))
    const view = await 그리기({ loadMesoRate })
    await 누르기(view, '사냥')
    await 루디고르기(view)
    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-ocid-2')

    expect(loadMesoRate).toHaveBeenNthCalledWith(2, 'ocid-2')
    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('46%')
  })

  it('캐릭터를 「선택 안함」 으로 되돌리면 **0% 로 돌아간다**', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 루디고르기(view)
    await 아이디로누르기(view, 'income-sheet-character-trigger')
    await 아이디로누르기(view, 'income-sheet-character-option-')

    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('0%')
  })

  /**
   * **아이템을 켜면 이 줄의 숫자가 오른다**(사용자 지정 2026-08-28) — 게임 스탯창처럼 «증가량» 이고
   * 소수점은 **버린다**. 곱셈(재획비)은 기본 100% 를 포함해 걸린다.
   */
  it('유니온의 부를 켜면 149% → 199%', async () => {
    const view = await 그리기({ loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }) })
    await 밤의길3(view)
    await 루디고르기(view)
    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('149%')

    await 누르기(view, '유니온의 부')

    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('199%')
  })

  it('재획비를 켜면 198% 다 — (100+149)×1.2 = 298.8', async () => {
    const view = await 그리기({ loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }) })
    await 밤의길3(view)
    await 루디고르기(view)

    await 누르기(view, '소형 재물 획득의 비약')

    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('198%')
  })

  it('둘 다 켜면 258% 다 — 358.8 의 **소수점을 버린다**', async () => {
    const view = await 그리기({ loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }) })
    await 밤의길3(view)
    await 루디고르기(view)

    await 누르기(view, '유니온의 부')
    await 누르기(view, '소형 재물 획득의 비약')

    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('258%')
  })

  /**
   * **자른 숫자가 돈을 세지 않는다**(과 같은 규칙) — 줄에는 258% 가 적히지만
   * 곱하는 것은 358.8% 다. 라벨이 계산을 끌고 다니면 «왜 저 금액인가» 를 되짚을 수 없다.
   */
  it('돈은 **내림 전 값**으로 센다 — 줄의 258% 가 아니라 358.8%', async () => {
    const view = await 그리기({ loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }) })
    await 밤의길3(view)
    await 루디고르기(view)
    await 누르기(view, '유니온의 부')
    await 누르기(view, '소형 재물 획득의 비약')

    // 21,168,000 × 2.99 × 1.2 = 75,950,784 (줄에 적힌 258% 로 세면 75,781,440 이 된다)
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 75,950,784')
  })

  it('못 읽어 치는 칸일 때도 켠 아이템이 반영된 총합을 보여준다', async () => {
    const view = await 그리기({
      loadMesoRate: async () => ({ kind: 'fallback' as const, percent: 149 }),
    })
    await 밤의길3(view)
    await 루디고르기(view)
    await 누르기(view, '유니온의 부')

    // 치는 칸에는 **캐릭터 메획**이 남고, 켠 것까지 더한 총합은 그 옆에 선다.
    expect(view.getByTestId('income-sheet-meso-rate-input').props.value).toBe('149')
    expect(view.getByTestId('income-sheet-meso-rate-applied')).toHaveTextContent('→ 199%')
  })

  /**
   * **줄을 하나 줄인다**(사용자 지정 2026-08-29) — 시트가 82vh 를 넘겨 스크롤이 났다. 숫자와 그것을
   * 움직이는 칩이 한 줄에 붙으므로 읽기도 오히려 낫다.
   */
  /**
   * **켜는 자리와 세어진 값이 위아래로 갈린다**(사용자 지정 2026-08-29).
   * 윗 줄이 켜고 끄는 것 둘, 아랫 줄이 그 결과다.
   */
  it('켜는 줄과 값 줄이 갈린다 — 값은 켜는 줄 안에 없다', async () => {
    const view = await 그리기({ loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }) })
    await 누르기(view, '사냥')
    await 루디고르기(view)

    const 켜는칸 = view.getByTestId('income-sheet-boosts')
    expect(within(켜는칸).queryByTestId('income-sheet-meso-rate')).toBeNull()
    // 켜는 칸의 글자는 라벨 하나뿐이다 — 켜는 것은 체크박스와 그림이다.
    expect(켜는칸).toHaveTextContent('소비 아이템')
    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('149%')
  })

  it('못 읽었을 때만 치는 칸이 **자기 줄**로 선다', async () => {
    const view = await 그리기({
      loadMesoRate: async () => ({ kind: 'fallback' as const, percent: 149 }),
    })
    await 누르기(view, '사냥')
    await 루디고르기(view)

    const 칩줄 = view.getByTestId('income-sheet-boosts')
    expect(within(칩줄).queryByTestId('income-sheet-meso-rate-input')).toBeNull()
    expect(view.getByTestId('income-sheet-meso-rate-input')).toBeTruthy()
  })

  it('저장하면 **그때의 메획**이 실린다 (결정 8)', async () => {
    const onSave = jest.fn()
    const view = await 그리기({
      onSave,
      loadMesoRate: async () => ({ kind: 'read' as const, percent: 149 }),
    })
    await 밤의길3(view)
    await 루디고르기(view)
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0].hunt).toMatchObject({ mesoRate: 149 })
  })

  it('수정으로 열면 저장해 둔 메획이 서고 **다시 읽지 않는다**', async () => {
    const loadMesoRate = jest.fn(async () => ({ kind: 'read' as const, percent: 149 }))
    const view = await 그리기({
      loadMesoRate,
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
        quantity: null,
        hunt: {
          mode: 'calculator' as const,
          characterLevel: 294,
          missedMobs: 0,
          boosts: [],
          sojae: 1,
          fragments: 0,
          fragmentPrice: 0,
          mesoRate: 161,
        },
        memo: null,
        recordedAt: '2026-08-23T01:00:00.000Z',
      },
      onDelete: jest.fn(),
    })

    // **그때의 값**이다 — 지금 읽으면 149 지만 이 기록은 161 로 적혔다.
    expect(view.getByTestId('income-sheet-meso-rate')).toHaveTextContent('161%')
    expect(loadMesoRate).not.toHaveBeenCalled()
  })
})

/**
 * 수정으로 열면 **그 기록의 값이 곧바로 선다**.
 *
 * 이 자리는 한때 카운트업의 기억(모듈 수준이라 시트를 닫아도 남았다) 때문에 **지난 기록의 금액에서
 * 굴러왔다**(사용자 보고 2026-08-29 — 56억을 봤다가 121억을 열면 오르는 애니메이션이 났다).
 * 이름표를 발급해 막았다가, 결정 12 가 카운트업 자체를 걷으면서 그 장치가 통째로 사라졌다.
 * 회귀를 막으려고 결과는 그대로 붙든다.
 */
describe('수정으로 열 때의 큰 숫자', () => {
  function 판매기록(mesoAmount: number) {
    return {
      id: `inc-${mesoAmount}`,
      ocid: null,
      earnedOn: '2026-08-23',
      category: '아이템 판매' as const,
      item: '앱솔랩스 케이프',
      mesoAmount,
      saleFeePercent: null,
      saleFeeMeso: null,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      hunt: null,
      quantity: null,
      memo: null,
      recordedAt: '2026-08-23T01:00:00.000Z',
    }
  }

  it('다른 기록을 열면 그 기록의 금액이 곧바로 선다', async () => {
    const 먼저 = await 그리기({ editing: 판매기록(5_600_000_000), onDelete: jest.fn() })
    expect(먼저.getByTestId('income-sheet-amount')).toHaveTextContent('56억')
    await act(async () => 먼저.unmount())

    const 나중 = await 그리기({ editing: 판매기록(12_100_000_000), onDelete: jest.fn() })

    // 열자마자 그 기록의 값이다 — 5,600,000,000 에서 올라오면 «내가 뭘 바꿨나» 로 읽힌다.
    expect(나중.getByTestId('income-sheet-amount')).toHaveTextContent('121억')
  })

  it('사냥 · 기타도 같다 — 갈래마다 자기 이름표를 갖는다', async () => {
    const 먼저 = await 그리기({
      editing: { ...판매기록(5_600_000_000), category: '기타' as const },
      onDelete: jest.fn(),
    })
    await act(async () => 먼저.unmount())

    const 나중 = await 그리기({
      editing: { ...판매기록(12_100_000_000), category: '기타' as const },
      onDelete: jest.fn(),
    })

    // 「기타」의 큰 숫자도 이제 글자다 — 갈래가 달라도 보는 법이 같다.
    expect(나중.getByTestId('income-sheet-amount')).toHaveTextContent('121억')
  })
})

/**
 * 사냥 폼의 줄 배치 (사용자 지정 2026-09-01).
 *
 * 지역과 사냥터는 **각각 자기 줄**이다 — 나란히 세우면 둘 다 이름이 잘렸다. 그 대신 소비 아이템과
 * 메소 획득량이 **한 줄**로 합쳐져 높이를 되찾는다. 켜고 끄는 것은 알약 테두리가 아니라
 * **체크박스**가 상태를 말한다.
 */
describe('사냥 폼의 줄 배치 (사용자 지정 2026-09-01)', () => {
  async function 사냥열기(view: Rendered): Promise<void> {
    await 누르기(view, '사냥')
  }

  // 나란히 세우면 「츄츄 아일랜드」 도 「풍화된 기쁨과 분노의 땅」 도 잘린다 — 고른 것이 온전히
  // 읽히는 쪽을 택했다(사용자 지정 2026-09-01).
  it('지역과 사냥터가 **각각 자기 줄**에 선다', async () => {
    const view = await 그리기()
    await 사냥열기(view)

    // 둘을 한 칸에 묶던 줄이 없다 — 있으면 다시 나란히 선 것이다.
    expect(view.queryByTestId('income-sheet-where')).toBeNull()
    expect(view.getByTestId('income-sheet-region-trigger')).toBeTruthy()
    expect(view.getByTestId('income-sheet-ground-trigger')).toBeTruthy()
  })

  it('소비 아이템과 메소 획득량이 **한 줄**에 선다', async () => {
    const view = await 그리기()
    await 사냥열기(view)

    const 한줄 = view.getByTestId('income-sheet-meso-line')
    expect(within(한줄).getByTestId('income-sheet-boosts')).toBeTruthy()
    expect(within(한줄).getByTestId('income-sheet-meso-rate')).toBeTruthy()
  })

  // 켜는 칸은 라벨 다섯 글자와 체크박스 둘이 함께 서고 값 칸은 라벨과 숫자 하나뿐이다
  // (사용자 지정 2026-09-01).
  it('소비 아이템이 메소 획득량의 **두 배**로 넓다', async () => {
    const view = await 그리기()
    await 사냥열기(view)

    const 소비 = flattenStyle(view.getByTestId('income-sheet-boosts').props.style) as {
      flex: number
    }
    const 메획 = flattenStyle(view.getByTestId('income-sheet-meso-rate-slot').props.style) as {
      flex: number
    }

    expect(소비.flex).toBe(메획.flex * 2)
  })

  it('켜고 끄는 것은 **체크박스**다 — 눌리면 상태가 뒤집힌다', async () => {
    const view = await 그리기()
    await 사냥열기(view)

    const 유니온 = view.getByLabelText('유니온의 부')
    // RN 은 `role` 을 그대로 실어 보낸다(`accessibilityRole` 로 안 옮긴다).
    expect(유니온.props.role).toBe('checkbox')
    expect(유니온.props.accessibilityState?.checked).toBe(false)

    await 누르기(view, '유니온의 부')

    expect(view.getByLabelText('유니온의 부').props.accessibilityState?.checked).toBe(true)
  })

  it('아이템 그림에 **원형 테두리가 없다**', async () => {
    const view = await 그리기()
    await 사냥열기(view)

    // 알약 테두리는 «고르는 하나» 로 읽혀 여럿이 동시에 켜지는 것과 안 맞았다.
    expect(String(view.getByLabelText('유니온의 부').props.className ?? '')).not.toContain(
      'rounded-full',
    )
  })
})

/**
 * 머리에서 **날짜를 바꾼다** (사용자 지정 2026-08-29).
 *
 * 종전에는 «날짜는 캘린더에서 고르는 것» 이라 시트가 적기만 했다. 그런데 **날을 잘못 골랐다는
 * 것을 아는 자리가 여기**다 — 그때 닫고 다시 여는 것은 친 것을 버리는 일이다.
 */
describe('날짜 바꾸기', () => {
  it('하루씩 앞뒤로 옮긴다', async () => {
    const view = await 그리기()
    expect(view.getByTestId('income-sheet-date')).toHaveTextContent('8월 23일 (일)')

    await 아이디로누르기(view, 'income-sheet-date-prev')
    expect(view.getByTestId('income-sheet-date')).toHaveTextContent('8월 22일 (토)')

    await 아이디로누르기(view, 'income-sheet-date-next')
    await 아이디로누르기(view, 'income-sheet-date-next')
    expect(view.getByTestId('income-sheet-date')).toHaveTextContent('8월 24일 (월)')
  })

  it('바꾼 날짜로 저장된다', async () => {
    const onSave = jest.fn()
    const view = await 판매시트({ onSave })
    await 대금치기(view, '1200000000')
    await 아이디로누르기(view, 'income-sheet-date-prev')
    await 이름으로누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ earnedOn: '2026-08-22' })
  })

  // 갈래 폼은 `key={category}` 로만 다시 심긴다 — 날짜는 그 열쇠가 아니다.
  it('날짜를 바꿔도 **친 것이 안 사라진다**', async () => {
    const view = await 판매시트()
    await 대금치기(view, '1200000000')

    await 아이디로누르기(view, 'income-sheet-date-prev')

    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1200000000')
  })

  it('수정으로 열어도 바꿀 수 있다 — 그 기록이 다른 날로 옮겨 간다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({
      onSave,
      onDelete: jest.fn(),
      editing: {
        id: 'inc-1',
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
        hunt: null,
        quantity: null,
        memo: null,
        recordedAt: '2026-08-23T01:00:00.000Z',
      },
    })

    await 아이디로누르기(view, 'income-sheet-date-next')
    await 이름으로누르기(view, '수정')

    expect(onSave.mock.calls[0][0]).toMatchObject({ earnedOn: '2026-08-24' })
  })
})

/**
 * 사냥 메소는 **어림값**이다 (사용자 지정 2026-08-29).
 *
 * 젠 주기·마릿수·레벨로 미리 세어 둔 값이지 실제로 받은 액수가 아니다.
 * 획득 메소 줄과 합계 둘 다 `≈` 를 든다.
 */
describe('어림값 표식', () => {
  it('획득 메소와 합계 둘 다 `≈` 를 든다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')
    await 아이디로누르기(view, 'income-sheet-region-trigger')
    await 아이디로누르기(view, 'income-sheet-region-option-tallahart')
    await 아이디로누르기(view, 'income-sheet-ground-trigger')
    await 아이디로누르기(view, 'income-sheet-ground-option-밤의 길 3')

    // 「획득 메소」 줄은 앱이 센 값을 그리는 자리라 콤마 표기 그대로다.
    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('≈ 21,168,000')
    // 큰 숫자는 한국어 단위로 접혀 선다.
    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('≈ 2116만 8000')
  })

  it('아직 아무것도 안 골랐으면 표식이 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '사냥')

    expect(view.getByTestId('income-sheet-hunt-meso')).toHaveTextContent('0')
    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('0')
  })

  // 아이템 판매는 실제로 오간 값이다 — 어림이 아니다.
  it('다른 갈래에는 안 붙는다', async () => {
    const view = await 판매시트()
    await 대금치기(view, '1200000000')

    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('12억')
  })
})
