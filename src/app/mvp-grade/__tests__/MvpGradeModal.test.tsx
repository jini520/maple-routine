/** MVP 등급 모달. 고르기와 확인 두 화면을 오가고, 주간 확인은 확인이 먼저다. */
import { fireEvent, within } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { MvpAsk } from '../../../features/mvp-grade/ask'
import type { MvpAskAccount } from '../../../features/mvp-grade/flow-store'
import { MvpGradeModal } from '../MvpGradeModal'

const TODAY = '2026-09-22'
const THIS_WEEK = '2026-09-17'

function account(accountId: string, name: string, currentGrade: MvpAskAccount['currentGrade'] = null): MvpAskAccount {
  return {
    accountId,
    summary: {
      accountId,
      representative: { ocid: `ocid-${accountId}`, name, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 },
      worldCounts: [{ worldKey: 'scania', world: '스카니아', count: 3 }],
      characterCount: 3,
    },
    portraitUrl: null,
    currentGrade,
  }
}

async function 그리기(ask: MvpAsk, accounts: MvpAskAccount[], weeklyOff = false) {
  const onDone = jest.fn()
  const view = await renderOverlay(
    <MvpGradeModal ask={ask} accounts={accounts} weeklyOff={weeklyOff} todayDateKey={TODAY} busy={false} onDone={onDone} />,
  )
  return { view, onDone }
}

function 카드(view: Awaited<ReturnType<typeof 그리기>>['view'], accountId: string) {
  return within(view.getByTestId(`mvp-grade-card-${accountId}`))
}

describe('MvpGradeModal', () => {
  describe('선택 흐름', () => {
    const ASK: MvpAsk = { kind: 'select', accountIds: ['a', 'b'], bulk: false }

    it('ID 마다 등급 일곱을 고르게 하고, 고르지 않은 ID 는 일반이다', async () => {
      const { view } = await 그리기(ASK, [account('a', '하나'), account('b', '둘')])

      expect(view.getByText('MVP 등급을 알려주세요')).toBeTruthy()
      expect(카드(view, 'a').getByText('스카니아 Lv.280 하나')).toBeTruthy()
      expect(카드(view, 'a').getByLabelText('일반').props.accessibilityState?.selected).toBe(true)
      expect(카드(view, 'a').getByText('경매장 수수료 5% · 스타포스 할인 없음')).toBeTruthy()
      expect(카드(view, 'a').getByText('적용 시작 주')).toBeTruthy()
      expect(카드(view, 'a').getByTestId('mvp-grade-start-a')).toHaveTextContent('9월 17일 (목)')
    })

    it('다음을 누르면 확인 화면이 고른 등급 · 혜택 · 적용 시작 주를 보인다', async () => {
      const { view } = await 그리기(ASK, [account('a', '하나'), account('b', '둘')])

      await fireEvent.press(카드(view, 'a').getByLabelText('다이아'))
      expect(카드(view, 'a').getByText('경매장 수수료 3% · 스타포스 10% 할인')).toBeTruthy()
      await fireEvent.press(view.getByText('다음'))

      expect(view.getByText('이 등급이 맞나요?')).toBeTruthy()
      expect(카드(view, 'a').getByLabelText('MVP 다이아')).toBeTruthy()
      expect(카드(view, 'a').getByText('경매장 수수료 3% · 스타포스 10% 할인')).toBeTruthy()
      expect(카드(view, 'a').getByText('9월 17일 (목)')).toBeTruthy()
      expect(카드(view, 'b').getByText('일반')).toBeTruthy()
    })

    it('수정은 고른 값을 든 채 고르기로 돌아간다', async () => {
      const { view } = await 그리기(ASK, [account('a', '하나'), account('b', '둘')])

      await fireEvent.press(카드(view, 'a').getByLabelText('골드'))
      await fireEvent.press(view.getByText('다음'))
      await fireEvent.press(view.getByText('수정'))

      expect(view.getByText('MVP 등급을 알려주세요')).toBeTruthy()
      expect(카드(view, 'a').getByLabelText('골드').props.accessibilityState?.selected).toBe(true)
    })

    it('맞아요를 누르면 ID 마다 등급과 시작 주를 돌려준다', async () => {
      const { view, onDone } = await 그리기(ASK, [account('a', '하나'), account('b', '둘')])

      await fireEvent.press(카드(view, 'a').getByLabelText('레드'))
      await fireEvent.press(view.getByText('다음'))
      await fireEvent.press(view.getByRole('checkbox', { name: '앞으로 등급은 직접 바꿀게요' }))
      await fireEvent.press(view.getByText('맞아요'))

      expect(onDone).toHaveBeenCalledWith({
        choices: [
          { accountId: 'a', grade: 'red', startWeek: THIS_WEEK, changed: true },
          { accountId: 'b', grade: 'normal', startWeek: THIS_WEEK, changed: true },
        ],
        weeklyOff: true,
        bulkApply: false,
      })
    })

    it('적용 시작 주는 가계부가 갈 수 있는 가장 이른 주부터 이번 주까지 고른다', async () => {
      const { view, onDone } = await 그리기(ASK, [account('a', '하나')])

      await fireEvent.press(카드(view, 'a').getByLabelText('적용 시작 주 고르기'))
      expect(view.getByTestId('week-calendar-popover')).toBeTruthy()
      expect(view.getByLabelText('2026-09-24').props.accessibilityState?.disabled).toBe(true)
      await fireEvent.press(view.getByLabelText('2026-09-08'))

      expect(view.queryByTestId('week-calendar-popover')).toBeNull()
      expect(카드(view, 'a').getByTestId('mvp-grade-start-a')).toHaveTextContent('9월 3일 (목)')
      await fireEvent.press(view.getByText('다음'))
      await fireEvent.press(view.getByText('맞아요'))
      expect(onDone.mock.calls[0][0].choices[0].startWeek).toBe('2026-09-03')
    })

    it('지난 기록이 없으면 일괄 적용 체크박스가 안 선다', async () => {
      const { view } = await 그리기(ASK, [account('a', '하나')])

      await fireEvent.press(view.getByText('다음'))

      expect(view.queryByText('지난 기록에도 수수료 적용하기')).toBeNull()
    })

    it('지난 기록이 있는 첫 흐름에는 일괄 적용 체크박스가 꺼진 채 선다', async () => {
      const { view, onDone } = await 그리기({ ...ASK, bulk: true }, [account('a', '하나')])
      await fireEvent.press(view.getByText('다음'))
      const bulk = view.getByRole('checkbox', { name: '지난 기록에도 수수료 적용하기' })
      expect(bulk.props.accessibilityState?.checked).toBe(false)
      await fireEvent.press(bulk)
      await fireEvent.press(view.getByText('맞아요'))

      expect(onDone.mock.calls[0][0].bulkApply).toBe(true)
    })

    it('새 메이플 ID 는 제목이 다르다', async () => {
      const { view } = await 그리기({ kind: 'newId', accountIds: ['c'], bulk: false }, [account('c', '셋')])

      expect(view.getByText('새 메이플 ID의 MVP 등급을 알려주세요')).toBeTruthy()
    })

    it('목록을 못 받은 ID 는 표시 없이 선다', async () => {
      const { view } = await 그리기(ASK, [{ accountId: 'a', summary: null, portraitUrl: null, currentGrade: null }])

      expect(카드(view, 'a').getByText('메이플 ID')).toBeTruthy()
    })
  })

  describe('주간 확인', () => {
    const ASK: MvpAsk = { kind: 'weekly', accountIds: ['a', 'b'] }

    it('확인 화면이 먼저 서고 지금 등급을 보인다. 시작 주 줄은 없다', async () => {
      const { view } = await 그리기(ASK, [account('a', '하나', 'diamond'), account('b', '둘', 'silver')])

      expect(view.getByText('이번 주 MVP 등급이 맞나요?')).toBeTruthy()
      expect(카드(view, 'a').getByLabelText('MVP 다이아')).toBeTruthy()
      expect(view.queryByText('바뀐 등급 적용 시작 주')).toBeNull()
    })

    it('수정에서 등급을 바꾼 ID 에만 시작 주 줄이 선다', async () => {
      const { view, onDone } = await 그리기(ASK, [account('a', '하나', 'diamond'), account('b', '둘', 'silver')])

      await fireEvent.press(view.getByText('수정'))
      expect(view.getByText('바뀐 등급을 골라 주세요')).toBeTruthy()
      expect(view.queryByText('바뀐 등급 적용 시작 주')).toBeNull()

      await fireEvent.press(카드(view, 'b').getByLabelText('골드'))
      expect(카드(view, 'b').getByText('바뀐 등급 적용 시작 주')).toBeTruthy()
      expect(카드(view, 'a').queryByText('바뀐 등급 적용 시작 주')).toBeNull()

      await fireEvent.press(view.getByText('다음'))
      expect(카드(view, 'b').getByText('바뀐 등급 적용 시작 주')).toBeTruthy()
      await fireEvent.press(view.getByText('맞아요'))

      expect(onDone).toHaveBeenCalledWith({
        choices: [
          { accountId: 'a', grade: 'diamond', startWeek: THIS_WEEK, changed: false },
          { accountId: 'b', grade: 'gold', startWeek: THIS_WEEK, changed: true },
        ],
        weeklyOff: false,
        bulkApply: false,
      })
    })
  })

  it('직접 바꾸기 체크박스는 저장된 값으로 선다', async () => {
    const { view } = await 그리기({ kind: 'newId', accountIds: ['c'], bulk: false }, [account('c', '셋')], true)

    await fireEvent.press(view.getByText('다음'))

    expect(view.getByRole('checkbox', { name: '앞으로 등급은 직접 바꿀게요' }).props.accessibilityState?.checked).toBe(true)
  })
})
