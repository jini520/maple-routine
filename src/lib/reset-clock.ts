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
