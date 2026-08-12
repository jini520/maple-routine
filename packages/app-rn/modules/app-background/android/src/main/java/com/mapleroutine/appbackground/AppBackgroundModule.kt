package com.mapleroutine.appbackground

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 탭 최상위의 뒤로가기를 **종료가 아니라 백그라운드 전환**으로 받는다([[ADR-120]] 결정 18).
 *
 * `moveTaskToBack(true)` 는 태스크를 살려 둔 채 뒤로 보낸다 — 홈 버튼과 같다. 다시 열면 보던 화면
 * 그대로다. `finish()`/`finishAffinity()` 는 태스크를 끝내 다음 실행이 콜드 스타트가 되고, 그것이
 * 정확히 RN 의 기본 폴백이다(`ReactActivity.invokeDefaultOnBackPressed` 주석).
 *
 * `nonRoot = true` 인 것은 이 액티비티가 태스크의 루트가 **아닐 때도** 뒤로 보내라는 뜻이다.
 * `false` 면 루트가 아닐 때 아무 일도 일어나지 않고 조용히 실패한다 — 뒤로가기가 먹통이 되는데
 * 원인을 짚기 어려운 종류다.
 *
 * `Queues.MAIN` 은 선택이 아니다. Expo 의 `AsyncFunction` 은 기본적으로 백그라운드 큐에서 돌고,
 * `Activity` 조작은 UI 스레드 밖에서 하면 안 된다.
 */
class AppBackgroundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppBackground")

    AsyncFunction("moveToBackground") {
      val activity = appContext.activityProvider?.currentActivity
        ?: throw Exceptions.MissingActivity()
      activity.moveTaskToBack(true)
    }.runOnQueue(Queues.MAIN)
  }
}
