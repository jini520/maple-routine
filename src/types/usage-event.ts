/** 사용 로그 사건 하나. 서버 `usage_events` 의 줄 하나가 된다. */
export interface UsageEvent {
  type: 'visit' | 'screen' | 'action'
  /** 화면은 라우트 이름, 동작은 동작 이름이다. 방문은 빈 글자다. */
  name: string
  /** 화면에 머문 시간. 화면 사건만 있다. */
  durationMs: number | null
  /** 사건이 시작된 기기 시각(ISO) */
  at: string
}

/** 한 번에 보내는 묶음. 플랫폼과 앱 버전은 묶음마다 한 번 싣는다. */
export interface UsageEventBatch {
  platform: 'ios' | 'android'
  appVersion: string
  events: UsageEvent[]
}
