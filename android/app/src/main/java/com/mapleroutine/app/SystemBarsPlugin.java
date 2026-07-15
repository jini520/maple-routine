package com.mapleroutine.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

/**
 * 시스템 바(상단 상태바 / 하단 내비게이션·제스처 바)를 앱이 직접 그리게 만드는 플러그인.
 *
 * 배경 — Capacitor 8의 내장 SystemBars는 WebView 버전으로 동작이 갈린다(SystemBars.java):
 *   - WebView >= 140: 인셋을 통과시켜 WebView가 edge-to-edge로 그린다.
 *   - WebView <  140: WebView 컨테이너에 padding을 넣어 바 안쪽으로 밀어낸다. 그러면 바 영역은
 *     앱이 못 그리고 네이티브 배경이 노출된다(실측: Android 15 + WebView 131에서 흰색 #fafafa).
 * 게다가 Android 15+에선 setStatusBarColor/setNavigationBarColor가 무시돼(no-op) 네이티브로 색을
 * 칠할 수도 없다. 즉 구형 WebView + Android 15 조합에선 어떤 방법으로도 바 색을 맞출 수 없었다.
 *
 * 해법 — capacitor.config.ts에서 SystemBars.insetsHandling='disable'로 Capacitor의 인셋 개입을 끄고,
 * 여기서 항상 edge-to-edge로 고정한 뒤 인셋을 --safe-area-inset-* CSS 변수로 직접 주입한다.
 * 앱 CSS가 env()가 아니라 이 변수를 쓰므로 구형 WebView의 env() 버그(그 140/144 게이트의 원인)를
 * 아예 우회한다 → WebView·안드로이드 버전과 무관하게 앱이 양쪽 바를 자기 색으로 그린다.
 * (Capacitor도 같은 방향을 "insetsHandling: full"로 Cap 9에 넣을 예정 — 그때 이 플러그인은 걷어낸다.)
 */
@CapacitorPlugin(name = "AppSystemBars")
public class SystemBarsPlugin extends Plugin {

    @Override
    public void load() {
        getActivity().runOnUiThread(() -> {
            enableEdgeToEdge();
            registerInsetsListener();
        });
    }

    /** WebView가 시스템 바 뒤까지 그리도록 창을 edge-to-edge로 만든다. */
    private void enableEdgeToEdge() {
        Window window = getActivity().getWindow();

        // 모든 API에서 동작하는 방식(androidx). Android 15+는 어차피 강제 edge-to-edge라 무해하고,
        // 14 이하에선 이게 있어야 WebView가 바 뒤로 확장된다.
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // 14 이하: 바를 투명하게 해야 뒤의 WebView가 비친다. 15+에선 이 두 호출이 무시되지만(이미 투명) 무해.
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        // 투명 바 위에 시스템이 덧씌우는 반투명 대비 스크림 제거 — 안 끄면 앱 색 위에 회색막이 얹힌다.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
    }

    /**
     * 인셋 변화(회전·폴더블 접힘·키보드)를 받아 CSS 변수로 흘린다.
     * Capacitor 내장 SystemBars의 통과(passthrough) 분기와 같은 동작을 WebView 버전 조건 없이 수행한다.
     */
    private void registerInsetsListener() {
        View container = (View) getBridge().getWebView().getParent();

        ViewCompat.setOnApplyWindowInsetsListener(container, (v, insets) -> {
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            Insets imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime());

            // 시스템 바 자리는 앱이 직접 그리므로 패딩을 주지 않는다. 단 키보드가 뜨면 그만큼 밀어 올려
            // 입력 필드가 가리지 않게 한다(Capacitor 내장 구현과 동일).
            v.setPadding(0, 0, 0, keyboardVisible ? imeInsets.bottom : 0);

            injectSafeAreaCSS(calcSafeAreaInsets(insets));

            return insets;
        });
    }

    /** 키보드가 떠 있으면 하단 안전영역은 0 — 그 자리는 이미 키보드가 차지한다(내장 구현과 동일). */
    private Insets calcSafeAreaInsets(WindowInsetsCompat insets) {
        Insets safeArea = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
        if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
            return Insets.of(safeArea.left, safeArea.top, safeArea.right, 0);
        }
        return safeArea;
    }

    private void injectSafeAreaCSS(Insets insets) {
        float density = getActivity().getResources().getDisplayMetrics().density;
        int top = (int) (insets.top / density);
        int right = (int) (insets.right / density);
        int bottom = (int) (insets.bottom / density);
        int left = (int) (insets.left / density);

        getBridge()
            .executeOnMainThread(() -> {
                if (getBridge().getWebView() == null) return;
                String script = String.format(
                    Locale.US,
                    "try {" +
                    "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');" +
                    "} catch(e) { console.error('safe-area inject failed', e) }",
                    top,
                    right,
                    bottom,
                    left
                );
                getBridge().getWebView().evaluateJavascript(script, null);
            });
    }

    /**
     * 인셋을 다시 계산·주입한다. 최초 인셋 적용이 DOM 준비보다 먼저 일어나면 주입이 유실되므로,
     * 앱이 마운트된 뒤 JS가 한 번 호출해 확실히 값을 받아간다.
     */
    @PluginMethod
    public void refreshInsets(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getBridge().getWebView().requestApplyInsets();
            call.resolve();
        });
    }

    /**
     * 하단 내비게이션 바 글리프(제스처 핸들·3버튼)의 명암을 앱 표면 밝기에 맞춘다.
     * 배경색은 앱이 직접 그리므로 여기서 칠하지 않는다.
     * (상단 상태바 아이콘은 @capacitor/status-bar가 담당한다 — native/status-bar.ts)
     */
    @PluginMethod
    public void setStyle(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            // 어두운 표면 → 밝은 글리프(appearanceLight=false), 밝은 표면 → 어두운 글리프.
            controller.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
