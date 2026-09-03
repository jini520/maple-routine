// 전면광고 정책 가드.
//
// **`app-rn` 에는 전면광고가 없다.** 이 RN 으로 간 동인 자체가 광고 인벤토리였고
//
// 그 제약이 사라졌으므로 먼저 걷었다. 인라인 광고는 후속이다.
//
// ## 왜 **없음** 을 테스트하나
//
//  sticky 가드 글롭 가드와 같은 이유다. 지켜야 할 코드가 없는 결정이라
// 회귀가 **기능이 깨지는** 모양이 아니라 **없기로 한 것이 슬그머니 돌아오는** 모양으로 온다.
// `maybeShowTabSwitchAd` 를 부르는 곳이 하나도 없어야 한다.
// 자동완성에 뜬다. 새 화면을 옮기며 한 줄 부르면 그것으로 정책이 뒤집힌다. 실제로 전면광고
// 시절에도 노출 지점이 바(`BottomBar`) 하나에서 위젯(`WidgetGrid`)까지 **저절로 둘로 늘었다.**
//
// ## 무엇을 잡고, 무엇을 안 잡나
//
// - 잡는다: `src/features/ads/tab-switch-ad`. `startAds`(SDK 초기화 + **사전 로드**) 와
//   `maybeShowTabSwitchAd`(표시) 가 사는 모듈. 사전 로드까지 잡는 이유는, 표시만 막으면 매 실행
//   **뜨지 않을 광고** 를 요청해 임프레션 없는 요청(매치율 0)으로 쌓이기 때문이다.
// - **안 잡는다**: `src/native/ads`. 어댑터(`rn-ads.ts`)가 `resolveInterstitialAdId`·
//  `shouldUseTestAds` 를 계속 부른다. 그 둘은 인라인 광고도 쓸 함수다.
// - **안 잡는다**: `AdsPort`·`setAdsPort`·`rn-ads.ts` 자체. 포트 배선은 남기기로 한 자산이다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/** 검사 대상. 소스만. 이 파일과 ADR 을 인용하는 주석은 대상이 아니다(아래 `stripComments`). */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__snapshots__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

/**
 * 주석을 지운다. **이 정책의 기록 자체가 주석에 산다.**
 *
 * `rn-ads.ts` 머리가 어째서 어댑터만 남았는지를 설명하며 그 이름들을 쓴다. 설명을 금지어로 잡으면
 * 가드가 **기록을 지우라고 요구하는** 꼴이 되고, 그러면 다음 사람이 왜 없는지를 알 길이 없어진다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const FORBIDDEN: Array<{ pattern: RegExp; what: string }> = [
  {
    // alias 가 사라져 상대 경로로 온다. 깊이가 자리마다 달라 끝만 잡는다.
    pattern: /['"][^'"]*features\/ads\/tab-switch-ad['"]/,
    what: '탭 전환 전면광고 모듈 import',
  },
  { pattern: /\bmaybeShowTabSwitchAd\b/, what: '전면광고 표시 호출' },
  { pattern: /\bstartAds\b/, what: '전면광고 사전 로드(SDK 초기화 겸용)' },
  { pattern: /\bshouldGateAd\b/, what: '광고 게이트 판정' },
]

describe(' app-rn 에 전면광고가 없다', () => {
  const files = sourceFiles(SRC)

  it('검사 대상 파일을 실제로 찾는다', () => {
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(50)
  })

  it.each(FORBIDDEN)('$what 이 없다', ({ pattern }) => {
    const offenders = files.filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))

    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })

  // **어댑터는 남는다.** 위 목록이 넓어져 이것까지 걷어내면 인라인 광고가 처음부터
  // 배선을 다시 세워야 한다(앱 ID·`app-ads.txt`·테스트 광고 강제가 전부 그 배선에 딸려 있다).
  it('어댑터 배선은 그대로 있다. 걷은 것은 포맷이지 SDK 가 아니다', () => {
    const adapter = readFileSync(join(SRC, 'native/adapters/rn-ads.ts'), 'utf8')
    const boot = readFileSync(join(SRC, 'boot.ts'), 'utf8')

    expect(adapter).toContain('react-native-google-mobile-ads')
    expect(adapter).toContain('resolveInterstitialAdId')
    expect(stripComments(boot)).toContain('setAdsPort(rnAdsPort)')
  })
})
