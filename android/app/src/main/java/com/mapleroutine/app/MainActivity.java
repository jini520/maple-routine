package com.mapleroutine.app;

import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // 네이티브 스플래시(안드로이드 12+)를 최소 이 시간만큼 화면에 유지한다. 순식간에 지나가지 않게 하되,
    // 콘텐츠가 늦게 준비돼도 여기서 강제로 내려 스플래시가 무한정 걸리지 않게 하는 상한이기도 하다.
    private static final long SPLASH_KEEP_MS = 1000L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 하단 시스템 내비게이션 바 글리프 명암을 테마와 맞추는 로컬 플러그인. registerPlugin은
        // super.onCreate() 이전에 호출해야 브릿지 초기화 시점에 인식된다.
        registerPlugin(NavigationBarPlugin.class);

        // installSplashScreen()은 super.onCreate() 이전에 호출해야 스플래시가 첫 프레임 이전에 제대로 hook된다.
        // setKeepOnScreenCondition으로 SPLASH_KEEP_MS 동안 유지하면, 브릿지/WebView 로딩 구간에 흰 화면 없이
        // 네이티브 스플래시만 보인다(Capacitor 플러그인의 launchShowDuration은 iOS 전용으로 두고, Android는
        // 플러그인이 늦게 개입해 이중 스플래시가 생기지 않도록 여기서 직접 유지 시간을 관리한다).
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        final long start = SystemClock.uptimeMillis();
        splashScreen.setKeepOnScreenCondition(() -> SystemClock.uptimeMillis() - start < SPLASH_KEEP_MS);
        super.onCreate(savedInstanceState);

        // edge-to-edge(targetSdk 36)에서 시스템이 3버튼 내비게이션 바에 덧씌우는 반투명 대비 스크림을 끈다.
        // 이게 켜져 있으면 WebView가 깔아준 하단 탭바 배경색 위에 회색막이 얹혀 앱 내부 색과 어긋나 보인다.
        // 제스처 내비게이션에는 스크림이 없어 무해하고, 3버튼 내비 사용자를 위해 안전망으로 둔다.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
