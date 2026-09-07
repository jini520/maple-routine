package com.mapleroutine.app

import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider

/**
 * `enablePreparedTextLayout` 만 켜고 나머지 플래그는 릴리스 등급 기본값에 그대로 위임한다.
 *
 * 이 플래그를 켜면 글자를 **한 번만** 계산한다. 끄면 잴 때 만든 Layout 을 버리고 `TextView` 가
 * 그릴 때 줄바꿈을 다시 계산하는데, 둘이 1px 어긋나면 마지막 음절이 다음 줄로 넘어가 한 줄 높이
 * 상자에 가려 사라진다. 켜면 잰 Layout 그 자체가 그려지므로 어긋날 자리가 없다.
 *
 * 켜면 글자 뷰가 `TextView` 가 아니라 `ViewGroup` 이 되어 **네이티브 글자 선택이 안 된다**.
 * 이 앱은 `<Text selectable>` 을 안 쓴다.
 */
class PreparedTextFlags(
  private val base: ReactNativeFeatureFlagsProvider = ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(),
) : ReactNativeFeatureFlagsProvider by base {
  override fun enablePreparedTextLayout(): Boolean = true
}
