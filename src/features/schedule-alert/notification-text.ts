/**
 * 미완료 스케줄 알림의 제목 · 본문. 마지막으로 아는 상태를 단정하지 않는다. 울리는 시각에는 지났을 수 있어서다.
 */
export type AlertCycle = 'daily' | 'weekly' | 'monthly'

export const CYCLE_LABEL = { daily: '일간', weekly: '주간', monthly: '월간' } as const satisfies Record<AlertCycle, string>

/**
 * @param cycles 제목에 적을 주기. 남았거나 모르는 것만, 일간 · 주간 · 월간 순
 * @param unknown 초기화 뒤에 확인한 적이 없는 주기가 하나라도 있는가
 * @example scheduleAlertText(['daily', 'weekly'], false) // { title: '일간 · 주간 스케줄이 남은 것 같아요', body: '마지막으로 확인했을 때 기준이에요. …' }
 */
export function scheduleAlertText(cycles: readonly AlertCycle[], unknown: boolean): { title: string; body: string } {
  return {
    title: `${cycles.map((cycle) => CYCLE_LABEL[cycle]).join(' · ')} 스케줄이 남은 것 같아요`,
    body: unknown
      ? '초기화 뒤에 확인하지 못했어요. 앱을 열면 갱신돼요. 자정에 초기화돼요'
      : '마지막으로 확인했을 때 기준이에요. 끝냈다면 앱을 열어 갱신해 주세요. 자정에 초기화돼요',
  }
}
