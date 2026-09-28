internal import Expo
import FirebaseCore
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  /** 씬 대리자가 창을 열 때 리액트 네이티브에 넘기는 값. */
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

#if os(iOS) || os(tvOS)
    // FCM. 이 호출 전에는 Firebase API 가 전부 던진다. prebuild 가 넣어 주지만 이 저장소는
    // 산출물을 통째로 받지 않아(PrivacyInfo·Pods 참조를 지운다) 손으로 유지한다.
    FirebaseApp.configure()
    // 창은 `SceneDelegate` 가 연다.
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /**
   * 짧은 변이 600pt 미만인 화면(바형 아이폰 · 접는 아이폰의 커버)을 세로로 묶는 자리.
   * 앱에 가로 레이아웃이 없어서다. 안드로이드가 큰 화면에서 잠금을 푸는 600dp 와 같은 수다.
   * 창이 아니라 화면에서 잰다. 아이패드 분할 화면에서 창이 좁아져도 기기는 돌아야 한다.
   */
  public override func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    let screen = window?.windowScene?.screen.bounds.size ?? UIScreen.main.bounds.size
    if min(screen.width, screen.height) < 600 {
      return .portrait
    }
    return super.application(application, supportedInterfaceOrientationsFor: window)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
