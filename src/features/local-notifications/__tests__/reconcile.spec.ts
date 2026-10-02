// 재조정의 차집합. 가까운 자리만큼만 잡고, 같으면 건드리지 않고, 문구가 바뀌면 다시 잡는다.
import { notificationId, planReconcile, type PlannedNotification } from '../reconcile'

function planned(id: number, fireAt: number, overrides: Partial<PlannedNotification> = {}): PlannedNotification {
  return { id, kind: 'party-appointment', fireAt, title: '제목', body: `본문 ${id}`, ...overrides }
}

describe('planReconcile', () => {
  it('원장에 없는 것은 예약하고, 원장에만 있는 것은 취소한다', () => {
    const result = planReconcile([planned(1, 100)], [{ ...planned(2, 200) }])

    expect(result.schedule.map((item) => item.id)).toEqual([1])
    expect(result.cancel.map((item) => item.id)).toEqual([2])
    expect(result.keep).toEqual([])
  })

  it('시각 · 문구가 같으면 아무것도 안 한다', () => {
    const result = planReconcile([planned(1, 100)], [planned(1, 100)])

    expect(result.schedule).toEqual([])
    expect(result.cancel).toEqual([])
    expect(result.keep.map((item) => item.id)).toEqual([1])
  })

  // 보스만 바꾸고 시각은 그대로인 약속이 옛 문구로 울리면 안 된다.
  it('시각이 같아도 문구가 바뀌면 다시 예약한다', () => {
    const result = planReconcile([planned(1, 100, { body: '새 문구' })], [planned(1, 100)])

    expect(result.schedule.map((item) => item.body)).toEqual(['새 문구'])
    expect(result.cancel).toEqual([])
  })

  it('시각이 바뀌면 다시 예약한다', () => {
    const result = planReconcile([planned(1, 150)], [planned(1, 100)])

    expect(result.schedule.map((item) => item.fireAt)).toEqual([150])
  })

  // iOS 는 가까운 64개만 둔다. 먼 것은 다음 재조정이 채운다.
  it('울릴 시각 순으로 자리 수만큼만 잡고, 자리를 벗어난 원장 항목은 취소한다', () => {
    const result = planReconcile([planned(3, 300), planned(1, 100), planned(2, 200)], [planned(3, 300)], 2)

    expect(result.schedule.map((item) => item.id)).toEqual([1, 2])
    expect(result.cancel.map((item) => item.id)).toEqual([3])
  })

  it('기본 자리는 64개다', () => {
    const many = Array.from({ length: 70 }, (_, index) => planned(index + 1, index))

    expect(planReconcile(many, []).schedule).toHaveLength(64)
  })
})

describe('notificationId', () => {
  it('같은 회차는 늘 같은 id 다', () => {
    expect(notificationId('party-appointment', 'a1', '2026-10-08')).toBe(
      notificationId('party-appointment', 'a1', '2026-10-08'),
    )
  })

  it('회차가 다르면 id 가 다르다', () => {
    expect(notificationId('party-appointment', 'a1', '2026-10-08')).not.toBe(
      notificationId('party-appointment', 'a1', '2026-10-15'),
    )
  })

  it('양의 정수다', () => {
    const id = notificationId('party-appointment', 'a1', '2026-10-08')

    expect(Number.isSafeInteger(id)).toBe(true)
    expect(id).toBeGreaterThan(0)
  })
})
