// app.config.js 가 AdMob 앱 ID를 환경 변수에서 읽는다.
//
// 앱 ID는 `expo prebuild` 가 AndroidManifest.xml 과 Info.plist 에 넣는 값이다. 런타임에 읽는
// 값이 아니라서 JS 쪽에서는 못 바꾸고 여기서만 갈아끼울 수 있다.
//
// ## 이 테스트가 지키는 것
//
// `runtimeVersion` 정책이 `fingerprint` 이고 app.json 은 파일이 아니라 해석된 설정으로 지문에
// 들어간다. 그래서 **여기서 나온 값이 곧 지문**이다. 환경 변수를 제대로 채우면 지문이 예전과
// 같고, 안 채우면 달라진다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')
const ADS_PLUGIN = 'react-native-google-mobile-ads'

type PluginEntry = string | [string, Record<string, unknown>]

function resolveConfig(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  // config 는 매번 새로 평가한다. 모듈 최상위에서 process.env 를 읽지 않는지도 함께 확인된다.
  jest.resetModules()
  const appConfig = require(join(REPO_ROOT, 'app.config.js')) as (arg: {
    config: { plugins: PluginEntry[] }
  }) => { plugins: PluginEntry[] }

  const base = JSON.parse(readFileSync(join(REPO_ROOT, 'app.json'), 'utf8')) as {
    expo: { plugins: PluginEntry[] }
  }
  return appConfig({ config: base.expo })
}

function adsPluginArgs(config: { plugins: PluginEntry[] }): Record<string, unknown> {
  const entry = config.plugins.find((p): p is [string, Record<string, unknown>] =>
    Array.isArray(p) && p[0] === ADS_PLUGIN,
  )
  expect(entry).toBeDefined()
  return entry![1]
}

const REAL = {
  EXPO_PUBLIC_ADS_APP_ID_ANDROID: 'ca-app-pub-FIXTURE~android',
  EXPO_PUBLIC_ADS_APP_ID_IOS: 'ca-app-pub-FIXTURE~ios',
}
const EMPTY = {
  EXPO_PUBLIC_ADS_APP_ID_ANDROID: undefined,
  EXPO_PUBLIC_ADS_APP_ID_IOS: undefined,
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_ADS_APP_ID_ANDROID
  delete process.env.EXPO_PUBLIC_ADS_APP_ID_IOS
})

describe('app.config.js 의 AdMob 앱 ID', () => {
  it('환경 변수 값을 그대로 넣는다', () => {
    const args = adsPluginArgs(resolveConfig(REAL))

    expect(args.androidAppId).toBe(REAL.EXPO_PUBLIC_ADS_APP_ID_ANDROID)
    expect(args.iosAppId).toBe(REAL.EXPO_PUBLIC_ADS_APP_ID_IOS)
  })

  it('값이 없으면 Google 테스트 앱 ID로 떨어진다', () => {
    // .env 없이도 expo start 와 개발 빌드가 돌아야 한다. 이 값은 AdMob 계정과 무관하다.
    const args = adsPluginArgs(resolveConfig(EMPTY))

    expect(args.androidAppId).toMatch(/^ca-app-pub-3940256099942544~/)
    expect(args.iosAppId).toMatch(/^ca-app-pub-3940256099942544~/)
  })

  it('빈 문자열도 없는 것으로 본다', () => {
    const args = adsPluginArgs(
      resolveConfig({ EXPO_PUBLIC_ADS_APP_ID_ANDROID: '', EXPO_PUBLIC_ADS_APP_ID_IOS: '' }),
    )

    expect(args.androidAppId).toMatch(/^ca-app-pub-3940256099942544~/)
  })

  it('다른 플러그인은 건드리지 않는다', () => {
    const base = JSON.parse(readFileSync(join(REPO_ROOT, 'app.json'), 'utf8')) as {
      expo: { plugins: PluginEntry[] }
    }
    const resolved = resolveConfig(REAL)

    expect(resolved.plugins).toHaveLength(base.expo.plugins.length)
    const others = (list: PluginEntry[]) => list.filter((p) => !Array.isArray(p) || p[0] !== ADS_PLUGIN)
    expect(others(resolved.plugins)).toEqual(others(base.expo.plugins))
  })

  it('app.json 에는 실 앱 ID가 없다', () => {
    // 여기 값이 남아 있으면 환경 변수가 무시되는 것이 아니라, 저장소에 ID가 그대로 남는다.
    expect(readFileSync(join(REPO_ROOT, 'app.json'), 'utf8')).not.toContain('ca-app-pub')
  })
})
