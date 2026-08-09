package com.mapleroutine.app;

import android.os.Build;
import android.window.BackEvent;
import android.window.OnBackAnimationCallback;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 안드로이드 시스템 뒤로가기(제스처 내비 스와이프 / 3버튼 Back)를 앱 안의 화면 스택에 연결한다
 * ([[ADR-120]] 결정 17).
 *
 * <p><b>왜 커스텀 플러그인인가.</b> Capacitor 코어에는 뒤로가기 처리가 아예 없고(확인 2026-08-09:
 * {@code @capacitor/android} 전체에 {@code OnBackPressedCallback}·{@code onBackInvoked} 없음), 그
 * 역할은 {@code @capacitor/app} 플러그인에 있는데 이 앱은 그것을 설치하지 않았다. 그래서 시스템
 * 뒤로가기가 라우터까지 오지 않고 기본 동작(액티비티 종료)이 실행돼 <b>앱이 그냥 꺼졌다</b>.
 *
 * <p>그렇다고 {@code @capacitor/app} 을 넣지 않는 이유는 그것이 뒤로가기를 <b>무조건</b> 가로채기
 * 때문이다. 탭 최상위에서도 우리가 받아 {@code exitApp}/{@code minimizeApp} 을 불러야 하는데, 그러면
 * <b>시스템이 홈으로 돌아가며 그리는 predictive back 애니메이션이 사라진다</b> — 사용자가 "이건
 * 웹뷰 앱이구나"를 알아차리는 자리가 정확히 그런 곳이다.
 *
 * <p><b>그래서 스택이 열려 있을 때만 콜백을 등록한다</b>({@link #setEnabled}). 비어 있으면 등록하지
 * 않아 시스템이 평소대로 자기 애니메이션과 함께 처리한다 — 개입하지 않는 것이 가장 네이티브다.
 *
 * <p><b>진행률까지 받는다</b>(API 34+, {@link OnBackAnimationCallback}). 제스처 내비 사용자의 손가락
 * 위치를 시스템이 계산해 프레임마다 준다 — 웹에서 좌표를 직접 재지 않으므로 가장자리 띠를 두고
 * 시스템과 다투는 일이 없어진다. 3버튼 사용자는 진행률 없이 {@code onBackInvoked} 만 오고, 그때는
 * 평범한 시간 기반 전환이 돈다. <b>두 입력 방식이 같은 결과로 수렴하는 것이 이 설계의 목표다.</b>
 *
 * <p>API 33 이하는 {@link OnBackInvokedDispatcher} 가 없어 androidx 의
 * {@link OnBackPressedCallback} 으로 떨어진다(진행률 없음, 이벤트만).
 */
@CapacitorPlugin(name = "AppBackGesture")
public class BackGesturePlugin extends Plugin {

    /** API 34+ 경로. 진행률까지 준다. */
    private OnBackInvokedCallback animationCallback;

    /** API 33 이하 폴백. 이벤트만 준다. */
    private OnBackPressedCallback pressedCallback;

    private boolean enabled = false;

    /**
     * 화면 스택이 비었는지 아닌지를 웹이 알려 준다. `true` 인 동안만 시스템 뒤로가기를 가로챈다.
     */
    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean next = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (next) {
                register();
            } else {
                unregister();
            }
            call.resolve();
        });
    }

    /**
     * 앱을 **종료하지 않고 백그라운드로** 보낸다([[ADR-120]] 결정 18). 홈 버튼과 같은 동작이라
     * 태스크가 살아 있어 다시 열면 보던 화면 그대로다 — {@code finishAffinity()} 로 끝내면 다음
     * 실행이 콜드 스타트가 되어 스플래시부터 다시 본다.
     */
    @PluginMethod
    public void moveToBackground(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().moveTaskToBack(true);
            call.resolve();
        });
    }

    private void register() {
        if (enabled) return;
        enabled = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            animationCallback = new OnBackAnimationCallback() {
                @Override
                public void onBackStarted(BackEvent event) {
                    notifyListeners("backStarted", progressOf(event));
                }

                @Override
                public void onBackProgressed(BackEvent event) {
                    notifyListeners("backProgressed", progressOf(event));
                }

                @Override
                public void onBackInvoked() {
                    notifyListeners("backInvoked", new JSObject());
                }

                @Override
                public void onBackCancelled() {
                    notifyListeners("backCancelled", new JSObject());
                }
            };
            getActivity()
                .getOnBackInvokedDispatcher()
                .registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, animationCallback);
            return;
        }

        pressedCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                notifyListeners("backInvoked", new JSObject());
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(pressedCallback);
    }

    private void unregister() {
        if (!enabled) return;
        enabled = false;

        if (animationCallback != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                getActivity().getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(animationCallback);
            }
            animationCallback = null;
        }
        if (pressedCallback != null) {
            pressedCallback.remove();
            pressedCallback = null;
        }
    }

    /**
     * 시스템이 준 제스처 진행률(0~1)과 방향. 방향은 왼쪽/오른쪽 가장자리 어디서 시작했는지이고,
     * 웹은 그것으로 화면을 어느 쪽으로 밀지 정한다.
     */
    private JSObject progressOf(BackEvent event) {
        JSObject data = new JSObject();
        data.put("progress", event.getProgress());
        data.put("edge", event.getSwipeEdge() == BackEvent.EDGE_RIGHT ? "right" : "left");
        return data;
    }

    @Override
    protected void handleOnDestroy() {
        unregister();
    }
}
