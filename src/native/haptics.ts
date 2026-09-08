import { getHapticsPort } from './ports'

/**
 * 손끝에 내는 짧은 두드림. 지금 부르는 자리는 하단바의 탭 이동 하나다.
 *
 * 기다리지 않고 삼킨다. 진동 장치가 없거나 사용자가 시스템 촉각 피드백을 꺼 두면 플러그인이
 * 거절하는데, 그 거절이 흘러나가면 탭 누름 하나가 처리되지 않은 거부로 남는다. 화면 이동은
 * 그것과 무관하게 계속돼야 한다.
 *
 * 포트가 안 꽂힌 것은 그대로 던진다. 그것은 배선 사고이지 이 기기에 그 기능이 없다가 아니다.
 */
export function tapFeedback(): void {
  void getHapticsPort()
    .tap()
    .catch(() => undefined)
}
