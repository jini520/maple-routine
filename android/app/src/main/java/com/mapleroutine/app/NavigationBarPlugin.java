package com.mapleroutine.app;

import android.app.Activity;
import android.graphics.Color;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 하단 시스템 내비게이션 바를 앱 테마에 맞춘다.
// - Android 14 이하: setNavigationBarColor로 배경을 앱 표면색(bg-surface)으로 칠해 내부 탭바와 맞춘다.
// - Android 15+(edge-to-edge 강제): 배경색 지정은 무시되지만, WebView가 투명 내비 바 뒤로 탭바 배경을
//   직접 그리므로 결과가 같다. 어느 버전이든 글리프 명암(제스처 핸들/버튼)은 표면 밝기에 맞춘다.
@CapacitorPlugin(name = "NavigationBar")
public class NavigationBarPlugin extends Plugin {

    @PluginMethod
    public void setStyle(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final String color = call.getString("color");
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (color != null && !color.isEmpty()) {
                try {
                    window.setNavigationBarColor(Color.parseColor(color));
                } catch (IllegalArgumentException ignored) {
                    // 파싱 불가한 색 문자열은 무시하고 명암만 적용한다.
                }
            }
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            // 밝은 표면(라이트 테마) → 어두운 글리프(appearanceLight=true).
            // 어두운 표면(다크 테마) → 밝은 글리프(appearanceLight=false).
            controller.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
