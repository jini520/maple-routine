// iOS 는 UIScene 으로 창을 연다. iOS 27 SDK 로 구운 앱은 씬이 없으면 켜자마자 죽는다.
//
// jest 가 UIKit 을 못 돌리므로 네이티브 파일이 그 모양을 들고 있는지를 본다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('iOS 씬', () => {
  const plist = read('ios/app/Info.plist')
  const scene = read('ios/app/SceneDelegate.swift')
  const app = read('ios/app/AppDelegate.swift')

  it('Info.plist 가 씬 매니페스트로 SceneDelegate 를 가리킨다', () => {
    expect(plist).toContain('<key>UIApplicationSceneManifest</key>')
    expect(plist).toContain('<key>UIWindowSceneSessionRoleApplication</key>')
    expect(plist).toMatch(/<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/)
  })

  // 광고와 Firebase 가 AppDelegate.window 하나를 찾으므로 창이 둘이면 어느 창에 뜰지 정할 수 없다.
  it('창은 하나다', () => {
    expect(plist).toMatch(/<key>UIApplicationSupportsMultipleScenes<\/key>\s*<false\/>/)
  })

  it('SceneDelegate 파일이 Xcode 타깃에 들어 있다', () => {
    const project = read('ios/app.xcodeproj/project.pbxproj')

    expect(project).toMatch(/SceneDelegate\.swift in Sources/)
  })

  it('씬이 창을 만들어 리액트 네이티브를 올린다', () => {
    expect(scene).toMatch(/UIWindow\(windowScene:/)
    expect(scene).toContain('startReactNative')
    expect(app).not.toContain('UIWindow(frame:')
  })

  // 광고 전면 · 동의 창과 Firebase Messaging 이 `UIApplication.shared.delegate.window` 로 창을 찾는다.
  it('씬이 만든 창을 AppDelegate.window 에도 건다', () => {
    expect(scene).toMatch(/appDelegate\.window = window/)
  })

  it('URL 은 씬 콜백이 RCTLinkingManager 로 넘긴다', () => {
    expect(scene).toMatch(/func scene\(_ scene: UIScene, openURLContexts/)
    expect(scene).toMatch(/func scene\(_ scene: UIScene, continue userActivity/)
    expect(scene).toContain('RCTLinkingManager')
  })
})
