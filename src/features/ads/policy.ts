/**
 * 전면광고 노출 게이트 ([[ADR-090]] 결정 3).
 *
 * 광고를 **어디에** 두느냐보다 **얼마나 자주** 띄우느냐가 정책 준수의 본체다 — AdMob이 금지하는
 * 것은 "탭 전환에" 띄우는 것이 아니라 "탭 전환마다"(= "after every user action") 띄우는 것이라,
 * 이 파일의 세 게이트가 그 경계를 만든다. 네이티브·저장소를 모르는 순수 함수로 둔 이유도 그것이다.
 */

/** 마지막 노출로부터 이만큼 지나야 다시 띄운다 — "every user action" 금지를 넘기는 장치. */
export const AD_MIN_INTERVAL_MS = 30 * 60 * 1000

/**
 * 앱 시작 후 이만큼 지나야 띄운다.
 *
 * 앱을 열자마자 탭을 누르면 실행 2~3초 뒤에 전면광고가 뜨는데, 그건 사용자에게도 심사자에게도
 * **"app load 시 전면광고"** 로 읽힌다 — *"Do not place interstitial ads on app load"* 에
 * 걸리는 모습이다. 지점이 탭 전환이어도 시점이 시작 직후면 소용이 없다.
 */
export const AD_MIN_UPTIME_MS = 60 * 1000

export interface InterstitialGateInput {
  now: number
  /** 앱(모듈) 시작 시각 */
  appStartedAt: number
  /** 마지막 노출 시각. 기록이 없으면(첫 실행) `null` */
  lastShownAt: number | null
  /** 사전 로드된 광고가 준비돼 있는가 */
  isLoaded: boolean
}

export function canShowInterstitial(input: InterstitialGateInput): boolean {
  // 준비된 광고가 없으면 여기서 끝이다. 지금 요청해서 기다리는 선택지는 없다 — 왕복 동안 화면이
  // 이미 바뀌고 그 위를 광고가 덮으면 "콘텐츠를 보는 중 갑자기 뜨는" 위반 형태가 된다.
  if (!input.isLoaded) {
    return false
  }

  if (input.now - input.appStartedAt < AD_MIN_UPTIME_MS) {
    return false
  }

  if (input.lastShownAt === null) {
    return true
  }

  // 뺄셈 결과가 음수면(사용자가 기기 시계를 되돌린 경우) 간격 미달로 취급한다 — 절댓값을 쓰면
  // 시계를 과거로 옮긴 기기에서 광고가 매 전환마다 폭주한다.
  return input.now - input.lastShownAt >= AD_MIN_INTERVAL_MS
}
