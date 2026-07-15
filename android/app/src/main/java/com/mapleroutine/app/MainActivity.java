package com.mapleroutine.app;

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
        // 시스템 바를 앱이 직접 그리게 만드는 로컬 플러그인(edge-to-edge + 안전영역 인셋 주입).
        // registerPlugin은 super.onCreate() 이전에 호출해야 브릿지 초기화 시점에 인식된다.
        registerPlugin(SystemBarsPlugin.class);

        // installSplashScreen()은 super.onCreate() 이전에 호출해야 스플래시가 첫 프레임 이전에 제대로 hook된다.
        // setKeepOnScreenCondition으로 SPLASH_KEEP_MS 동안 유지하면, 브릿지/WebView 로딩 구간에 흰 화면 없이
        // 네이티브 스플래시만 보인다(Capacitor 플러그인의 launchShowDuration은 iOS 전용으로 두고, Android는
        // 플러그인이 늦게 개입해 이중 스플래시가 생기지 않도록 여기서 직접 유지 시간을 관리한다).
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        final long start = SystemClock.uptimeMillis();
        splashScreen.setKeepOnScreenCondition(() -> SystemClock.uptimeMillis() - start < SPLASH_KEEP_MS);
        super.onCreate(savedInstanceState);
    }
}
