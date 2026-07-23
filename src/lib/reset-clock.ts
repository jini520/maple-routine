const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const THURSDAY = 4 // Date#getUTCDay(): 0=Sun ... 6=Sat

/**
 * Nexon 서버의 주간 리셋 시각(KST 목요일 00:00, ARCHITECTURE.md 확인 완료 사항) 기준으로,
 * 주어진 시점에서 가장 최근에 지난(또는 지금 막 지난) 리셋 시각을 반환한다.
 *
 * 기기 로컬 타임존과 무관하게 항상 KST 기준으로 계산해야 하므로, Date의 로컬 getter(getDay 등)는
 * 쓰지 않는다. 대신 절대 시각(epoch ms)에 UTC 오프셋(+9시간)을 명시적으로 더한 뒤 UTC getter로
 * KST 벽시계 값을 읽는 방식으로 로컬 타임존 의존성을 제거한다.
 */
export function getMostRecentWeeklyResetKst(now: Date): Date {
  const kstWallClock = new Date(now.getTime() + KST_OFFSET_MS)
  const daysSinceThursday = (kstWallClock.getUTCDay() - THURSDAY + 7) % 7

  const kstResetAsUtcFields = Date.UTC(
    kstWallClock.getUTCFullYear(),
    kstWallClock.getUTCMonth(),
    kstWallClock.getUTCDate() - daysSinceThursday,
    0,
    0,
    0,
    0,
  )

  return new Date(kstResetAsUtcFields - KST_OFFSET_MS)
}

/**
 * 주어진 시점의 KST 기준 "오늘 날짜"를 YYYY-MM-DD로 반환한다 (ADR-030 — 일간 리셋 버킷 계산용).
 * getMostRecentWeeklyResetKst와 동일하게 기기 로컬 타임존과 무관하게 항상 KST 기준으로 계산한다.
 */
export function getCurrentKstDateKey(now: Date): string {
  const kstWallClock = new Date(now.getTime() + KST_OFFSET_MS)
  const year = kstWallClock.getUTCFullYear()
  const month = String(kstWallClock.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kstWallClock.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const UNSTABLE_WINDOW_MINUTES = 10
const DEFAULT_MAX_DAYS_BACK = 13

function formatKstDateKey(kstWallClock: Date): string {
  const year = kstWallClock.getUTCFullYear()
  const month = String(kstWallClock.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kstWallClock.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * [[ADR-034]] 스케줄러 최초 동기화·캐시 유실 대비 항목 선채움용 — Nexon 스케줄러 API에
 * 하루씩 거슬러 올라가며 넘길 과거 조회 날짜(YYYY-MM-DD) 목록을 최신순으로 반환한다.
 * 평소엔 KST 기준 어제(-1일)부터, KST 00:00~00:10 사이는 자정 직후 API 응답이 불안정하다고
 * 확인돼(사용자 확인, 2026-07-23) 그제(-2일)부터 시작한다. 호출 측은 이 목록을 순서대로
 * 조회하다 더 이상 필요 없어지면(그 날짜 응답이 정상이면) 중간에 멈춘다.
 */
export function getBackfillDateKeys(now: Date, maxDaysBack: number = DEFAULT_MAX_DAYS_BACK): string[] {
  const kstWallClock = new Date(now.getTime() + KST_OFFSET_MS)
  const isUnstableWindow = kstWallClock.getUTCHours() === 0 && kstWallClock.getUTCMinutes() < UNSTABLE_WINDOW_MINUTES
  const startDaysBack = isUnstableWindow ? 2 : 1

  const keys: string[] = []
  for (let daysBack = startDaysBack; daysBack < startDaysBack + maxDaysBack; daysBack += 1) {
    const dayWallClock = new Date(kstWallClock.getTime() - daysBack * 24 * 60 * 60 * 1000)
    keys.push(formatKstDateKey(dayWallClock))
  }
  return keys
}
