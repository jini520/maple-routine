// 리로드를 건너 전달해야 하는 일회성 알림([[ADR-065]] 결정 3).
//
// 캐시 데이터 삭제는 실패해도 리로드가 실행되므로(clearCacheData → 스플래시 → closeBossProfitDb →
// reload) 토스트를 그 자리에서 띄울 수 없다 — 리로드가 파괴한다. 그래서 플래그를 남기고 부팅 후
// 읽어서 띄운다.
//
// **왜 Preferences가 아니라 sessionStorage인가**: 이 알림의 수명은 "리로드는 넘기되 앱 종료와
// 함께 사라진다"다. Preferences는 영속이라 앱을 다시 켜도 남아 한참 뒤에 엉뚱한 시점에 뜬다.
// 앱의 다른 저장은 전부 Preferences지만 여기만은 의미가 다르다.
//
// features/·app/ 이 저장소를 직접 만지지 않는 규칙(CLAUDE.md)에 따라 이 어댑터를 거친다.

const KEY = 'pendingNotice'

export type PendingNotice = 'cacheClearFailed'

const VALID: readonly string[] = ['cacheClearFailed']

export function setPendingNotice(notice: PendingNotice): void {
  try {
    sessionStorage.setItem(KEY, notice)
  } catch {
    // 알림 하나를 못 넘기는 것뿐이라 조용히 넘어간다 — 여기서 던지면 삭제 흐름 자체가 멈춘다.
  }
}

// 읽으면서 지운다 — 한 번만 띄우고 리로드가 또 일어나도 반복하지 않는다.
export function consumePendingNotice(): PendingNotice | null {
  try {
    const value = sessionStorage.getItem(KEY)
    if (value === null) {
      return null
    }
    sessionStorage.removeItem(KEY)
    return VALID.includes(value) ? (value as PendingNotice) : null
  } catch {
    return null
  }
}
