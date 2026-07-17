import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mapleroutine.app',
  appName: '메이플 루틴',
  webDir: 'dist',
  // WebView 배경을 브랜드 오렌지로 둬, 네이티브 스플래시가 사라진 뒤 WebView 콘텐츠가 페인트되기 전
  // 찰나에 기본 흰색이 깜빡이는 것을 없앤다.
  backgroundColor: '#FB8101',
  plugins: {
    // iOS는 키보드가 뜨면 WebView 프레임이 줄어드는데(resize 기본값 native), 그 뒤로 드러나는 영역에
    // 기본 배경(위 backgroundColor의 브랜드 오렌지)이 비친다. 'dom'은 그 색을 config가 아니라 웹앱의
    // body 배경에서 읽어가므로 테마를 따라간다(index.css가 body에 --color-bg를 깔아둔다).
    // resize는 기본값 native를 그대로 쓴다 — 이게 없으면 WebView가 스크롤로 밀려 상태바를 침범한다.
    Keyboard: {
      autoBackdropColor: 'dom',
    },
    // Capacitor 내장 SystemBars의 인셋 개입을 끈다. 기본값 'css'는 WebView 140 미만에서 WebView를
    // 시스템 바 안쪽으로 밀어내(padding) 바 영역을 앱이 못 그리게 만든다 — Android 15에선 네이티브로
    // 색을 칠할 수도 없어(setNavigationBarColor no-op) 흰 띠가 남는다. 대신 SystemBarsPlugin.java가
    // 항상 edge-to-edge로 고정하고 --safe-area-inset-* 변수를 직접 주입한다(그 파일 주석 참고).
    SystemBars: {
      insetsHandling: 'disable',
    },
    // Capgo 매니지드 백엔드(plugin.capgo.app)를 쓰지 않고 GitHub Releases 자체 호스팅만 사용하므로,
    // 네이티브 자동 체크는 끄고 통계 전송도 비활성화한다(native/live-update.ts가 수동으로 체크한다, ADR-022).
    CapacitorUpdater: {
      autoUpdate: 'off',
      statsUrl: '',
    },
    // 스플래시는 네이티브 스플래시 하나로 통일한다(iOS 런치 스토리보드 + Splash 이미지 / Android 12+ 테마의
    // windowSplashScreenBackground+AnimatedIcon, values-night 다크 대응 ADR-025). 실행 시점부터 계속 떠 있다가
    // 앱 콘텐츠가 준비되면(App.tsx의 useEffect → native/splash-screen.ts hideSplashScreen, 최소 표시 시간 보장)
    // 내린다. launchAutoHide:false로 자동으로 사라지지 않게 하고 hide()로 직접 내린다.
    // - iOS: 플러그인이 launchShowDuration 동안(그 뒤에도 launchAutoHide:false라 hide()까지) 스플래시를 유지한다.
    // - Android: 플러그인의 install 타이밍이 늦어 유지가 안 되므로 MainActivity.onCreate에서 installSplashScreen
    //   + setKeepOnScreenCondition으로 직접 유지한다(플러그인 hide()도 호출되지만 이미 내려가 있어 무해).
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      // 리로드 커버용 show()(OTA 적용·디버그 데이터 초기화)가 Android에서 그리는 ImageView 설정.
      // 기본 스케일 FIT_XY는 정사각 splash를 비율 무시로 늘려 가로로 눌려 보이므로 CENTER_CROP으로
      // 비율을 유지하고(activity_splash.xml과 동일 원리), 플러그인이 fitsSystemWindows를 강제해
      // 이미지가 못 덮는 상태바·제스처 바 영역은 backgroundColor(브랜드 주황, 이미지 가장자리와
      // 동일 색)로 채운다(ADR-027 정정).
      androidScaleType: 'CENTER_CROP',
      backgroundColor: '#FB8101',
    },
  },
};

export default config;
