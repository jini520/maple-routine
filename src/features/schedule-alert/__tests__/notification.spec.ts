// 미완료 스케줄 알림의 계획. 매일 21:00 KST 하루 한 장이고, 마지막으로 아는 상태를 단정하지 않는다.
import { notificationId } from '../../local-notifications/reconcile'
import { planScheduleAlerts, SCHEDULE_ALERT_KIND, type ScheduleAlertState } from '../notification'

const NONE = { daily: false, weekly: false, monthly: false }

function state(remaining: Partial<ScheduleAlertState['remaining']> = {}, hasCharacters = true): ScheduleAlertState {
  return { hasCharacters, remaining: { ...NONE, ...remaining } }
}

/** KST 시각의 Date */
const kst = (text: string): Date => new Date(`${text}+09:00`)

// 2026-10-05(월) 10:00 KST. 주간 리셋 주는 10-01(목) ~ 10-07(수)다.
const MONDAY = kst('2026-10-05T10:00:00')

describe('planScheduleAlerts', () => {
  it('앞으로 7일 안의 날마다 21:00 KST 에 한 장이다', () => {
    const planned = planScheduleAlerts(state({ daily: true }), MONDAY)

    expect(planned.map((item) => new Date(item.fireAt).toISOString())).toEqual([
      '2026-10-05T12:00:00.000Z',
      '2026-10-06T12:00:00.000Z',
      '2026-10-07T12:00:00.000Z',
      '2026-10-08T12:00:00.000Z',
      '2026-10-09T12:00:00.000Z',
      '2026-10-10T12:00:00.000Z',
      '2026-10-11T12:00:00.000Z',
    ])
    const [today] = planned
    expect(today!.kind).toBe(SCHEDULE_ALERT_KIND)
    expect(today!.channel).toBe('schedule')
    expect(today!.id).toBe(notificationId(SCHEDULE_ALERT_KIND, 'day', '2026-10-05'))
    expect(today!.data).toEqual({ kind: SCHEDULE_ALERT_KIND, cycle: 'daily', dateKey: '2026-10-05' })
  })

  it('21:00 이 지난 날은 계획하지 않는다', () => {
    const planned = planScheduleAlerts(state({ daily: true }), kst('2026-10-05T21:30:00'))

    expect(planned[0]!.fireAt).toBe(kst('2026-10-06T21:00:00').getTime())
  })

  it('추적 캐릭터가 없으면 비어 있다', () => {
    expect(planScheduleAlerts(state({ daily: true }, false), MONDAY)).toEqual([])
  })

  it('오늘은 마지막 상태를 믿고, 남은 것이 있으면 그 주기만 제목에 적는다', () => {
    const [today] = planScheduleAlerts(state({ daily: true, weekly: true }), MONDAY)

    // 월요일은 주간이 들지 않는 날이다. 주간이 남았어도 제목에 없다.
    expect(today!.title).toBe('일간 스케줄이 남은 것 같아요')
    expect(today!.body).toBe('마지막으로 확인했을 때 기준이에요. 끝냈다면 앱을 열어 갱신해 주세요. 자정에 초기화돼요')
  })

  it('드는 주기를 전부 다 한 것으로 확인되면 그날은 비고, 모르는 날은 남는다', () => {
    const planned = planScheduleAlerts(state(), MONDAY)

    // 오늘(일간만 들고 다 했다)은 빠지고 내일부터 선다.
    expect(planned[0]!.fireAt).toBe(kst('2026-10-06T21:00:00').getTime())
    expect(planned).toHaveLength(6)
  })

  it('내일 이후의 일간은 초기화 뒤라 모르는 것이고, 남은 것으로 보아 확인하지 못했다고 적는다', () => {
    const [, tomorrow] = planScheduleAlerts(state({ daily: true }), MONDAY)

    expect(tomorrow!.title).toBe('일간 스케줄이 남은 것 같아요')
    expect(tomorrow!.body).toBe('초기화 뒤에 확인하지 못했어요. 앱을 열면 갱신돼요. 자정에 초기화돼요')
  })

  it('수요일은 주간이 들고, 같은 리셋 주면 마지막 상태를 믿는다', () => {
    const wednesday = (remaining: Partial<ScheduleAlertState['remaining']>) =>
      planScheduleAlerts(state(remaining), MONDAY).find((item) => item.fireAt === kst('2026-10-07T21:00:00').getTime())!

    // 주간이 남았다. 일간은 모르는 날이라 함께 선다.
    expect(wednesday({ weekly: true }).title).toBe('일간 · 주간 스케줄이 남은 것 같아요')
    expect(wednesday({ weekly: true }).data).toEqual({ kind: SCHEDULE_ALERT_KIND, cycle: 'daily', dateKey: '2026-10-07' })
    // 주간을 다 했다. 같은 리셋 주라 그 상태를 믿고 제목에서 뺀다.
    expect(wednesday({ weekly: false }).title).toBe('일간 스케줄이 남은 것 같아요')
  })

  it('다음 리셋 주의 수요일은 주간을 모르는 것이라 남은 것으로 본다', () => {
    // 10-07(수) 22:00. 다음 수요일 10-14 21:00 이 7일 안에 든다.
    const planned = planScheduleAlerts(state(), kst('2026-10-07T22:00:00'))
    const nextWednesday = planned.find((item) => item.fireAt === kst('2026-10-14T21:00:00').getTime())

    expect(nextWednesday!.title).toBe('일간 · 주간 스케줄이 남은 것 같아요')
    expect(nextWednesday!.body).toBe('초기화 뒤에 확인하지 못했어요. 앱을 열면 갱신돼요. 자정에 초기화돼요')
  })

  it('그 달의 마지막 날은 월간이 들고, 같은 달이면 마지막 상태를 믿는다', () => {
    const lastDay = (remaining: Partial<ScheduleAlertState['remaining']>) =>
      planScheduleAlerts(state(remaining), kst('2026-10-29T10:00:00')).find(
        (item) => item.fireAt === kst('2026-10-31T21:00:00').getTime(),
      )!

    expect(lastDay({ monthly: true }).title).toBe('일간 · 월간 스케줄이 남은 것 같아요')
    expect(lastDay({ monthly: false }).title).toBe('일간 스케줄이 남은 것 같아요')
    // 11-01 은 월간이 드는 날이 아니다.
    const planned = planScheduleAlerts(state({ monthly: true }), kst('2026-10-29T10:00:00'))
    expect(planned.find((item) => item.fireAt === kst('2026-11-01T21:00:00').getTime())!.title).toBe('일간 스케줄이 남은 것 같아요')
  })

  it('남은 주기 중 첫째가 탭의 주기다', () => {
    // 수요일에 일간은 다 했고 주간만 남았다.
    const [today] = planScheduleAlerts(state({ weekly: true }), kst('2026-10-07T10:00:00'))

    expect(today!.title).toBe('주간 스케줄이 남은 것 같아요')
    expect(today!.data).toEqual({ kind: SCHEDULE_ALERT_KIND, cycle: 'weekly', dateKey: '2026-10-07' })
  })
})
