// 실 광고 단위 ID가 저장소에 다시 들어오는 것을 막는다.
//
// 광고 단위 ID는 비밀이 아니다. APK를 열면 누구나 꺼낼 수 있다. 그런데도 저장소에서 빼는 이유는
// 값이 바뀔 때 코드를 고치지 않으려는 것과, 개발 빌드에 실 ID가 섞여 들어갈 경로를 하나 줄이려는
// 것이다. 실 ID로 자기 광고를 클릭하면 AdMob 계정이 정지될 수 있고 복구가 매우 어렵다.
//
// 지금은 빌드할 때 `EXPO_PUBLIC_ADS_INTERSTITIAL_ANDROID`·`..._IOS` 로 넣는다. 값이 없으면
// 광고가 안 나간다(`resolveInterstitialAdId`).
//
// **앱 ID(`~` 가 들어간 값)는 여기서 안 본다.** 그쪽은 `app.json` 에 있어야 한다. `app.json` 은
// OTA 지문에 **해석된 설정** 으로 들어가는데, 값을 환경 변수로 빼면 빌드 환경에 따라 지문이
// 달라져서 스토어 바이너리가 받던 OTA 가 끊긴다. `app.json` 은 파일 소스가 아니라 `expoConfig`
// contents 소스다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/** Google이 공개한 테스트 광고 발행자. 계정과 무관한 고정값이라 코드에 있어도 된다. */
const GOOGLE_TEST_PUBLISHER = 'ca-app-pub-3940256099942544'

/** 테스트 픽스처가 쓰는 가짜 값. 실제 AdMob 발행자 번호가 아니다. */
const FIXTURE = /^ca-app-pub-(FIXTURE|TEST-FIXTURE)/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__snapshots__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

describe('실 광고 단위 ID는 소스에 없다', () => {
  const files = sourceFiles(SRC)

  it('훑을 파일을 실제로 찾았다', () => {
    // 경로가 틀려 0개를 훑고도 통과하는 것이 이런 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(300)
  })

  it('Google 테스트 ID와 픽스처 말고는 ca-app-pub 값이 없다', () => {
    const offenders: string[] = []

    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/ca-app-pub-[\w-]+/g)) {
        const id = match[0]
        if (id === GOOGLE_TEST_PUBLISHER || FIXTURE.test(id)) continue
        offenders.push(`${file.slice(SRC.length + 1)}: ${id}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('어댑터가 환경 변수를 리터럴로 읽는다', () => {
    // `babel-preset-expo` 는 `process.env.EXPO_PUBLIC_이름` 형태만 번들에 값으로 바꿔 넣는다.
    // 키를 변수로 만들거나 구조 분해로 꺼내면 치환이 안 되고 값이 비어서 나간다. 그러면 광고가
    // 조용히 사라지고 화면에는 아무 표시가 없다.
    const adapter = readFileSync(join(SRC, 'native/adapters/rn-ads.ts'), 'utf8')

    expect(adapter).toContain('process.env.EXPO_PUBLIC_ADS_INTERSTITIAL_ANDROID')
    expect(adapter).toContain('process.env.EXPO_PUBLIC_ADS_INTERSTITIAL_IOS')
  })
})
