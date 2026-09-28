// 짧은 변이 600 미만인 화면은 세로로 고정한다. 앱에 가로 레이아웃이 없어서다.
//
// 잠금은 네이티브 파일 둘에 있다. jest 가 회전을 못 돌리므로 그 파일들이 그 모양을 들고 있는지를 본다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('화면 회전', () => {
  // 600dp 이상 화면에서는 Android 16 이 이 값을 무시하므로 큰 화면은 OS 가 풀어 준다.
  it('안드로이드 MainActivity 는 portrait 다', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml')

    expect(manifest).toMatch(/<activity android:name="\.MainActivity"[^>]*android:screenOrientation="portrait"/)
  })

  // 델리게이트는 plist 가 연 방향 안에서만 좁힐 수 있다. 여기서 가로를 지우면 아이패드 · 접는 아이폰도 잠긴다.
  it('iOS Info.plist 는 방향 넷을 그대로 연다', () => {
    const plist = read('ios/app/Info.plist')
    const phone = plist.match(/<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? ''

    expect(phone).toContain('UIInterfaceOrientationLandscapeLeft')
    expect(phone).toContain('UIInterfaceOrientationLandscapeRight')
  })

  it('iOS AppDelegate 가 짧은 변 600pt 미만에서 세로로 좁힌다', () => {
    const delegate = read('ios/app/AppDelegate.swift')

    expect(delegate).toMatch(/override func application\([^)]*supportedInterfaceOrientationsFor window/)
    expect(delegate).toMatch(/< 600/)
    expect(delegate).toContain('.portrait')
  })
})
