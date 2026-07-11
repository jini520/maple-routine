import type { BossCycle } from '../types'
import { getMostRecentWeeklyResetKst } from './reset-clock'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export interface BossProfitPeriod {
  periodKey: string // 저장/조회 시 unique key로 쓰이는 안정적인 문자열
  label: string // 화면 표시용 ("이번 주" | "이번 달")
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toKstWallClock(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS)
}

/**
 * 보스 수익 기록의 unique key(ocid+boss+difficulty+기간)에 쓰이는 기간을 계산한다.
 *
 * - weekly: 가장 최근 주간 리셋(KST 목요일 00:00, lib/reset-clock)의 KST 날짜를 periodKey로 쓴다.
 * - monthly: 월간 보스(검은마법사)의 실제 Nexon 서버 리셋 시각은 아직 실측 확인되지 않았다
 *   (PRD.md "확인이 필요한 사항" #36). 확정 전까지는 KST 기준 매월 1일 00:00을 리셋 경계로
 *   "가정"한다 — 실측 결과가 다르게 나오면 이 monthly 분기만 수정하면 되도록 격리해뒀다.
 */
export function getCurrentBossProfitPeriod(cycle: BossCycle, now: Date): BossProfitPeriod {
  if (cycle === 'weekly') {
    const resetKst = toKstWallClock(getMostRecentWeeklyResetKst(now))
    const periodKey = `${resetKst.getUTCFullYear()}-${pad(resetKst.getUTCMonth() + 1)}-${pad(resetKst.getUTCDate())}`
    return { periodKey, label: '이번 주' }
  }

  const nowKst = toKstWallClock(now)
  const periodKey = `${nowKst.getUTCFullYear()}-${pad(nowKst.getUTCMonth() + 1)}`
  return { periodKey, label: '이번 달' }
}
