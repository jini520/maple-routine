// 지출 기록 시트.
//
// **갈래는 시트 밖에서 갈렸다**. 펼침판이 `지출`을 골라 이 시트를 연다. 그래서 이 시트에는
// 수입/지출 세그먼트가 없고, 자기가 지출이라는 것을 **모른 채** 받은 것을 그린다.
import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

// 시트 껍데기는 `BossDropSheet.test.tsx` 와 같은 방식으로 세운다. 라이브러리를 목으로 갈아
// 끼우고 내용만 본다(껍데기의 동작은 그쪽 컴포넌트의 테스트가 붙든다).
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
    // 시트 밖과 같게 둔다. 아톰이 이 값으로 **시트 안인가** 를 묻는다.
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다. 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { SpendSheet } from '../SpendSheet'

// 큰 숫자의 카운트업 기억은 **모듈 수준**이라 케이스 사이로 샌다.

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

/** 고르개가 실제로 고를 것이 있어야 선택 안함 이 기본이라는 말에 뜻이 생긴다. */
const 캐릭터둘 = [
  { ocid: 'ocid-1', name: '루디' },
  { ocid: 'ocid-2', name: '아델' },
]

async function 그리기(overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {}) {
  return renderOverlay(
    <SpendSheet
      dateKey="2026-08-23" characters={캐릭터둘}
      lastPointRate={null}
      onSave={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />,
  )
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

/**
 * **갈래 칩은 컨테이너 안에서 집는다**. 기타가 갈래 이름이자 아이템 구매의 종류
 * 이름이라 라벨만으로는 둘이 안 갈린다. 그 줄에 `testID` 가 있는 이유다.
 */
async function 갈래누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(within(view.getByTestId('spend-sheet-categories')).getByLabelText(label))
  })
}

/**
 * 에픽던전 리워드는 **두 단계**다. 대표를 고르고, 그 안에서 형태와
 * 단계를 고른다. 단계도 형태도 없는 항목(몬스터 파크·영약)은 `누르기` 한 번으로 끝난다.
 */
async function 에픽던전(view: Rendered, 대표: string, 형태: string, 단계: string): Promise<void> {
  await 누르기(view, 대표)
  await 누르기(view, 형태)
  await 누르기(view, 단계)
}

describe('머리', () => {
  it('어느 날에 적히는지 말한다. FAB 는 날짜를 안 들고 온다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 23일 (일)')
  })

  it('수입/지출 세그먼트가 없다. 갈래는 펼침판이 이미 갈랐다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('수입')).toBeNull()
  })
})

describe('갈래 칩', () => {
  //  의 다섯. 목록 셋과 직접 입력 둘.
  it('다섯이 다 선다', async () => {
    const view = await 그리기()

    for (const label of ['컨텐츠', '이벤트·BM', '버프', '아이템 구매', '기타']) {
      expect(view.getByLabelText(label)).toBeTruthy()
    }
  })

  it('첫 갈래로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('컨텐츠').props.accessibilityState?.selected).toBe(true)
  })

  it('갈래를 바꾸면 그 묶음들이 선다', async () => {
    const view = await 그리기()

    await 누르기(view, '버프')

    expect(view.getByText('버프 물약')).toBeTruthy()
    expect(view.queryByText('에픽던전 추가 리워드')).toBeNull()
  })

  /**
   * **칩은 고르는 화면에만 선다**.
   *
   * 둘째 화면에서는 머리의 `‹` 가 되돌아가는 길이다. 칩까지 두면 길이 둘이 되고, 그 화면이
   * 답하는 질문(얼마인가)에 무엇을 이 섞인다.
   */
  it('고른 뒤에는 칩이 안 보인다. 되돌아가는 길은 머리 하나다', async () => {
    const view = await 그리기()

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.queryByLabelText('버프')).toBeNull()
    expect(view.queryByLabelText('기타')).toBeNull()
    expect(view.getByLabelText('다시 고르기')).toBeTruthy()
  })

  // 고르던 항목이 남아 있으면 **컨텐츠를 골랐는데 버프 항목이 저장되는** 일이 생긴다.
  it('되돌아가 갈래를 바꾸면 고르던 항목이 풀린다', async () => {
    const view = await 그리기()
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 누르기(view, '다시 고르기')
    await 누르기(view, '버프')

    // 고를 것을 고르는 화면에는 **저장이 아예 없다**. 셀 것이 없다.
    expect(view.queryByLabelText('저장')).toBeNull()
    // `버프` 의 묶음이 섰다. 고르던 컨텐츠 항목은 풀렸다.
    expect(view.getAllByText('버프 물약').length).toBeGreaterThan(0)
  })

  // 직접 입력은 고를 목록이 없어 칩이 그대로 선다.
  it('직접 입력에는 칩이 남는다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByLabelText('컨텐츠')).toBeTruthy()
  })
})

describe('항목. 고르면 채워진다', () => {
  // 가격이 전부 고정이라 **목록만 받고 금액은 매번 입력** 이 아니다.
  it('묶음 이름과 **대표**가 파일 차례대로 선다', async () => {
    const view = await 그리기()

    expect(view.getByText('에픽던전 추가 리워드')).toBeTruthy()
    expect(view.getByLabelText('하이마운틴')).toBeTruthy()
    // 단계는 목록에 안 선다. 대표를 고른 뒤에 나온다.
    expect(view.queryByLabelText('하이마운틴 1단계')).toBeNull()
  })

  // 갈래 하나 안에서 통화가 갈리는 곳이 있다. `버프`의 영약은 메소, 보약은 메포다.
  // 숫자만 적으면 타일만 보고는 어느 쪽인지 모른다.
  it('메포 항목은 단위가 `메포`다', async () => {
    const view = await 그리기()

    // 몬스터 파크는 단계가 없어 값이 하나로 정해진다.
    expect(view.getByText('600 메포')).toBeTruthy()
  })

  // 단계가 여럿이면 **나란히** 적는다. 한 대표 안의 단계는 통화가 같으므로
  // 단위는 한 번만. 두 번 적으면 좁은 칸에서 숫자가 밀린다.
  it('단계가 여럿인 대표는 가격을 나란히 적는다', async () => {
    const view = await 그리기()

    expect(view.getByText('7,500 | 30,000 메포')).toBeTruthy()
    expect(view.getByText('10,000 | 40,000 메포')).toBeTruthy()
    expect(view.getByText('12,500 | 50,000 메포')).toBeTruthy()
  })

  it('메소 항목은 단위가 `메소`이고 줄여 적는다. 좁은 칸이다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    // 세이람·알레리아가 둘 다 200만이라 같은 글자가 두 번 선다. 그것 자체가 맞는 표기다.
    expect(view.getAllByText('200만 메소')).toHaveLength(2)
    expect(view.getByText('2,000만 메소')).toBeTruthy()
  })

  /**
   * 타일이 **자기 통화를 적는다**. 값이 어디서 오는지는 항목이 안다.
   *
   * 보약 버프 둘이 이벤트·BM 으로 옮겨가면서 버프 는 메소뿐이 됐다.
   * 두 갈래를 나란히 본다.
   */
  it('타일이 자기 통화를 적는다', async () => {
    const 버프 = await 그리기()
    await 누르기(버프, '버프')
    expect(버프.getByText('500만 메소')).toBeTruthy()

    const 이벤트 = await 그리기()
    await 누르기(이벤트, '이벤트·BM')
    expect(이벤트.getByText('9,900 메포')).toBeTruthy()
  })

  // 고를 것을 고르는 화면에는 큰 숫자도 저장도 없다.
  it('고르기 전에는 저장도 큰 숫자도 없다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('저장')).toBeNull()
    expect(view.queryByTestId('spend-sheet-amount')).toBeNull()
  })

  /**
   * **시세는 형태·단계를 고르기 전에도 선다**.
   *
   * 무엇을 골랐나 와 무관한 칸이라서다. 통화는 **대표가 이미 안다**(한 대표 안의 단계들은
   * 통화가 같다). 고른 뒤에야 뜨면 시세를 미리 채워 둘 수 없고, 줄이 나중에 나타나 화면이 밀린다.
   *
   * 수량도 같은 자리에 섰었는데 **에픽던전에는 그 줄이 없어졌다**.
   */
  it('형태·단계를 고르기 전에도 시세가 선다', async () => {
    const view = await 그리기({ lastPointRate: null })

    await 누르기(view, '하이마운틴')

    expect(view.getByTestId('spend-sheet-rate')).toBeTruthy()
    // 합계도 **0 으로 선다**. 단가를 아직 모를 뿐 셀 자리는 이미 있다.
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('0')
    // 저장은 서 있되 **안 눌린다**. 무엇을 살지 아직 안 골랐다.
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // `−0` 은 **0 원짜리 지출** 로 읽히는데 사실은 **아직 안 골랐다** 다.
  //  로 힌트 줄이 사라져 그 자리는 아예 안 그린다.
  it('고르기 전에는 큰 숫자가 0 이고 힌트 줄이 없다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '하이마운틴')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('0')
    expect(view.queryByTestId('spend-sheet-amount-hint')).toBeNull()
  })

  /**
   * **합계는 언제나 메소다**. 가계부의 축이 메소라
   * 이 지출이 메소로 얼마인가 가 곧 합계다. 실제로 내는 메포를 적던 힌트 줄은
   *  가 걷었다.
   */
  it('고르면 합계가 메소로 선다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    // 30,000 메포 ÷ 1,180 × 1억 = 2,542,372,881 메소.
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('25억 4237만 2881')
    expect(view.getByText('메소')).toBeTruthy()
    expect(view.queryByTestId('spend-sheet-amount-hint')).toBeNull()
  })
})

describe('수량. 곱셈은 앱이 한다', () => {
  /**
   * 스테퍼는 **숫자만** 든다.
   *
   * 단위가 `+` 오른쪽에 붙어 있어 알약의 좌우가 안 맞았고(기타는 단위가 없어 그 자리가 빈 채로
   * 간격만 남았다), 무엇보다 **한 앱에 스테퍼가 두 모양**이 됐다.
   */
  it('단위를 안 적는다. 숫자만 오르내린다', async () => {
    const view = await 그리기()
    await 누르기(view, '이벤트·BM')

    await 누르기(view, '보약 버프 추가 구매')

    expect(view.queryByTestId('spend-sheet-quantity-unit')).toBeNull()
    expect(view.getByTestId('spend-sheet-quantity')).toHaveTextContent('1')
  })

  // 에픽던전은 **수량이 없다**. 곱셈을 보는 자리는 상한이 여럿인 항목이다.
  it('수량을 올리면 금액이 그만큼 는다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 누르기(view, '몬스터 파크')

    await 누르기(view, '수량 늘리기')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ quantity: 2, pointAmount: 1_200 })
  })

  it('1 아래로는 못 내린다', async () => {
    const view = await 그리기()
    await 누르기(view, '몬스터 파크')

    expect(view.getByLabelText('수량 줄이기').props.accessibilityState?.disabled).toBe(true)
  })

  /**
   * 단계를 바꾸면 수량이 1 로 돌아가던 자리는 **더 볼 수 없다**. 단계가
   * 있는 항목은 에픽던전뿐이고 거기엔 수량 줄이 없다. 되돌리기(`selectItem` 의 `setQuantity(1)`)는
   * 코드에 남아 있고, 단계가 있는 수량 항목이 생기면 그때 이 자리에 케이스가 돌아온다.
   *
   * 그래도 **단계를 바꾸면 그 단계로 저장된다**는 것은 여전히 사실이라 그것만 본다.
   */
  it('단계를 바꾸면 그 단계로 저장된다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 누르기(view, '1단계')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ item: '하이마운틴 1단계', quantity: 1 })
  })

  // 목록으로 돌아가면 고르던 것이 통째로 풀린다. 남으면 **대표는 몬스터 파크인데 저장되는 것은
  // 하이마운틴** 이 된다.
  it('다시 고르기를 누르면 목록으로 돌아가고 고르던 것이 풀린다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 누르기(view, '다시 고르기')

    expect(view.getByLabelText('하이마운틴')).toBeTruthy()
    expect(view.queryByLabelText('저장')).toBeNull()
  })

  // 머리줄이 지금 어디인지를 말한다. ②로 들어가면 제목이 고른 것의 이름이 되고 그 왼쪽이
  // 돌아가는 자리다. 목록에서는 돌아갈 데가 없으니 서 있으면 안 된다.
  it('②에서는 머리줄이 고른 것의 이름과 뒤로 가는 자리가 된다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    expect(view.queryByTestId('spend-sheet-back')).toBeNull()
    expect(view.getByText('지출 추가')).toBeTruthy()

    await 누르기(view, '하이마운틴')

    expect(view.getByTestId('spend-sheet-back')).toBeTruthy()
    expect(view.getByTestId('spend-sheet-choice')).toHaveTextContent('하이마운틴')
    expect(view.queryByText('지출 추가')).toBeNull()
  })

  // 사용자가 준 한도를 **화면이 들고 있어야** 한다. 데이터에만 있고 안 보이면 받은 뜻이 없다
  // (사용자 지적). 앱은 세지 않는다: 몬스터 파크 한도는 축이 셋(월드·캐릭터·무료)인데
  // 앱은 지금 어느 월드·어느 캐릭터인지 모른다.
  it('한도가 있는 항목은 사용자 문장 그대로 적는다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '몬스터 파크')

    expect(view.getByTestId('spend-sheet-limit')).toHaveTextContent(
      '한도 · 일간 월드당 최대 14회, 캐릭터 당 최대 7회, 일간 무료 2회',
    )
  })

  // 한도가 없는 항목에 빈 줄이 서면 **한도가 0** 으로 읽힌다.
  it('한도가 없는 항목에는 그 줄이 서지 않는다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '에픽던전')

    expect(view.queryByTestId('spend-sheet-limit')).toBeNull()
  })

  // 한도를 적어만 두면 **넘겨서 적을 수 있다**. 스테퍼가 막아야 한다(사용자 지적).
  // 몬스터 파크는 상한이 14 다.
  it('한도가 있으면 스테퍼가 그 수에서 멈춘다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '몬스터 파크')

    for (let i = 0; i < 20; i += 1) await 누르기(view, '수량 늘리기')

    expect(view.getByText('14')).toBeTruthy()
    expect(view.getByLabelText('수량 늘리기').props.accessibilityState?.disabled).toBe(true)
  })

  // 상한이 1 이면 늘리는 자리가 처음부터 막혀 있어야 한다. 눌리는데 안 늘면 고장으로 읽힌다.
  // 상한이 1이면 **줄 자체가 없다**. 오르내릴 자리가 없는 스테퍼는
  // **조절할 수 있다** 는 거짓말이다. 막힌 채로 세워 두던 것을 걷었다.
  it('상한이 1이면 수량 줄이 아예 없다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '이벤트·BM')
    await 누르기(view, '미호로이드')

    expect(view.queryByTestId('spend-sheet-quantity')).toBeNull()
  })

  // 상한이 없는 항목은 계속 는다. 없는 한도를 앱이 지어내면 그것이 추정이다.
  it('한도가 없으면 스테퍼가 안 막힌다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '에픽던전')

    for (let i = 0; i < 20; i += 1) await 누르기(view, '수량 늘리기')

    expect(view.getByLabelText('수량 늘리기').props.accessibilityState?.disabled).toBeFalsy()
  })

  // 형태가 있는데 안 고르면 **어느 쪽인지 모르는 행** 이 된다. 칸을 더한 뜻이 사라진다.
  it('형태를 안 고르면 저장이 막힌다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '하이마운틴')

    await 누르기(view, '2단계')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

// 시세 없이 저장하면 그 행은 **영영 메소로 표시할 수 없는 행**이 된다.
describe('메소마켓 시세', () => {
  it('메포 항목을 고르면 시세 칸이 선다', async () => {
    const view = await 그리기()

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByTestId('spend-sheet-rate')).toBeTruthy()
  })

  it('메소 항목에는 안 선다. 물어볼 이유가 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    await 누르기(view, '세이람의 영약')

    expect(view.queryByTestId('spend-sheet-rate')).toBeNull()
  })

  it('시세가 없으면 저장이 막힌다', async () => {
    const view = await 그리기({ lastPointRate: null })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // 금액은 매번 다르지만 시세는 좀처럼 안 바뀐다. 필수 칸이 매번 비어 있으면
  // 입력이 막히므로 **기억한다** 가 여기서 결정적이다.
  it('마지막으로 쓴 시세가 채워져 있다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(false)
  })

  // 시세는 네 자리라 OS 숫자 키패드로 충분하다. 가 막은 것은 큰 메소다.
  it('시세를 고치면 환산이 따라온다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-rate'), '2360')
    })
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ pointPer100mMeso: 2_360 })
  })

  it('시세를 비우면 저장이 막힌다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-rate'), '')
    })

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  it('메소 항목은 시세가 없어도 저장된다', async () => {
    const view = await 그리기({ lastPointRate: null })
    await 누르기(view, '버프')

    await 누르기(view, '세이람의 영약')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(false)
  })
})

describe('저장', () => {
  it('메포 항목은 원금과 시세를 함께 박는다. 메소 칸은 비운다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')
    await 누르기(view, '저장')

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toEqual({
      ocid: null,
      spentOn: '2026-08-23',
      category: '컨텐츠',
      item: '하이마운틴 2단계',
      // 가격이 같아 금액으로는 구분이 안 되므로 **고른 형태를 따로 박는다**.
      form: '경험치',
    itemKind: null,
      quantity: 1,
      mesoAmount: null,
      tariffMeso: null,
      pointAmount: 30_000,
      pointPer100mMeso: 1_180,
      cashAmount: null,
      memo: null,
    })
  })

  it('메소 항목은 메소 칸만 채운다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '버프')

    await 누르기(view, '콜렉터의 영약')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '버프',
      item: '콜렉터의 영약',
      mesoAmount: 20_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
    })
  })

  it('저장하면 닫는다', async () => {
    const onClose = jest.fn()
    const view = await 그리기({ onClose, lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')
    await 누르기(view, '저장')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ══ 직접 입력 갈래 둘 ═══════════════
//
// 목록 갈래 셋과 폼이 통째로 다르다. 고를 것이 없고 **금액을 친다.**

/** 기타는 큰 숫자가 합계라 **금액 칸**에 친다(라벨은). */
async function 금액치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('spend-sheet-unit-price'), text)
  })
}

/**
 * 갈래 칩을 누른다. **`기타`가 갈래 이름이자 `아이템 구매`의 종류 이름**이라
 *  아이템 구매 화면에서는 라벨만으로 둘이 안 갈린다. 줄을 지목해 가른다.
 */
async function 갈래고르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(within(view.getByTestId('spend-sheet-categories')).getByLabelText(label))
  })
}

/**
 * 관세를 켠다. **라벨–값 줄의 세그먼트**다. 없음 은 수입 시트의
 * 수수료 조각과 이름이 같으므로 줄을 지목한다.
 */
async function 관세고르기(view: Rendered, 조각: '없음' | '10%'): Promise<void> {
  await act(async () => {
    fireEvent.press(within(view.getByTestId('spend-sheet-tariff')).getByLabelText(조각))
  })
}

/**
 * 금액을 치는 자리는 **라벨–값 줄**이다. 큰 숫자는 어디서도 못 친다.
 *
 * 아이템 구매에서 그 줄은 늘 서고 라벨만 갈린다(장비면 `구매 비용`, 나머지는 `단가`).
 * 장비는 곱할 수량이 없어 친 값이 곧 합계다.
 */
async function 치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('spend-sheet-unit-price'), text)
  })
}

describe('아이템 구매', () => {
  it('고를 목록이 없고 금액을 친다', async () => {
    const view = await 그리기()

    await 누르기(view, '아이템 구매')

    expect(view.queryByText('에픽던전 추가 리워드')).toBeNull()
    expect(view.getByTestId('spend-sheet-amount')).toBeTruthy()
  })

  /**
   * 금액은 **OS 숫자 키보드**다. 앱 키패드를 안 두는 이유는 이 시트가
   * 내용·시세 칸 때문에 **어차피 키보드를 부르기** 때문이다.
   */
  it('앱 키패드를 안 그리고 숫자 키보드를 부른다', async () => {
    const view = await 그리기()

    await 누르기(view, '아이템 구매')

    expect(view.queryByLabelText('한 자리 지우기')).toBeNull()
    expect(view.getByTestId('spend-sheet-unit-price').props.keyboardType).toBe('number-pad')
  })

  /**
   * **갈래를 옮기면 금액을 안 들고 간다**.
   *
   * 큰 숫자는 언제나 **곧바로** 새 값이다. 가 카운트업을 걷어, 값이 어떤
   * 이유로 바뀌든 중간값이 안 보인다.
   */
  it('갈래를 옮기면 금액이 0 에서 시작한다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '1200000000')

    await 갈래고르기(view, '기타')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('0')
  })

  it('갔다 돌아와도 0 이다. 기억에서 되살아나지 않는다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '1200000000')

    await 갈래고르기(view, '기타')
    await 누르기(view, '아이템 구매')

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('')
  })

  it('금액이 0 이면 저장할 수 없다', async () => {
    const view = await 그리기()

    await 누르기(view, '아이템 구매')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  /**
   * 친 구입가는 `구매 비용` 칸에 남는다.
   *
   * 관세를 켜면 큰 숫자가 합계가 되고 사용자가 친 값은 자기 칸에 그대로 서 있다. 커서로 두
   * 값을 오가게 하던 자리를 칸 하나가 대신한다.
   */
  it('관세를 켜도 친 구입가가 자기 칸에 남는다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')

    await 관세고르기(view, '10%')

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('850000000')
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('9억 3500만')
  })

  // **저장되는 값이 안 부푼다**. 껐다 켰다 해도 8.5억 → 9.35억 → 10.28억 이 되지 않는다.
  it('껐다 켜도 부풀지 않는다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')

    await 관세고르기(view, '10%')
    await 관세고르기(view, '10%')
    await 관세고르기(view, '10%')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })
  })

  // 관세 줄에서 **더해지는 금액을 안 적는다**. 큰 숫자가 그만큼 올라가는 것이 그 말이다.
  it('관세 줄은 `관세 10%` 뿐이다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')

    await 관세고르기(view, '10%')

    expect(view.queryByText('+85,000,000')).toBeNull()
    expect(view.queryByText(/월드 간 거래/)).toBeNull()
  })

  // 총액과 그 몫을 **둘 다** 박는다. 집계는 총액 한 칸만 본다.
  it('총액과 관세분을 함께 저장한다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')
    await 관세고르기(view, '10%')

    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-name'), '앱솔랩스 슈즈')
    })
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '아이템 구매',
      item: '앱솔랩스 슈즈',
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
      pointAmount: null,
      quantity: null,
    })
  })

  it('관세를 안 켜면 관세분이 없다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '100')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ mesoAmount: 100, tariffMeso: null })
  })

  // 시세를 안 물어도 된다. 관세가 **메소 가치 기준 10%** 라 양변에서 상쇄된다.
  it('시세를 안 묻는다', async () => {
    const view = await 그리기({ lastPointRate: null })

    await 누르기(view, '아이템 구매')

    expect(view.queryByTestId('spend-sheet-rate')).toBeNull()
  })
})

describe('기타. 캐시는 여기서만 산다', () => {
  it('통화 셋을 고른다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByLabelText('메소')).toBeTruthy()
    expect(view.getByLabelText('메포')).toBeTruthy()
    expect(view.getByLabelText('캐시')).toBeTruthy()
  })

  /**
   * 통화는 **갈래가 아니라 금액의 축**이라 **세그먼트**다. 칩으로 두면
   * 갈래 칩과 한 무리로 읽힌다. 자리를 두 번 옮겨도 안 나아졌던 것이 이 모양 문제였다.
   */
  it('통화는 칩이 아니라 세그먼트다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    const 세그먼트 = within(view.getByTestId('segment'))
    expect(세그먼트.getByLabelText('메소')).toBeTruthy()
    expect(세그먼트.getByLabelText('메포')).toBeTruthy()
    expect(세그먼트.getByLabelText('캐시')).toBeTruthy()
  })

  it('메소로 시작한다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByLabelText('메소').props.accessibilityState?.selected).toBe(true)
  })

  it('관세는 아이템 구매에만 있다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.queryByTestId('spend-sheet-tariff')).toBeNull()
  })

  it('메포를 고르면 시세를 묻는다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '기타')

    await 누르기(view, '메포')

    expect(view.getByTestId('spend-sheet-rate')).toBeTruthy()
  })

  // **캐시는 환산하지 않는다**. 현금과 게임 재화의 교환비가 실제로
  // 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 그 경로에 값을 매기는 것처럼 읽힌다.
  it('캐시는 시세를 안 묻는다. 환산 자체를 안 한다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '기타')

    await 누르기(view, '캐시')

    expect(view.queryByTestId('spend-sheet-rate')).toBeNull()
  })

  it('캐시는 원 단위로 적고 캐시 칸에 담긴다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 갈래누르기(view, '기타')
    await 누르기(view, '캐시')
    await 금액치기(view, '6900')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '기타',
      cashAmount: 6_900,
      mesoAmount: null,
      pointAmount: null,
    })
  })

  it('캐시 금액에는 메소 빠른 칩이 안 뜬다. 1만원짜리에 +100억은 없다', async () => {
    const view = await 그리기()
    await 누르기(view, '기타')

    await 누르기(view, '캐시')

    expect(view.queryByText('+100억')).toBeNull()
  })

  it('메포로 적으면 원금과 시세가 함께 박힌다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 누르기(view, '기타')
    await 누르기(view, '메포')
    await 금액치기(view, '30000')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      pointAmount: 30_000,
      pointPer100mMeso: 1_180,
      cashAmount: null,
    })
  })

  it('통화를 바꿔도 친 금액은 남는다. 단위만 갈린다', async () => {
    const view = await 그리기()
    await 누르기(view, '기타')
    await 금액치기(view, '123')

    await 누르기(view, '캐시')

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('123')
  })
})

// ══ 시세가 없을 때 화면이 말하게 한다 ═══════════════════
//
// 저장이 막히는 것은 맞다. 시세 없이 저장한 행은 **영영 메소로 표시할 수 없다**. 문제는 화면이
// 그 사실을 말하지 않던 것이다: `저장`이 왜 안 눌리는지 안 보이고, 합계가 **−0** 으로 떠서
// **0원짜리 지출** 로 읽혔다(iOS 실측).

describe('시세가 비어 있을 때', () => {
  async function 메포항목(overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {}) {
    const view = await 그리기({ lastPointRate: null, ...overrides })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')
    return view
  }

  /**
   * 합계가 메소 기준이므로 시세가 없으면 **셀 수가 없다**. 0 이 뜬다.
   *
   * 왜 0 인지를 말하던 힌트 줄은 가 걷었다. 그 몫은
   * **시세 줄의 빨간 `*` 와 꺼진 저장 버튼**이 받는다.
   */
  it('시세가 없으면 합계가 0 이고, 별표와 꺼진 저장이 그 사실을 든다', async () => {
    const view = await 메포항목()

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('0')
    expect(view.queryByTestId('spend-sheet-amount-hint')).toBeNull()
    expect(view.getByTestId('spend-sheet-required')).toBeTruthy()
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // `지금 비었다`가 아니라 **이 칸은 반드시 있어야 한다** 를 말하는 자리라 채워도 안 사라진다.
  it('시세 칸이 필수임을 별표로 말한다', async () => {
    const view = await 메포항목()

    expect(view.getByTestId('spend-sheet-required')).toBeTruthy()
  })

  it('시세를 넣으면 합계가 메소로 서고 별표는 남는다', async () => {
    const view = await 메포항목()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-rate'), '1180')
    })

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('25억 4237만 2881')
    // 별표는 **물어본 칸이라는 표시**라 값을 채워도 남는다. `왜 막혔나` 와는 다른 말이다.
    expect(view.getByTestId('spend-sheet-required')).toBeTruthy()
  })

  it('메소 항목에는 시세 칸도 별표도 없다. 물어본 적이 없다', async () => {
    const view = await 그리기({ lastPointRate: null })
    await 누르기(view, '버프')

    await 누르기(view, '세이람의 영약')

    expect(view.queryByTestId('spend-sheet-required')).toBeNull()
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('200만')
  })
})

/**
 * 캐릭터 귀속(사용자 말: *"캐릭터를 선택해서 입력하는 방법을 추가하는게
 * 좋을거 같아"*). 컬럼은 처음부터 있었고 **화면만 없었다**.
 *
 * **기본은 `선택 안함`**. `ocid = null` 이 계정 단위다.
 */
describe('캐릭터 귀속', () => {
  async function 아이디로누르기(view: Rendered, testID: string): Promise<void> {
    await act(async () => {
      fireEvent.press(view.getByTestId(testID))
    })
  }

  it('기본이 `선택 안함` 이다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')

    expect(view.getByTestId('spend-sheet-character-trigger')).toHaveTextContent('캐릭터선택 안함')
  })

  // 고를 것을 고르는 화면에는 안 선다. 거기엔 아직 적을 기록이 없다.
  it('타일 격자에는 안 선다', async () => {
    const view = await 그리기()

    expect(view.queryByTestId('spend-sheet-character-trigger')).toBeNull()
  })

  it('목록 갈래에서도 고를 수 있다. 대표를 고른 뒤에 선다', async () => {
    const view = await 그리기()

    await 누르기(view, '하이마운틴')

    expect(view.getByTestId('spend-sheet-character-trigger')).toBeTruthy()
  })

  it('고르면 그 캐릭터로 저장한다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '1200000000')

    await 아이디로누르기(view, 'spend-sheet-character-trigger')
    await 아이디로누르기(view, 'spend-sheet-character-option-ocid-2')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ ocid: 'ocid-2' })
  })

  it('안 고르면 계정 단위로 저장한다. `ocid` 가 `null` 이다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '1200000000')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ ocid: null })
  })
})

/**
 * **수정 모드에서는 **무엇인지** 를 못 바꾼다**.
 *
 * *"이미 입력된 항목을 클릭해서 띄운 수정 시트는 다른걸로 수정할 수 없도록해. ex) 에픽던전
 * 악몽선경 → 악몽선경의 세부 사항만 수정 가능."*
 *
 * 갈래와 항목은 **글자로만** 서고, 세부(단계·형태·수량·시세·캐릭터)는 그대로 고칠 수 있다.
 */
/**
 * `기타`는 **단가 × 수량**이다.
 *
 * *"통화 밑에 지출액을 추가해서 거기에 지출한 양을 입력하게 하고 지금 입력받는 위치에는 총합을
 * 기록해. 그리고 수량을 추가해."*
 *
 * 큰 숫자가 **치는 칸** 에서 **합계** 로 바뀐다. 목록 갈래와 같은 모양이 된다.
 */
describe('기타. 금액 × 수량', () => {
  async function 기타(overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {}) {
    const view = await 그리기({ lastPointRate: 1_180, ...overrides })
    await 누르기(view, '기타')
    return view
  }

  it('통화 밑에 금액 줄이 서고 수량이 붙는다', async () => {
    const view = await 기타()

    expect(view.getByTestId('spend-sheet-unit-price')).toBeTruthy()
    expect(view.getByLabelText('수량 늘리기')).toBeTruthy()
  })

  it('큰 숫자는 못 친다. 합계 자리다', async () => {
    const view = await 기타()

    expect(view.getByTestId('spend-sheet-amount').props.onChangeText).toBeUndefined()
  })

  it('금액 × 수량이 합계가 된다', async () => {
    const view = await 기타()

    await 금액치기(view, '30000000')
    await 누르기(view, '수량 늘리기')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('6천만')
  })

  // 메포는 합계가 **메소**다. 실제로 내는 메포는 힌트가 든다.
  // 큰 숫자는 **메소 축**이다. 낸 메포는 금액 칸과 수량이 말한다.
  // 그것을 한 줄로 적던 힌트는 가 걷었다.
  it('메포면 합계가 메소로 환산돼 선다', async () => {
    const view = await 기타()
    await 누르기(view, '메포')
    await 금액치기(view, '30000')
    await 누르기(view, '수량 늘리기')

    // 60,000 메포 ÷ 1,180 × 1억 = 5,084,745,762 메소.
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('50억 8474만 5762')
    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('30000')
  })

  it('저장에 총합과 수량이 함께 실린다', async () => {
    const onSave = jest.fn()
    const view = await 기타({ onSave })

    await 금액치기(view, '30000000')
    await 누르기(view, '수량 늘리기')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ mesoAmount: 60_000_000, quantity: 2 })
  })

  // 아이템 구매의 **장비**도 금액 칸에서 받는다. 수량이 없어 곱할 것이
  // 없으므로 라벨이 `단가` 가 아니라 `구매 비용` 이다. 기본 종류라 고르는 절차가 없다.
  it('아이템 구매(장비)는 `구매 비용` 칸에서 받는다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')

    expect(view.getByText('구매 비용')).toBeTruthy()
    expect(view.queryByText('단가')).toBeNull()
    expect(view.getByTestId('spend-sheet-unit-price')).toBeTruthy()
    // 수량이 없으니 곱할 것도 없다. 그 줄 자체가 안 선다.
    expect(view.queryByTestId('spend-sheet-quantity')).toBeNull()
    // 큰 숫자는 여기서도 못 친다.
    expect(view.getByTestId('spend-sheet-amount').props.onChangeText).toBeUndefined()
  })
})

describe('수정 모드', () => {
  const 악몽선경 = {
    id: 'spd-9',
    ocid: null,
    spentOn: '2026-08-23',
    category: '컨텐츠' as const,
    item: '악몽선경 2단계',
    form: '경험치',
    itemKind: null,
    quantity: 1,
    mesoAmount: null,
    tariffMeso: null,
    pointAmount: 50_000,
    pointPer100mMeso: 1_180,
    cashAmount: null,
    memo: null,
    recordedAt: '2026-08-23T01:00:00.000Z',
  }

  async function 고치기() {
    return 그리기({ editing: 악몽선경, onDelete: jest.fn() })
  }

  /**
   * **제목이 **고른 것** 을 말한다**. 지출 수정 이 아니다.
   * 목록 갈래면 그 항목, 직접 입력이면 갈래다.
   */
  it('제목이 고른 항목이다', async () => {
    const view = await 고치기()

    expect(view.getByTestId('spend-sheet-title')).toHaveTextContent('악몽선경')
    expect(view.queryByText('지출 수정')).toBeNull()
  })

  it('갈래를 못 바꾼다. 칩이 아예 없다', async () => {
    const view = await 고치기()

    expect(view.queryByLabelText('아이템 구매')).toBeNull()
    expect(view.queryByLabelText('컨텐츠')).toBeNull()
  })

  // 제목이 이미 말하므로 갈래 줄도 항목 줄도 안 세운다. 같은 사실을 두 번 적는 일이다.
  it('갈래 줄도 항목 줄도 없다', async () => {
    const view = await 고치기()

    expect(view.queryByLabelText('다시 고르기')).toBeNull()
    expect(view.queryByText('갈래')).toBeNull()
    expect(view.queryByText('항목')).toBeNull()
  })

  // 에픽던전 기록이라 **수량은 없다**. 고칠 수 있는 것은 시세와 캐릭터다.
  it('세부는 그대로 고친다. 시세·캐릭터', async () => {
    const view = await 고치기()

    expect(view.queryByTestId('spend-sheet-quantity')).toBeNull()
    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
    expect(view.getByTestId('spend-sheet-character-trigger')).toBeTruthy()
  })

  // 직접 입력도 같다. 갈래는 글자이고 내용·금액은 고칠 수 있다.
  it('직접 입력도 갈래를 못 바꾼다', async () => {
    const view = await 그리기({
      editing: { ...악몽선경, category: '기타' as const, item: '메소마켓 수수료', form: null, itemKind: null, quantity: null },
      onDelete: jest.fn(),
    })

    expect(view.queryByLabelText('컨텐츠')).toBeNull()
    // 직접 입력은 고른 것이 갈래뿐이라 그것이 곧 제목이다.
    expect(view.getByTestId('spend-sheet-title')).toHaveTextContent('기타')
    expect(view.getByTestId('spend-sheet-name')).toBeTruthy()
  })
})

/**
 * **셀 것이 없으면 수량 줄을 안 세운다**.
 *
 * 에픽던전 추가 리워드는 메이플 ID 당 주 1회라(사용자 확인) 카탈로그의 상한이 1이다.
 * 오르내릴 자리가 없는 스테퍼는 조절할 수 있다 는 거짓말이라 아예 안 그린다.
 */
describe('수량 줄', () => {
  it('에픽던전 추가 리워드에는 수량이 없다', async () => {
    const view = await 그리기()

    await 에픽던전(view, '하이마운틴', '경험치', '1단계')

    expect(view.queryByTestId('spend-sheet-quantity')).toBeNull()
  })

  it('그래도 금액은 단가 그대로 선다. 수량 1 이다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '1단계')

    // 7,500 메포 × 1 ÷ 1,180 × 1억 = 635,593,220 메소. 낸 메포를 적던 힌트는 사라졌다.
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('6억 3559만 3220')
  })

  it('상한이 여럿인 항목은 수량이 그대로 선다. 규칙이지 특별 취급이 아니다', async () => {
    const view = await 그리기()

    await 누르기(view, '몬스터 파크')

    expect(view.getByTestId('spend-sheet-quantity')).toBeTruthy()
  })
})

/**
 * **안 열린 묶음은 흐리게 두고 못 고른다**.
 *
 * 숨기지 않는 이유는 그런 것이 있었지 를 기억할 수 있어야 해서다. 열리면 같은 자리에 돌아온다.
 */
describe('안 열린 묶음', () => {
  it('메이플 포인트 샵은 이벤트 기간이 아닙니다 라고 적는다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')

    expect(view.getByTestId('spend-sheet-closed-메이플 포인트 샵')).toHaveTextContent('· 이벤트 기간이 아닙니다')
  })

  it('그 묶음의 타일은 안 눌린다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')
    await 누르기(view, '솔 에르다')

    // 안 골라졌으므로 여전히 목록이다. 고른 뒤라면 되돌아가는 머리가 섰을 것이다.
    expect(view.queryByTestId('spend-sheet-back')).toBeNull()
  })

  it('열린 묶음은 그대로 눌린다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')
    await 누르기(view, 'VIP 사우나')

    expect(view.getByTestId('spend-sheet-back')).toBeTruthy()
  })
})

/**
 * **이름 칸의 라벨은 갈래가 정한다**. 아이템 구매에서 그 칸이 묻는 것은
 * 무엇을 샀나 이지 어디에 썼나가 아니다.
 */
describe('직접 입력의 이름 칸', () => {
  it('아이템 구매는 구매 아이템이다', async () => {
    const view = await 그리기()

    await 누르기(view, '아이템 구매')

    expect(view.getByTestId('spend-sheet-name-label')).toHaveTextContent('구매 아이템')
  })

  it('기타는 `내용` 이다. 수입 `기타`와 같은 낱말이다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByTestId('spend-sheet-name-label')).toHaveTextContent('내용')
  })
})

/**
 * **직접 입력의 금액 뒤에 단위를 적는다**. 기타는 통화를 고르는 자리라
 * 숫자만 있으면 무엇으로 낸 것인지 줄에서 사라진다.
 */
describe('금액 줄의 단위', () => {
  it('고른 통화를 그대로 적는다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByTestId('spend-sheet-unit-price-unit')).toHaveTextContent('메소')

    await 누르기(view, '캐시')

    expect(view.getByTestId('spend-sheet-unit-price-unit')).toHaveTextContent('캐시')
  })
})

/**
 * **고를 것에 그림이 붙는다**.
 *
 * 그림이 있는 것만 붙는다. 없는 것에 무언가를 지어내 놓지 않는다.
 * 대신 **한 묶음 안에서는 자리를 맞춘다**: 그 묶음에 그림이 하나라도 있으면 없는 타일도 같은
 * 자리를 비워 둔다(안 그러면 같은 줄에서 이름의 높이가 어긋난다).
 */
describe('타일 그림', () => {
  it('그림이 있는 것에는 붙는다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('spend-tile-icon-몬스터 파크')).toBeTruthy()
  })

  it('버프 물약 넷은 다 붙는다', async () => {
    const view = await 그리기()

    await 누르기(view, '버프')

    for (const label of ['세이람의 영약', '알레리아의 영약', '콜렉터의 영약', '명예의 영약']) {
      expect(view.getByTestId(`spend-tile-icon-${label}`)).toBeTruthy()
    }
  })

  it('그림이 없는 것에는 안 붙는다. 지어내지 않는다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')

    // 아직 그림을 안 받은 셋. `이벤트` 묶음이 통째로 그렇다.
    expect(view.queryByTestId('spend-tile-icon-출석 이벤트 패스')).toBeNull()
    expect(view.queryByTestId('spend-tile-icon-보약 버프 추가 구매')).toBeNull()
  })

  // 이름이 바뀌면 표도 따라가야 한다. 안 고치면 **에러 없이 그림만** 사라진다
  // (`… 입장권` 을 뗐다).
  it('농장 둘은 이름이 바뀐 뒤에도 그림이 붙는다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')

    expect(view.getByTestId('spend-tile-icon-메카베리 농장')).toBeTruthy()
    expect(view.getByTestId('spend-tile-icon-블루베리 농장')).toBeTruthy()
  })

  // 조각 그림을 달았다가 *"그거 아니야"* 로 물렸고 사용자가 `sole_1000` 을 지정했다.
  // 그림은 **받은 것만** 단다는 규칙이 여기서 두 번 확인된다.
  it('솔 에르다에는 사용자가 지정한 그림이 붙는다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')

    expect(view.getByTestId('spend-tile-icon-솔 에르다')).toBeTruthy()
  })

  // 에픽던전 셋은 **지역 아이콘**에서 온다(원천이 둘이다. `lib/spend-icons` 주석).
  it('에픽던전 셋은 지역 아이콘을 단다', async () => {
    const view = await 그리기()

    for (const label of ['하이마운틴', '앵글러 컴퍼니', '악몽선경']) {
      expect(view.getByTestId(`spend-tile-icon-${label}`)).toBeTruthy()
    }
  })

  it('퀵 패스 셋도 그림을 단다. 이름에서 `퀵패스` 를 뗐다', async () => {
    const view = await 그리기()

    for (const label of ['에픽던전', '일간 퀘스트', '주간 퀘스트']) {
      expect(view.getByTestId(`spend-tile-icon-${label}`)).toBeTruthy()
    }
  })

  /**
   * 그림이 없는 타일은 **빈 자리도 안 만든다**.
   *
   * 그림이 왼쪽으로 가면서 높이를 안 건드리게 됐고, 그러자 자리를 비워 두는 일은
   * 폭만 먹었다. 미호로이드 교환권 이 교환 / 권 으로 끊겼다(iOS 실측).
   */
  it('그림이 없는 타일은 이름이 줄 전체를 쓴다', async () => {
    const view = await 그리기()

    await 누르기(view, '이벤트·BM')

    expect(view.queryByTestId('spend-tile-icon-slot-블랙 서큘레이터')).toBeNull()
    expect(view.queryByTestId('spend-tile-icon-slot-하이마운틴')).toBeNull()
  })
})

/**
 * `아이템 구매` 의 종류.
 *
 * 세그먼트 하나가 수량과 관세를 함께 가른다. 장비는 하나를 사고 월드를 넘을 수 있으며(관세),
 * 소비·기타는 여럿을 사고 월드 간 거래가 안 된다(관세 없음). 그래서 관세를 단가에 물리나
 * 총액에 물리나 라는 질문이 성립하지 않는다.
 */
describe('아이템 구매의 종류', () => {
  /**
   * 세그먼트 안에서 종류를 고르는 도우미. 갈래 칩에도 기타가 있어(`SPEND_CATEGORIES`) 라벨만으로는
   * 둘이 안 갈린다.
   */
  async function 종류고르기(view: Rendered, 종류: '장비' | '소비' | '기타'): Promise<void> {
    await act(async () => {
      fireEvent.press(
        within(view.getByTestId('spend-sheet-item-kind')).getByLabelText(종류),
      )
    })
  }

  async function 구매(종류?: '소비' | '기타') {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    if (종류 !== undefined) await 종류고르기(view, 종류)
    return view
  }

  async function 단가치기(view: Rendered, text: string): Promise<void> {
    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-unit-price'), text)
    })
  }

  async function 수량치기(view: Rendered, text: string): Promise<void> {
    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-quantity'), text)
    })
  }

  it('기본은 장비다. 수량 줄이 없고 관세가 있다', async () => {
    const view = await 구매()

    expect(
      within(view.getByTestId('spend-sheet-item-kind')).getByLabelText('장비').props
        .accessibilityState?.selected,
    ).toBe(true)
    expect(view.queryByTestId('spend-sheet-quantity')).toBeNull()
    expect(view.getByTestId('spend-sheet-tariff')).toBeTruthy()
  })

  // **월드 간 거래가 안 되는 것에 관세를 물을 수 있게 두지 않는다**. 끄는 것이
  // 아니라 **줄 자체가 없다**. 있는데 못 누르는 것은 **왜 못 누르나** 를 새로 묻게 만든다.
  it.each(['소비', '기타'] as const)('%s 는 관세 체크가 아예 없다', async (종류) => {
    const view = await 구매(종류)

    expect(view.queryByTestId('spend-sheet-tariff')).toBeNull()
  })

  it.each(['소비', '기타'] as const)('%s 는 단가 × 수량이고 큰 숫자를 못 친다', async (종류) => {
    const view = await 구매(종류)

    await 단가치기(view, '12000')
    await 수량치기(view, '300')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('360만')
    expect(view.getByTestId('spend-sheet-amount').props.onChangeText).toBeUndefined()
  })

  /**
   * **스테퍼가 아니다**. *"몇 백개 단위로도 살 수 있어서 스태퍼로
   * 하면 안돼."* 주문서 300장을 스테퍼로 세면 300번을 누른다.
   */
  it('수량은 치는 칸이다. 스테퍼 버튼이 없다', async () => {
    const view = await 구매('소비')

    expect(view.queryByLabelText('수량 늘리기')).toBeNull()
    expect(view.getByTestId('spend-sheet-quantity').props.onChangeText).toBeDefined()
  })

  /**
   * 단위는 `개` 다. 수량에 단위를 안 적는 근거는 `기타` 가 자유 입력이라 앱이 무엇을 세는지
   * 모른다는 것이었다. 아이템 구매에서 세는 것은 아이템이라 그 근거가 성립하지 않는다.
   */
  it('수량에 개를 적는다', async () => {
    const view = await 구매('소비')

    expect(view.getByTestId('spend-sheet-quantity-unit')).toHaveTextContent('개')
  })

  it('소비를 저장하면 합계·수량·종류가 함께 실린다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 종류고르기(view, '소비')
    await 단가치기(view, '12000')
    await 수량치기(view, '300')
    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-name'), '주문서')
    })
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '아이템 구매',
      item: '주문서',
      itemKind: '소비',
      quantity: 300,
      mesoAmount: 3_600_000,
      tariffMeso: null,
    })
  })

  // 장비는 하나를 산다. 곱할 것이 없으므로 수량 칸이 `null` 이다(그대로).
  it('장비를 저장하면 수량이 null 이고 관세가 실린다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')
    await 관세고르기(view, '10%')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      itemKind: '장비',
      quantity: null,
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })
  })

  /**
   * 종류를 바꾸면 **수량은 1 로, 관세는 꺼진다**. 관세를 안 끄면 **화면에 없는
   * 값이 저장된다**. 소비에는 그 체크가 아예 없기 때문이다.
   */
  it('종류를 바꾸면 관세가 꺼지고 수량이 1 로 돌아간다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '12000')
    await 관세고르기(view, '10%')

    await 종류고르기(view, '소비')
    await 수량치기(view, '300')
    await 종류고르기(view, '장비')
    await 누르기(view, '저장')

    // 관세가 남아 있었다면 13,200 이고, 수량이 남아 있었다면 3,600,000 이다.
    expect(onSave.mock.calls[0][0]).toMatchObject({ mesoAmount: 12_000, tariffMeso: null })
  })

  // **친 금액은 남긴다**. 수량이 1 이면 장비의 **금액** 과 소비의 **단가** 가 같은 값이라
  // 거짓이 되지 않는다.
  it('종류를 바꿔도 친 금액은 남는다', async () => {
    const view = await 구매()
    await 치기(view, '12000')

    await 종류고르기(view, '소비')

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('12000')
  })

  /**
   * 종류를 바꾸면 관세가 꺼지고 수량이 1 로 돌아가 합계가 사용자가 안 친 이유로 튄다.
   * 지켜야 할 것은 종류를 바꾼 뒤의 합계가 관세를 뗀 값이어야 한다는 것이다.
   */
  it('종류를 바꾸면 관세가 빠진 합계가 곧바로 선다', async () => {
    const view = await 구매()
    await 치기(view, '850000000')
    await 관세고르기(view, '10%')
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('9억 3500만')

    await 종류고르기(view, '소비')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('8억 5천만')
  })

  it('수량을 치면 합계가 그만큼 곱해진다', async () => {
    const view = await 구매()
    await 치기(view, '12000')
    await 종류고르기(view, '소비')

    await 수량치기(view, '300')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('360만')
  })

  it('단가만 있고 수량이 0 이면 저장할 수 없다', async () => {
    const view = await 구매('소비')
    await 단가치기(view, '12000')

    await 수량치기(view, '')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

/**
 * **수정 시트가 채워져 열린다**를 되짚는 식 하나로 지킨다
 * `단가 = (저장된 총액 − 관세분) ÷ 수량`.
 *
 * 그 식이 없던 동안 **관세가 두 번 붙었고**(친 값을 총액으로 채우면서 `hasTariff` 까지 켰다)
 * 기타는 합계가 총액 × 수량 이 됐다. 둘 다 여기서 붙든다.
 */
describe('되짚어 여는 식', () => {
  const 기록 = {
    id: 'spd-k',
    ocid: null,
    spentOn: '2026-08-23',
    form: null,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    memo: null,
    recordedAt: '2026-08-23T01:00:00.000Z',
  }

  async function 고치기(
    editing: React.ComponentProps<typeof SpendSheet>['editing'],
    overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {},
  ) {
    return 그리기({ editing, onDelete: jest.fn(), ...overrides })
  }

  it('관세 기록을 다시 열어도 관세가 두 번 안 붙는다', async () => {
    const view = await 고치기({
      ...기록,
      category: '아이템 구매',
      item: '앱솔 무기',
      itemKind: '장비',
      quantity: null,
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })

    // 손을 안 댄 상태의 큰 숫자는 **저장된 총액 그대로**여야 한다(935,000,000 × 1.1 이 아니라).
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('9억 3500만')
  })

  it('그 기록을 그대로 저장하면 값이 안 부푼다', async () => {
    const onSave = jest.fn()
    const view = await 고치기(
      {
        ...기록,
        category: '아이템 구매',
        item: '앱솔 무기',
        itemKind: '장비',
        quantity: null,
        mesoAmount: 935_000_000,
        tariffMeso: 85_000_000,
      },
      { onSave },
    )

    await 누르기(view, '수정')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })
  })

  it('소비 기록은 단가와 수량으로 갈라 연다', async () => {
    const view = await 고치기({
      ...기록,
      category: '아이템 구매',
      item: '주문서',
      itemKind: '소비',
      quantity: 300,
      mesoAmount: 3_600_000,
      tariffMeso: null,
    })

    expect(
      within(view.getByTestId('spend-sheet-item-kind')).getByLabelText('소비').props
        .accessibilityState?.selected,
    ).toBe(true)
    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('12000')
    expect(view.getByTestId('spend-sheet-quantity').props.value).toBe('300')
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('360만')
  })

  // **`NULL` 은 정정 이전 행이고 장비로 연다**. 그때의 아이템 구매는 **치는 금액 + 관세**
  // 였고, 그것이 정확히 장비의 모양이다.
  it('종류가 없는 옛 행은 장비로 연다', async () => {
    const view = await 고치기({
      ...기록,
      category: '아이템 구매',
      item: '앱솔 무기',
      itemKind: null,
      quantity: null,
      mesoAmount: 100_000,
      tariffMeso: null,
    })

    expect(
      within(view.getByTestId('spend-sheet-item-kind')).getByLabelText('장비').props
        .accessibilityState?.selected,
    ).toBe(true)
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('10만')
  })

  // `기타` 갈래도 같은 식으로 되짚는다. 그 전에는 금액 칸이 **총액**으로 채워지는데 수량도
  // 함께 살아나 합계가 **총액 × 수량** 이 됐다(30,000 이 90,000 으로 열렸다).
  it('`기타`의 수량 기록은 합계가 저장된 값 그대로다', async () => {
    const view = await 고치기({
      ...기록,
      category: '기타',
      item: '자유',
      itemKind: null,
      quantity: 3,
      mesoAmount: 30_000,
      tariffMeso: null,
    })

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('10000')
    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('3만')
  })
})

/**
 * **관세도 라벨–값 줄이다**.
 *
 * 시트에서 고르는 것은 전부 라벨 왼쪽· 값 오른쪽· 밑줄인데 관세만 **큰 숫자 밑의
 * 맨몸 체크박스**였다. 짝은 수입 시트의 수수료 [없음|3%|5%] 다.
 */
describe('관세 줄의 모양', () => {
  async function 장비() {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    return view
  }

  it('체크박스가 아니라 세그먼트다. `없음` 이 기본이다', async () => {
    const view = await 장비()

    const 관세 = within(view.getByTestId('spend-sheet-tariff'))
    expect(관세.getByLabelText('없음').props.accessibilityState?.selected).toBe(true)
    expect(관세.getByLabelText('10%')).toBeTruthy()
    // 옛 모양의 흔적. 체크박스 역할도, 줄에 박힌 `관세 10%` 라벨도 남지 않는다.
    expect(view.queryByLabelText('관세 10%')).toBeNull()
  })

  // **더해지는 금액을 안 적는다**. 큰 숫자가 그만큼 올라가는 것이 그 말이다.
  it('줄에 더해지는 금액을 안 적는다', async () => {
    const view = await 장비()
    await 치기(view, '850000000')

    await 관세고르기(view, '10%')

    expect(view.queryByText('+85,000,000')).toBeNull()
  })

  it('10% 를 고르면 큰 숫자가 관세를 더한 합계가 된다', async () => {
    const view = await 장비()
    await 치기(view, '850000000')

    await 관세고르기(view, '10%')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('9억 3500만')
  })

  it('`없음` 으로 되돌리면 친 값으로 돌아간다', async () => {
    const view = await 장비()
    await 치기(view, '850000000')
    await 관세고르기(view, '10%')

    await 관세고르기(view, '없음')

    expect(view.getByTestId('spend-sheet-amount')).toHaveTextContent('8억 5천만')
  })

  // 라벨–값 줄은 **큰 숫자 위**에 사는 물건이다. 모양을 맞추면 자리도 따라온다.
  it('큰 숫자 위에 선다', async () => {
    const view = await 장비()

    // 세로로 쌓이는 시트라 **나무의 차례가 곧 화면의 차례**다.
    const tree = JSON.stringify(view.toJSON())
    expect(tree.indexOf('spend-sheet-tariff')).toBeGreaterThan(-1)
    expect(tree.indexOf('spend-sheet-tariff')).toBeLessThan(tree.indexOf('spend-sheet-amount'))
  })
})

/**
 * 갈래마다 **자기 폼**이다.
 *
 * 한 함수가 갈래 다섯의 상태를 전부 들고 조건문으로 그리던 것이 갈래를 옮겨도 값을 들고 다닌다
 * 의 원인이었다. 이제 갈래가 폼을 가르므로
 * 옮기면 언마운트된다.
 */
describe('갈래마다 자기 폼', () => {
  async function 아이디로치기(view: Rendered, testID: string, text: string): Promise<void> {
    await act(async () => {
      fireEvent.changeText(view.getByTestId(testID), text)
    })
  }


  it('`아이템 구매`의 종류가 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 갈래누르기(view, '아이템 구매')
    await 누르기(view, '소비')
    expect(view.getByLabelText('소비').props.accessibilityState?.selected).toBe(true)

    await 갈래누르기(view, '기타')
    await 갈래누르기(view, '아이템 구매')

    // 기본값(장비)으로 돌아온다. 종류가 수량과 관세를 정하므로 남으면 화면이 딴 모양으로 열린다.
    expect(view.getByLabelText('장비').props.accessibilityState?.selected).toBe(true)
  })

  it('`기타`의 통화가 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 누르기(view, '기타')
    await 누르기(view, '캐시')
    expect(view.getByLabelText('캐시').props.accessibilityState?.selected).toBe(true)

    await 갈래누르기(view, '아이템 구매')
    await 갈래누르기(view, '기타')

    expect(view.getByLabelText('메소').props.accessibilityState?.selected).toBe(true)
  })

  it('친 금액도 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 갈래누르기(view, '기타')
    await 아이디로치기(view, 'spend-sheet-unit-price', '30000')

    await 갈래누르기(view, '아이템 구매')
    await 갈래누르기(view, '기타')

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('')
  })

  it('고른 대표·형태·단계가 갈래를 안 넘어간다', async () => {
    const view = await 그리기()
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')
    // 둘째 화면이다. 머리가 되돌아가는 누르개가 된다.
    expect(view.getByTestId('spend-sheet-choice')).toHaveTextContent('하이마운틴')

    await 누르기(view, '다시 고르기')
    await 갈래누르기(view, '아이템 구매')
    await 갈래누르기(view, '컨텐츠')

    // 목록으로 돌아와 있다. 고른 것이 남아 있으면 둘째 화면이 그대로 섰을 것이다.
    expect(view.getByTestId('spend-sheet-title')).toHaveTextContent('지출 추가')
    expect(view.queryByTestId('spend-sheet-choice')).toBeNull()
  })
})

/**
 * 수정으로 열면 그 기록의 값이 곧바로 선다.
 *
 * 값이 이전 기록의 금액에서 굴러오면 안 된다. 지금은 굴리는 장치가 없지만 회귀를 막으려고
 * 결과를 그대로 붙든다.
 */
describe('수정으로 열 때의 큰 숫자', () => {
  function 기타기록(mesoAmount: number) {
    return {
      id: `spend-${mesoAmount}`,
      ocid: null,
      spentOn: '2026-08-23',
      category: '기타' as const,
      item: '경매장 수수료',
      form: null,
      itemKind: null,
      quantity: 1,
      mesoAmount,
      tariffMeso: null,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      memo: null,
      recordedAt: '2026-08-23T01:00:00.000Z',
    }
  }

  it('다른 기록을 열면 그 기록의 금액이 곧바로 선다', async () => {
    const 먼저 = await 그리기({ editing: 기타기록(5_600_000_000), onDelete: jest.fn() })
    expect(먼저.getByTestId('spend-sheet-amount')).toHaveTextContent('56억')
    await act(async () => 먼저.unmount())

    const 나중 = await 그리기({ editing: 기타기록(12_100_000_000), onDelete: jest.fn() })

    expect(나중.getByTestId('spend-sheet-amount')).toHaveTextContent('121억')
  })
})

/**
 * 아이템 구매의 수량에는 단위가 붙는다. 수량에 단위를 안 적는 근거는 `기타` 가 자유 입력이라
 * 앱이 무엇을 세는지 모른다는 것이었고, 아이템 구매에서 세는 것은 아이템이다.
 */
describe('아이템 구매의 수량 단위', () => {
  it('소비·기타를 고르면 수량 옆에 개가 선다', async () => {
    const view = await 그리기()
    await 갈래누르기(view, '아이템 구매')
    await 누르기(view, '소비')

    expect(view.getByTestId('spend-sheet-quantity-unit')).toHaveTextContent('개')
  })

  it('장비에는 수량 줄 자체가 없다. 단위도 없다', async () => {
    const view = await 그리기()
    await 갈래누르기(view, '아이템 구매')

    // 기본이 장비다. 하나를 사므로 곱할 것이 없다.
    expect(view.queryByTestId('spend-sheet-quantity')).toBeNull()
    expect(view.queryByTestId('spend-sheet-quantity-unit')).toBeNull()
  })

  it('`기타` 갈래의 수량에는 여전히 단위가 없다. 무엇을 세는지 모른다', async () => {
    const view = await 그리기()
    await 갈래누르기(view, '기타')

    expect(view.getByTestId('spend-sheet-quantity')).toBeTruthy()
    expect(view.queryByTestId('spend-sheet-quantity-unit')).toBeNull()
  })
})

/**
 * 머리에서 **날짜를 바꾼다**.
 *
 * 수입 시트가 먼저 갖고 두 시트가 한 뼈대라 지출도 같은 부품을 쓴다.
 * 한쪽만 되는 상태가 남으면 그 자체가 왜 저기선 안 되나 가 된다.
 */
describe('날짜 바꾸기', () => {
  async function 아이디로누르기(view: Rendered, testID: string): Promise<void> {
    await act(async () => {
      fireEvent.press(view.getByTestId(testID))
    })
  }

  it('하루씩 앞뒤로 옮긴다', async () => {
    const view = await 그리기()
    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 23일 (일)')

    await 아이디로누르기(view, 'spend-sheet-date-prev')
    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 22일 (토)')

    await 아이디로누르기(view, 'spend-sheet-date-next')
    await 아이디로누르기(view, 'spend-sheet-date-next')
    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 24일 (월)')
  })

  it('바꾼 날짜로 저장된다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 갈래누르기(view, '기타')
    await 금액치기(view, '30000')
    await 아이디로누르기(view, 'spend-sheet-date-prev')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ spentOn: '2026-08-22' })
  })

  // 갈래 폼은 `key={category}` 로만 다시 심긴다. 날짜는 그 열쇠가 아니다.
  it('날짜를 바꿔도 **친 것이 안 사라진다**', async () => {
    const view = await 그리기()
    await 갈래누르기(view, '기타')
    await 금액치기(view, '30000')

    await 아이디로누르기(view, 'spend-sheet-date-prev')

    expect(view.getByTestId('spend-sheet-unit-price').props.value).toBe('30000')
  })

  it('목록 갈래의 둘째 화면에서도 바꾼다', async () => {
    const view = await 그리기()
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 아이디로누르기(view, 'spend-sheet-date-prev')

    // 되돌아가는 누르개가 선 그 줄에서 날짜도 함께 산다.
    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 22일 (토)')
    expect(view.getByTestId('spend-sheet-choice')).toHaveTextContent('하이마운틴')
  })
})
