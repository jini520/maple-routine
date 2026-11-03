// 1겹(OS 시작 창)의 색은 네 곳에 따로 적혀 있고 앱이 읽는 것은 커밋된 네이티브 파일이다. 한 곳만 고치면
// 1겹이 걷히는 순간 색이 끊긴다. 2026-11-02 까지 iOS 네이티브 파일만 옛 주황으로 남아 있었다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SPLASH_COLORS } from '../colors'

const ROOT = join(__dirname, '..', '..', '..', '..')

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

function hexOf(components: { red: string; green: string; blue: string }): string {
  const channel = (value: string): string =>
    Math.round(Number(value) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(components.red)}${channel(components.green)}${channel(components.blue)}`.toUpperCase()
}

describe('1겹 색', () => {
  const light = SPLASH_COLORS.light.sky.toUpperCase()
  const dark = SPLASH_COLORS.dark.sky.toUpperCase()

  it('app.json 의 expo-splash-screen 블록이 2겹 하늘 색이다', () => {
    const app = JSON.parse(read('app.json')) as { expo: { plugins: unknown[] } }
    const splash = app.expo.plugins.find(
      (plugin): plugin is [string, { backgroundColor: string; dark: { backgroundColor: string } }] =>
        Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    )
    expect(splash?.[1].backgroundColor.toUpperCase()).toBe(light)
    expect(splash?.[1].dark.backgroundColor.toUpperCase()).toBe(dark)
  })

  it('안드로이드 colors.xml 둘이 2겹 하늘 색이다', () => {
    const color = (xml: string): string | undefined =>
      /name="splashscreen_background">(#[0-9A-Fa-f]{6})</.exec(xml)?.[1].toUpperCase()
    expect(color(read('android/app/src/main/res/values/colors.xml'))).toBe(light)
    expect(color(read('android/app/src/main/res/values-night/colors.xml'))).toBe(dark)
  })

  it('iOS colorset 과 storyboard 대체값이 2겹 하늘 색이다', () => {
    const colorset = JSON.parse(read('ios/app/Images.xcassets/SplashScreenBackground.colorset/Contents.json')) as {
      colors: { appearances?: { value: string }[]; color: { components: { red: string; green: string; blue: string } } }[]
    }
    const byAppearance = (value: string | undefined): string | undefined => {
      const entry = colorset.colors.find((color) => color.appearances?.[0]?.value === value)
      return entry ? hexOf(entry.color.components) : undefined
    }
    expect(byAppearance(undefined)).toBe(light)
    expect(byAppearance('dark')).toBe(dark)

    const storyboard = read('ios/app/SplashScreen.storyboard')
    const fallback = /<namedColor name="SplashScreenBackground">\s*<color[^>]*blue="([^"]+)" green="([^"]+)" red="([^"]+)"/.exec(
      storyboard,
    )
    expect(fallback).not.toBeNull()
    expect(hexOf({ red: fallback![3], green: fallback![2], blue: fallback![1] })).toBe(light)
  })
})
