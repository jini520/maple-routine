// 지출 기록 시트([[ADR-166]] · [[ADR-170]] 결정 6).
//
// **갈래는 시트 밖에서 갈렸다** — 펼침판이 「지출」을 골라 이 시트를 연다. 그래서 이 시트에는
// 수입/지출 세그먼트가 없고, 자기가 지출이라는 것을 **모른 채** 받은 것을 그린다.
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

// 시트 껍데기는 `BossDropSheet.test.tsx` 와 같은 방식으로 세운다 — 라이브러리를 목으로 갈아
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
import { SpendSheet } from '../SpendSheet'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function 그리기(overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {}) {
  return renderOverlay(
    <SpendSheet
      dateKey="2026-08-23"
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
 * 에픽던전 리워드는 **두 단계**다(사용자 지정 2026-08-25) — 대표를 고르고, 그 안에서 형태와
 * 단계를 고른다. 단계도 형태도 없는 항목(몬스터 파크·영약)은 `누르기` 한 번으로 끝난다.
 */
async function 에픽던전(view: Rendered, 대표: string, 형태: string, 단계: string): Promise<void> {
  await 누르기(view, 대표)
  await 누르기(view, 형태)
  await 누르기(view, 단계)
}

describe('머리', () => {
  it('어느 날에 적히는지 말한다 — FAB 는 날짜를 안 들고 온다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('spend-sheet-date')).toHaveTextContent('8월 23일 (일)')
  })

  it('수입/지출 세그먼트가 없다 — 갈래는 펼침판이 이미 갈랐다', async () => {
    const view = await 그리기()

    expect(view.queryByLabelText('수입')).toBeNull()
  })
})

describe('갈래 칩', () => {
  // [[ADR-166]] 정정 1 ② 의 다섯 — 목록 셋과 직접 입력 둘.
  it('다섯이 다 선다', async () => {
    const view = await 그리기()

    for (const label of ['컨텐츠', '상점·편의', '버프', '아이템 구매', '기타']) {
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

  // 고르던 항목이 남아 있으면 «컨텐츠를 골랐는데 버프 항목이 저장되는» 일이 생긴다.
  it('갈래를 바꾸면 고르던 항목이 풀린다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 누르기(view, '버프')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('항목 — 고르면 채워진다', () => {
  // 가격이 전부 고정이라 «목록만 받고 금액은 매번 입력» 이 아니다([[ADR-166]] 정정 1 ①).
  it('묶음 이름과 **대표**가 파일 차례대로 선다', async () => {
    const view = await 그리기()

    expect(view.getByText('에픽던전 추가 리워드')).toBeTruthy()
    expect(view.getByLabelText('하이마운틴')).toBeTruthy()
    // 단계는 목록에 안 선다 — 대표를 고른 뒤에 나온다.
    expect(view.queryByLabelText('하이마운틴 1단계')).toBeNull()
  })

  // 갈래 하나 안에서 통화가 갈리는 곳이 있다 — 「버프」의 영약은 메소, 보약은 메포다.
  // 숫자만 적으면 타일만 보고는 어느 쪽인지 모른다([[ADR-166]] 정정 1 ②).
  it('메포 항목은 단위가 「메포」다', async () => {
    const view = await 그리기()

    // 몬스터 파크는 단계가 없어 값이 하나로 정해진다.
    expect(view.getByText('600 메포')).toBeTruthy()
  })

  // 단계가 여럿이면 **나란히** 적는다(사용자 지정 2026-08-25). 한 대표 안의 단계는 통화가 같으므로
  // 단위는 한 번만 — 두 번 적으면 좁은 칸에서 숫자가 밀린다.
  it('단계가 여럿인 대표는 가격을 나란히 적는다', async () => {
    const view = await 그리기()

    expect(view.getByText('7,500 | 30,000 메포')).toBeTruthy()
    expect(view.getByText('10,000 | 40,000 메포')).toBeTruthy()
    expect(view.getByText('12,500 | 50,000 메포')).toBeTruthy()
  })

  it('메소 항목은 단위가 「메소」이고 줄여 적는다 — 좁은 칸이다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    // 세이람·알레리아가 둘 다 200만이라 같은 글자가 두 번 선다 — 그것 자체가 맞는 표기다.
    expect(view.getAllByText('200만 메소')).toHaveLength(2)
    expect(view.getByText('2,000만 메소')).toBeTruthy()
  })

  it('한 갈래 안에서 통화가 갈려도 타일마다 구분된다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    // 영약은 메소, 보약 버프는 메포다.
    expect(view.getByText('500만 메소')).toBeTruthy()
    expect(view.getByText('9,900 메포')).toBeTruthy()
  })

  it('고르기 전에는 저장할 수 없다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  it('고르면 단가가 그대로 금액이 된다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    // 30,000 메포 ÷ 1,180 → 25.42억. 부호까지 붙든다 — 지출은 언제나 빼는 쪽이다.
    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('−25.42억')
  })
})

describe('수량 — 곱셈은 앱이 한다', () => {
  // 사용자가 곱셈을 대신하면 «몇 포인트 썼나» 를 나중에 되물을 수 없다([[ADR-166]] 정정 1 ③).
  it('단위 이름은 카탈로그가 준다 — 레코드에 안 적는다', async () => {
    const view = await 그리기()
    await 누르기(view, '버프')

    await 누르기(view, '보약 버프 추가 구매')

    expect(view.getByTestId('spend-sheet-quantity-unit')).toHaveTextContent('포인트')
  })

  it('회 단위 항목은 「회」다', async () => {
    const view = await 그리기()

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByTestId('spend-sheet-quantity-unit')).toHaveTextContent('회')
  })

  it('수량을 올리면 금액이 그만큼 는다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 누르기(view, '수량 늘리기')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ quantity: 2, pointAmount: 60_000 })
  })

  it('1 아래로는 못 내린다', async () => {
    const view = await 그리기()
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByLabelText('수량 줄이기').props.accessibilityState?.disabled).toBe(true)
  })

  it('단계를 바꾸면 수량이 1 로 돌아간다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave, lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')
    await 누르기(view, '수량 늘리기')

    await 누르기(view, '1단계')
    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({ item: '하이마운틴 1단계', quantity: 1 })
  })

  // 목록으로 돌아가면 고르던 것이 통째로 풀린다 — 남으면 «대표는 몬스터 파크인데 저장되는 것은
  // 하이마운틴» 이 된다.
  it('다시 고르기를 누르면 목록으로 돌아가고 고르던 것이 풀린다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    await 누르기(view, '다시 고르기')

    expect(view.getByLabelText('하이마운틴')).toBeTruthy()
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // 머리줄이 지금 어디인지를 말한다 — ②로 들어가면 제목이 고른 것의 이름이 되고 그 왼쪽이
  // 돌아가는 자리다(사용자 지정 2026-08-25). 목록에서는 돌아갈 데가 없으니 서 있으면 안 된다.
  it('②에서는 머리줄이 고른 것의 이름과 뒤로 가는 자리가 된다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    expect(view.queryByTestId('spend-sheet-back')).toBeNull()
    expect(view.getByText('지출 추가')).toBeTruthy()

    await 누르기(view, '하이마운틴')

    expect(view.getByTestId('spend-sheet-back')).toBeTruthy()
    expect(view.getByTestId('spend-sheet-choice')).toHaveTextContent('하이마운틴')
    expect(view.queryByText('지출 추가')).toBeNull()
  })

  // 사용자가 준 한도를 **화면이 들고 있어야** 한다 — 데이터에만 있고 안 보이면 받은 뜻이 없다
  // (사용자 지적 2026-08-25). 앱은 세지 않는다: 몬스터 파크 한도는 축이 셋(월드·캐릭터·무료)인데
  // 앱은 지금 어느 월드·어느 캐릭터인지 모른다([[ADR-166]] 정정 1 ⑤).
  it('한도가 있는 항목은 사용자 문장 그대로 적는다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '몬스터 파크')

    expect(view.getByTestId('spend-sheet-limit')).toHaveTextContent(
      '한도 · 일간 월드당 최대 14회, 캐릭터 당 최대 7회, 일간 무료 2회',
    )
  })

  // 한도가 없는 항목에 빈 줄이 서면 «한도가 0» 으로 읽힌다.
  it('한도가 없는 항목에는 그 줄이 서지 않는다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 누르기(view, '에픽던전 퀵패스')

    expect(view.queryByTestId('spend-sheet-limit')).toBeNull()
  })

  // 한도를 적어만 두면 **넘겨서 적을 수 있다** — 스테퍼가 막아야 한다(사용자 지적 2026-08-25).
  // 몬스터 파크는 상한이 14 다(사용자 지정 — 축 셋 중 «월드당 일간»).
  it('한도가 있으면 스테퍼가 그 수에서 멈춘다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '몬스터 파크')

    for (let i = 0; i < 20; i += 1) await 누르기(view, '수량 늘리기')

    expect(view.getByText('14')).toBeTruthy()
    expect(view.getByLabelText('수량 늘리기').props.accessibilityState?.disabled).toBe(true)
  })

  // 상한이 1 이면 늘리는 자리가 처음부터 막혀 있어야 한다 — 눌리는데 안 늘면 고장으로 읽힌다.
  it('상한이 1이면 늘리는 자리가 처음부터 막힌다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '상점·편의')
    await 누르기(view, '미호로이드 교환권')

    expect(view.getByLabelText('수량 늘리기').props.accessibilityState?.disabled).toBe(true)
  })

  // 상한이 없는 항목은 계속 는다 — 없는 한도를 앱이 지어내면 그것이 추정이다([[ADR-006]]).
  it('한도가 없으면 스테퍼가 안 막힌다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '에픽던전 퀵패스')

    for (let i = 0; i < 20; i += 1) await 누르기(view, '수량 늘리기')

    expect(view.getByLabelText('수량 늘리기').props.accessibilityState?.disabled).toBeFalsy()
  })

  // 형태가 있는데 안 고르면 «어느 쪽인지 모르는 행» 이 된다 — 칸을 더한 뜻이 사라진다.
  it('형태를 안 고르면 저장이 막힌다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '하이마운틴')

    await 누르기(view, '2단계')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })
})

// [[ADR-166]] 정정 2 ③ — 시세 없이 저장하면 그 행은 **영영 메소로 표시할 수 없는 행**이 된다.
describe('메소마켓 시세', () => {
  it('메포 항목을 고르면 시세 칸이 선다', async () => {
    const view = await 그리기()

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByTestId('spend-sheet-rate')).toBeTruthy()
  })

  it('메소 항목에는 안 선다 — 물어볼 이유가 없다', async () => {
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

  // [[ADR-166]] 결정 5 — 금액은 매번 다르지만 시세는 좀처럼 안 바뀐다. 필수 칸이 매번 비어 있으면
  // 입력이 막히므로 «기억한다» 가 여기서 결정적이다.
  it('마지막으로 쓴 시세가 채워져 있다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })

    await 에픽던전(view, '하이마운틴', '경험치', '2단계')

    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(false)
  })

  // 시세는 네 자리라 OS 숫자 키패드로 충분하다 — [[ADR-124]] 가 막은 것은 큰 메소다.
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
  it('메포 항목은 원금과 시세를 함께 박는다 — 메소 칸은 비운다', async () => {
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

// ══ 직접 입력 갈래 둘 ([[ADR-166]] 결정 2·7 · 정정 1 ② · 정정 2 ②) ═══════════════
//
// 목록 갈래 셋과 폼이 통째로 다르다 — 고를 것이 없고 **금액을 친다.**

/** 금액 칸에 **친다** — OS 숫자 키보드다([[ADR-170]] 정정 4). 칸이 콤마째 값을 받는다. */
async function 치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('spend-sheet-amount'), text)
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
   * 금액은 **OS 숫자 키보드**다([[ADR-170]] 정정 4). 앱 키패드를 안 두는 이유는 이 시트가
   * 사용처·시세 칸 때문에 **어차피 키보드를 부르기** 때문이다.
   */
  it('앱 키패드를 안 그리고 숫자 키보드를 부른다', async () => {
    const view = await 그리기()

    await 누르기(view, '아이템 구매')

    expect(view.queryByLabelText('한 자리 지우기')).toBeNull()
    expect(view.getByTestId('spend-sheet-amount').props.keyboardType).toBe('number-pad')
  })

  it('금액이 0 이면 저장할 수 없다', async () => {
    const view = await 그리기()

    await 누르기(view, '아이템 구매')

    expect(view.getByLabelText('저장').props.accessibilityState?.disabled).toBe(true)
  })

  // **친 숫자는 안 바뀐다**([[ADR-170]] 시안) — 관세는 아래에 한 줄로 더해진다. 금액을 직접
  // 고치면 껐다 켰다 할 때 8.5억 → 9.35억 → 10.28억 으로 부푼다.
  it('관세를 켜도 친 금액은 그대로다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')

    await 누르기(view, '관세 10%')

    expect(view.getByTestId('spend-sheet-amount').props.value).toBe('850,000,000')
  })

  it('관세를 켜면 합계가 10% 는다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')

    await 누르기(view, '관세 10%')

    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('−9.35억')
  })

  it('껐다 켜도 부풀지 않는다', async () => {
    const view = await 그리기()
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')

    await 누르기(view, '관세 10%')
    await 누르기(view, '관세 10%')
    await 누르기(view, '관세 10%')

    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('−9.35억')
  })

  // 총액과 그 몫을 **둘 다** 박는다([[ADR-166]] 정정 2 ②) — 집계는 총액 한 칸만 본다.
  it('총액과 관세분을 함께 저장한다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '아이템 구매')
    await 치기(view, '850000000')
    await 누르기(view, '관세 10%')

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

  // 시세를 안 물어도 된다 — 관세가 «메소 가치 기준 10%» 라 양변에서 상쇄된다(정정 2 ②).
  it('시세를 안 묻는다', async () => {
    const view = await 그리기({ lastPointRate: null })

    await 누르기(view, '아이템 구매')

    expect(view.queryByTestId('spend-sheet-rate')).toBeNull()
  })
})

describe('기타 — 캐시가 사는 유일한 자리', () => {
  it('통화 셋을 고른다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByLabelText('메소')).toBeTruthy()
    expect(view.getByLabelText('메포')).toBeTruthy()
    expect(view.getByLabelText('캐시')).toBeTruthy()
  })

  it('메소로 시작한다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.getByLabelText('메소').props.accessibilityState?.selected).toBe(true)
  })

  it('관세는 아이템 구매에만 있다', async () => {
    const view = await 그리기()

    await 누르기(view, '기타')

    expect(view.queryByLabelText('관세 10%')).toBeNull()
  })

  it('메포를 고르면 시세를 묻는다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '기타')

    await 누르기(view, '메포')

    expect(view.getByTestId('spend-sheet-rate')).toBeTruthy()
  })

  // **캐시는 환산하지 않는다**([[ADR-166]] 정정 2 ①) — 현금과 게임 재화의 교환비가 실제로
  // 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 그 경로에 값을 매기는 것처럼 읽힌다.
  it('캐시는 시세를 안 묻는다 — 환산 자체를 안 한다', async () => {
    const view = await 그리기({ lastPointRate: 1_180 })
    await 누르기(view, '기타')

    await 누르기(view, '캐시')

    expect(view.queryByTestId('spend-sheet-rate')).toBeNull()
  })

  it('캐시는 원 단위로 적고 캐시 칸에 담긴다', async () => {
    const onSave = jest.fn()
    const view = await 그리기({ onSave })
    await 누르기(view, '기타')
    await 누르기(view, '캐시')
    await 치기(view, '6900')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      category: '기타',
      cashAmount: 6_900,
      mesoAmount: null,
      pointAmount: null,
    })
  })

  it('캐시 금액에는 메소 빠른 칩이 안 뜬다 — 1만원짜리에 +100억은 없다', async () => {
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
    await 치기(view, '30000')

    await 누르기(view, '저장')

    expect(onSave.mock.calls[0][0]).toMatchObject({
      pointAmount: 30_000,
      pointPer100mMeso: 1_180,
      cashAmount: null,
    })
  })

  it('통화를 바꿔도 친 금액은 남는다 — 단위만 갈린다', async () => {
    const view = await 그리기()
    await 누르기(view, '기타')
    await 치기(view, '123')

    await 누르기(view, '캐시')

    expect(view.getByTestId('spend-sheet-amount').props.value).toBe('123')
  })
})

// ══ 시세가 없을 때 화면이 말하게 한다 ([[ADR-166]] 정정 2 ③) ═══════════════════
//
// 저장이 막히는 것은 맞다 — 시세 없이 저장한 행은 **영영 메소로 표시할 수 없다**. 문제는 화면이
// 그 사실을 말하지 않던 것이다: 「저장」이 왜 안 눌리는지 안 보이고, 합계가 **「−0」** 으로 떠서
// «0원짜리 지출» 로 읽혔다(iOS 실측 2026-08-25).

describe('시세가 비어 있을 때', () => {
  async function 메포항목(overrides: Partial<React.ComponentProps<typeof SpendSheet>> = {}) {
    const view = await 그리기({ lastPointRate: null, ...overrides })
    await 에픽던전(view, '하이마운틴', '경험치', '2단계')
    return view
  }

  it('합계에 0 을 적지 않는다 — 0 원짜리 지출이 아니다', async () => {
    const view = await 메포항목()

    expect(view.getByTestId('spend-sheet-total')).not.toHaveTextContent('−0')
  })

  // 아직 아는 것은 있다 — **메포 원금**은 확정됐다. 모르는 것은 그것이 메소로 얼마인가다.
  it('아는 것은 보여준다 — 메포 원금', async () => {
    const view = await 메포항목()

    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('30,000 메포')
  })

  // 「지금 비었다」가 아니라 **「이 칸은 반드시 있어야 한다」** 를 말하는 자리라 채워도 안 사라진다.
  it('시세 칸이 필수임을 별표로 말한다', async () => {
    const view = await 메포항목()

    expect(view.getByTestId('spend-sheet-required')).toBeTruthy()
  })

  it('시세를 넣으면 메소가 서고 별표는 남는다', async () => {
    const view = await 메포항목()

    await act(async () => {
      fireEvent.changeText(view.getByTestId('spend-sheet-rate'), '1180')
    })

    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('−25.42억')
    expect(view.getByTestId('spend-sheet-required')).toBeTruthy()
  })

  it('메소 항목에는 시세 칸도 별표도 없다 — 물어본 적이 없다', async () => {
    const view = await 그리기({ lastPointRate: null })
    await 누르기(view, '버프')

    await 누르기(view, '세이람의 영약')

    expect(view.queryByTestId('spend-sheet-required')).toBeNull()
    expect(view.getByTestId('spend-sheet-total')).toHaveTextContent('−200만')
  })
})
