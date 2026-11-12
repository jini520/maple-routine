// 사냥 기록을 고쳐 조각이 모자랄 때 뜨는 확인 창. 함께 바뀌는 기록과 금액 변화, 가격 칸, 두 버튼을 본다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { FragmentCutRow, FragmentCutsPrompt } from '../../../features/cashbook/fragment-cuts'
import type { IncomeRecord } from '../../../storage/income'
import { FragmentCutsConfirm } from '../FragmentCutsConfirm'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

const 사냥 = {
  id: 'hunt-17',
  earnedOn: '2026-09-17',
  category: 'hunting',
  hunt: { mode: 'manual', typedMeso: 0, fragments: 100, fragmentPrice: null },
} as IncomeRecord

const 줄: Record<string, FragmentCutRow> = {
  정산: {
    id: 'settle-18',
    name: '솔 에르다 조각 20개 판매',
    sub: '9월 18일 · 단풍소녀',
    fragmentsBefore: 20,
    fragmentsAfter: 0,
    side: 'income',
    mesoBefore: 133_000_000,
    mesoAfter: 0,
    removed: true,
    pricedFragments: 0,
  },
  지출그대로: {
    id: 'hexa-19',
    name: '매화검 본초 : 선참 VI 25 → 28',
    sub: '9월 19일 · 단풍소녀',
    fragmentsBefore: 20,
    fragmentsAfter: 0,
    side: 'spend',
    mesoBefore: 2_484_000_000,
    mesoAfter: 2_484_000_000,
    removed: false,
    pricedFragments: 0,
  },
  가격필요: {
    id: 'hexa-20',
    name: '헥사 스탯 Ⅰ',
    sub: '9월 20일 · 단풍소녀',
    fragmentsBefore: 60,
    fragmentsAfter: 0,
    side: 'spend',
    mesoBefore: 0,
    mesoAfter: null,
    removed: false,
    pricedFragments: 60,
  },
}

function 그리기(rows: FragmentCutRow[], change: FragmentCutsPrompt['preview']['change']): { view: Promise<Rendered>; answer: jest.Mock } {
  const answer = jest.fn()
  const prompt: FragmentCutsPrompt = { preview: { change, rows, key: 'k', candidatesOf: (ocid) => [ocid] }, hunt: 사냥, answer }
  return { view: Promise.resolve(renderOverlay(<FragmentCutsConfirm prompt={prompt} />)), answer }
}

async function 누르기(view: Rendered, testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID))
  })
}

/** 가격 칸을 눌러 입력 카드로 친다. */
async function 가격치기(view: Rendered, id: string, text: string): Promise<void> {
  await 누르기(view, `fragment-cuts-price-${id}`)
  await act(async () => {
    fireEvent.changeText(view.getByTestId('input-card-value'), text)
  })
  await 누르기(view, 'input-card-confirm')
}

const 고침 = { kind: 'edit', record: { ...사냥, hunt: { mode: 'manual', typedMeso: 0, fragments: 0, fragmentPrice: null } } as IncomeRecord } as const

describe('FragmentCutsConfirm', () => {
  it('고친 사냥의 날짜와 조각 변화, 바뀌는 기록마다 조각 변화와 금액 변화를 보인다', async () => {
    const { view: rendering } = 그리기([줄.정산!, 줄.지출그대로!], 고침)
    const view = await rendering

    expect(view.getByText('9월 17일 사냥의 조각을 100개에서 0개로 줄이면, 그 조각을 쓴 기록이 아래처럼 바뀝니다.')).toBeTruthy()
    expect(view.getByTestId('fragment-cuts-row-settle-18')).toHaveTextContent(/20 → 0개/)
    expect(view.getByTestId('fragment-cuts-effect-settle-18')).toHaveTextContent('수입 +1.33억 → 0 · 기록 지움')
    expect(view.getByTestId('fragment-cuts-effect-hexa-19')).toHaveTextContent('금액 그대로')
  })

  // 가격 없이 저장된 헥사 강화는 산 조각이 생겨도 앱이 가격을 짐작하지 않는다. 0 은 돈이 안 든 조각이라 받는다.
  it('가격이 필요하면 넣기 전까지 저장이 꺼지고, 0 메소도 받는다', async () => {
    const { view: rendering, answer } = 그리기([줄.가격필요!], { kind: 'remove', id: 'hunt-17' })
    const view = await rendering

    expect(view.getByText('9월 17일 사냥을 지우면, 그 조각을 쓴 기록이 아래처럼 바뀝니다.')).toBeTruthy()
    expect(view.getByTestId('fragment-cuts-effect-hexa-20')).toHaveTextContent('지출은 개당 가격을 넣으면 셉니다')
    expect(view.getByTestId('fragment-cuts-confirm')).toBeDisabled()

    await 가격치기(view, 'hexa-20', '5000000')
    expect(view.getByTestId('fragment-cuts-effect-hexa-20')).toHaveTextContent('지출 0 → −3억')
    await 가격치기(view, 'hexa-20', '0')
    expect(view.getByTestId('fragment-cuts-confirm')).toBeEnabled()
    await 누르기(view, 'fragment-cuts-confirm')

    expect(answer).toHaveBeenCalledWith({ 'hexa-20': 0 })
  })

  it('취소와 바깥을 누르면 아무것도 바꾸지 않는다는 답을 한다', async () => {
    const { view: rendering, answer } = 그리기([줄.정산!], 고침)
    const view = await rendering

    await 누르기(view, 'fragment-cuts-cancel')
    await 누르기(view, 'fragment-cuts')

    expect(answer.mock.calls).toEqual([[null], [null]])
  })
})
