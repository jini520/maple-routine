package com.mapleroutine.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.app.Activity;
import android.view.Window;

import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * Capacitor/WebView를 전혀 거치지 않는 초경량 스플래시 액티비티(ADR-029).
 *
 * MIUI/HyperOS force-dark는 네이티브 테마의 solid color 속성(windowSplashScreenBackground)만
 * 건드리고 비트맵 드로어블은 안 건드린다(아이콘 PNG가 안 깎이는 것과 동일 원리, [[project_miui_forcedark_splash]]).
 * 이 액티비티는 브릿지·플러그인·WebView 초기화 없이 곧바로 activity_splash.xml(ImageView,
 * scaleType=centerCrop — windowBackground로 직접 그리면 화면 비율에 안 맞을 때 늘어나 보임)로
 * @drawable/splash(전체 브랜드 이미지)를 그리므로, MainActivity(Capacitor)를 거치는 기존 방식보다
 * 훨씬 빨리 "진짜" 브랜드 색을 보여준다(실기기 검증 완료). 고정 시간(SHOW_MS) 뒤 MainActivity로 넘긴다.
 */
public class SplashActivity extends Activity {

    private static final long SHOW_MS = 1200L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);
        applyEdgeToEdge();

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            startActivity(new Intent(this, MainActivity.class));
            overridePendingTransition(0, 0);
            finish();
        }, SHOW_MS);
    }

    /**
     * 상태바·내비게이션 바를 투명 edge-to-edge로 만들어, activity_splash.xml의 전체화면
     * ImageView(주황 배경)가 바 영역까지 그대로 비치게 한다 — 안 하면 시스템 기본 검정 배경이
     * 위아래에 남아 스플래시 이미지와 색이 안 맞아 보인다(2026-07-16 실기기 확인, MainActivity의
     * SystemBarsPlugin과 동일 원리를 브릿지 없는 이 액티비티용으로 재현).
     */
    private void applyEdgeToEdge() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        // 주황 배경 위라 밝은(흰색) 아이콘이 의미상 맞다. 다만 MIUI/HyperOS는 배경 밝기를 자체
        // 판단해 이 설정을 무시하고 어두운 아이콘으로 덮어쓴다(실기기 확인, true/false 결과 동일 —
        // MainActivity의 force-dark와 같은 종류의 OS 레벨 오버라이드). 다른 OEM/기본 AOSP를 위해
        // 의미상 올바른 값은 그대로 둔다.
        window.getDecorView().post(() -> {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        });
    }
}
