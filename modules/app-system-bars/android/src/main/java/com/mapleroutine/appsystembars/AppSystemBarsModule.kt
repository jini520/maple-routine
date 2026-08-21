package com.mapleroutine.appsystembars

import androidx.core.view.WindowCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 하단 시스템 내비게이션 바(제스처 핸들·3버튼) **글리프의 명암**을 앱 표면 밝기에 맞춘다.
 *
 * 웹뷰 쪽 짝은 `SystemBarsPlugin.setStyle` 이고 그 한 줄을 그대로 옮긴 것이다:
 * `setAppearanceLightNavigationBars(!dark)` — 어두운 표면이면 밝은 글리프, 밝은 표면이면 어두운
 * 글리프. 뒤집으면 어두운 배경에 어두운 글자가 되어 바가 통째로 안 보이는데, 실기기에서만 드러난다.
 *
 * ## 배경색은 다루지 않는다 — 그쪽은 웹뷰 시절에도 앱이 그렸다
 *
 * `SystemBarsPlugin` 이 하던 나머지 셋(edge-to-edge 강제 · 인셋 리스너 · `--safe-area-inset-*` 주입)은
 * 여기 없다. **전부 웹뷰에 값을 흘려보내기 위한 배관**이었고 RN 에는 그 수신자가 없다 —
 * edge-to-edge 는 RN 0.86/Expo 57 의 안드로이드 기본이고, 인셋은
 * `react-native-safe-area-context` 가 자기 네이티브 리스너로 컴포넌트에 내려준다.
 *
 * 그래서 이 모듈에는 함수가 **하나뿐**이다(`rn-system-bars.ts` 가 그 갈림을 적어 두었다).
 *
 * `Queues.MAIN` 은 선택이 아니다 — Expo 의 `AsyncFunction` 은 기본적으로 백그라운드 큐에서 돌고,
 * `Window` 조작은 UI 스레드 밖에서 하면 안 된다(`AppBackgroundModule` 과 같은 이유).
 */
class AppSystemBarsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppSystemBars")

    AsyncFunction("setNavigationBarStyle") { dark: Boolean ->
      val activity = appContext.activityProvider?.currentActivity
        ?: throw Exceptions.MissingActivity()
      val window = activity.window
      WindowCompat.getInsetsController(window, window.decorView)
        .isAppearanceLightNavigationBars = !dark
    }.runOnQueue(Queues.MAIN)
  }
}
