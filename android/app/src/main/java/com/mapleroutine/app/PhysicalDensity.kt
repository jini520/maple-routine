package com.mapleroutine.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.res.Resources
import android.util.DisplayMetrics
import com.facebook.react.uimanager.DisplayMetricsHolder
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 1dp 의 실제 길이를 아이폰 17 Pro 의 1pt 에 맞추는 화면 배율.
 *
 * 안드로이드는 실제 밀도와 상관없이 등급(480 이면 3배)으로 dp 를 픽셀로 바꿔, 같은 dp 가 기기마다 실제 크기가 다르다.
 * 앱과 액티비티의 context 를 `densityDpi` 를 덮어쓴 설정으로 만든다. 그 위에 생기는 모든 뷰와 라이브러리가 고친
 * 배율을 읽고, 시스템 설정이 바뀌어도 덮어쓴 값이 남는다.
 */
object PhysicalDensity {
  /** 아이폰 17 Pro 의 1인치당 pt. 460ppi 를 3배로 그린다 */
  private const val REFERENCE_POINTS_PER_INCH = 460f / 3f

  /** 앱이 쓰는 화면 폭의 하한(dp). 이보다 좁으면 배치가 깨진다 */
  private const val MIN_WIDTH_DP = 320f

  /** 실제 밀도를 믿는 범위. 기기가 틀린 `xdpi` 를 알려 주면 계산한 값이 공장값에서 크게 벗어난다 */
  private const val TRUSTED_RANGE_LOW = 0.75f
  private const val TRUSTED_RANGE_HIGH = 1.25f

  /**
   * 고친 배율의 context. `attachBaseContext` 에서 받은 context 를 감싼다.
   *
   * @param base 시스템이 준 context. 시스템 배율과 실제 밀도를 여기서 읽는다
   */
  fun wrap(base: Context): Context {
    val config = Configuration(base.resources.configuration)
    config.densityDpi = densityDpi(config.densityDpi, base.resources.displayMetrics)
    return base.createConfigurationContext(config)
  }

  /**
   * RN 이 든 화면 지표를 이 context 의 배율에 맞춘다.
   *
   * RN 은 레이아웃 배율을 `Display.getRealMetrics` 에서 읽는데, 그 값은 context 설정과 상관없이 시스템 배율이다.
   * 그래서 RN 이 처음 읽기 전(`loadReactNative` 앞)과 시스템 설정이 바뀐 뒤마다 고쳐 쓴다.
   * `react-native-keyboard-controller` 는 `Resources.getSystem()` 의 배율로 키보드 높이를 재므로 그것도 맞춘다.
   */
  fun syncReactNative(context: Context) {
    val metrics = context.resources.displayMetrics
    DisplayMetricsHolder.initDisplayMetrics(context)
    DisplayMetricsHolder.setWindowDisplayMetrics(DisplayMetrics().apply { setTo(metrics) })
    overwrite(DisplayMetricsHolder.getScreenDisplayMetrics(), metrics.densityDpi)
    overwrite(Resources.getSystem().displayMetrics, metrics.densityDpi)
  }

  /**
   * 앱을 처음부터 다시 띄운다. 앱 context 와 RN 은 시작할 때 받은 배율을 바꾸지 못해서, 배율이 바뀌면 새 프로세스로 맞춘다.
   */
  fun restartProcess(activity: Activity) {
    val intent = activity.packageManager.getLaunchIntentForPackage(activity.packageName) ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    activity.startActivity(intent)
    Runtime.getRuntime().exit(0)
  }

  /**
   * 실제 밀도로 다시 계산한 `densityDpi`.
   *
   * @param systemDpi 시스템이 정한 지금 배율. 화면 크기 설정을 키우면 커진다
   * @param metrics 시스템 배율의 `DisplayMetrics`. `xdpi` · `ydpi` 와 픽셀 크기를 읽는다
   */
  private fun densityDpi(systemDpi: Int, metrics: DisplayMetrics): Int {
    val stable = DisplayMetrics.DENSITY_DEVICE_STABLE
    // 사용자가 키운 화면 크기. 아이폰 디스플레이 확대처럼 그대로 따른다
    val zoom = systemDpi.toFloat() / stable
    val physicalDpi = (metrics.xdpi + metrics.ydpi) / 2
    val unzoomed = physicalDpi / REFERENCE_POINTS_PER_INCH * DisplayMetrics.DENSITY_DEFAULT
    val axesAgree = abs(metrics.xdpi - metrics.ydpi) <= max(metrics.xdpi, metrics.ydpi) * 0.1f
    val trusted = axesAgree && unzoomed / stable in TRUSTED_RANGE_LOW..TRUSTED_RANGE_HIGH
    val wanted = if (trusted) unzoomed * zoom else systemDpi.toFloat()
    val widthCap = min(metrics.widthPixels, metrics.heightPixels) * DisplayMetrics.DENSITY_DEFAULT / MIN_WIDTH_DP
    return min(wanted, widthCap).roundToInt()
  }

  private fun overwrite(metrics: DisplayMetrics, dpi: Int) {
    val fontScale = if (metrics.density > 0) metrics.scaledDensity / metrics.density else 1f
    metrics.densityDpi = dpi
    metrics.density = dpi.toFloat() / DisplayMetrics.DENSITY_DEFAULT
    metrics.scaledDensity = metrics.density * fontScale
  }
}
