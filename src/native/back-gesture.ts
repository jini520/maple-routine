import {
  getBackGesturePort,
  type BackGestureHandlers,
  type BackProgressEvent,
} from './ports'

// 안드로이드 시스템 뒤로가기(제스처 내비 스와이프 / 3버튼 Back)를 앱 안의 화면 스택에 잇는 어댑터
// 네이티브 접근은 이 레이어에서만 한다.
//
// **진행률은 시스템이 준다**(API 34+). 제스처 사용자의 손가락 위치를 우리가 재지 않으므로 가장자리
// 띠를 두고 시스템과 다툴 일이 없다. 3버튼 사용자는 진행률 없이 `invoked` 만 온다. 두 입력이 같은
// 결과로 수렴하는 것이 목표다.

export type { BackGestureHandlers, BackProgressEvent }

/** 스택이 열려 있는 동안에만 시스템 뒤로가기를 가로챈다. */
export async function setBackGestureEnabled(enabled: boolean): Promise<void> {
  await getBackGesturePort().setEnabled(enabled)
}

/**
 * 앱을 종료하지 않고 백그라운드로 보내는 이동. 홈 버튼과 같다. 태스크가 살아
 * 있어 다시 열면 보던 화면 그대로다. 완전히 끝내면 다음 실행이 콜드 스타트라 스플래시부터 다시 본다.
 */
export async function moveAppToBackground(): Promise<void> {
  await getBackGesturePort().moveToBackground()
}

/** 리스너를 붙이는 구독. 해제 함수를 돌려준다. 시스템 뒤로가기가 없는 플랫폼에서는 아무것도 하지 않는다. */
export async function addBackGestureListeners(
  handlers: BackGestureHandlers,
): Promise<() => void> {
  return getBackGesturePort().addListeners(handlers)
}
