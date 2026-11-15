import React
import UIKit

/**
 * 앱의 창을 여는 씬 대리자. iOS 27 SDK 로 구운 앱은 씬이 없으면 UIKit 이 실행을 막는다.
 * Expo SDK 57 에는 씬 쪽 짝이 없어 이 저장소가 직접 든다.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // 광고 전면 · 동의 창과 Firebase Messaging 이 창을 `delegate.window` 로 찾는다. 비면 광고만 조용히 안 뜬다.
    appDelegate.window = window

    // 앱을 켠 URL 은 `launchOptions` 가 아니라 여기로 온다. `Linking.getInitialURL()` 은 `.url` 자리를 읽는다.
    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)

    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  /**
   * 접고 펴서 화면이 바뀔 때 방향을 다시 정하는 자리. 화면이 바뀌어도 UIKit 은 앞서 받은 방향 허용을 그대로 쓴다.
   * 짧은 변이 600pt 미만인 화면(접은 커버)으로 바뀌었는데 가로로 누워 있으면 세로로 되돌린다.
   */
  func windowScene(
    _ windowScene: UIWindowScene,
    didUpdate previousCoordinateSpace: UICoordinateSpace,
    interfaceOrientation previousInterfaceOrientation: UIInterfaceOrientation,
    traitCollection previousTraitCollection: UITraitCollection
  ) {
    let screen = windowScene.screen.bounds.size
    window?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
    if min(screen.width, screen.height) < 600 && !windowScene.interfaceOrientation.isPortrait {
      windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait))
    }
  }

  // Linking API
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal Links
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
