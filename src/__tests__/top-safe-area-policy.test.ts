// 상단 안전영역 정책 가드 —.
//
// **화면 상단은 `insets.top` 을 직접 읽지 않는다.** 안드로이드 하한이 값 하나에서 나오는 것이 이
// 정정의 전부인데, 그 **하나** 는 코드로는 강제되지 않는다. 새 화면을 만드는 사람은 옆 화면을
// 복붙하고, 하필 `useSafeAreaInsets().top` 을 쓰는 옛 줄을 복붙하면 **그 화면만 안드로이드에서
// 16.7px 위**에 서고, 그 어긋남은 안드로이드 실기기에서 탭을 오갈 때만 보인다.
//
// `page-header-title-row-policy.test.ts` 와 같은 방식이다. 결정을 문서가 아니라 실패하는
// 테스트로 지킨다. 여기서는 이유가 하나 더 있다: **컴포넌트 테스트로는 이 정책을 못 본다.**
// jest-expo 는 iOS 로 돌고 iOS 는 하한을 안 타므로, 직접 읽든 함수를 통하든 렌더 트리가 똑같다.
//
// ## 경계는 **화면 상단인가** 다
//
// `insets.top` 을 계속 봐야 하는 자리가 남는다. 오버레이(`Modal`·캐릭터 피커·계정 드롭다운)의
// 그 값은 **리듬** 이 아니라 **상태바를 안 가린다** 를 뜻해서, 하한을 깔면 실제로 필요한 것보다
// 더 내려가 카드만 좁아진다. 그래서 이 가드는 파일 전체가 아니라 **화면 파일**(`*Screen.tsx`)과
// 상단을 소유하는 셸 둘만 본다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/**
 * 온보딩은 **결정 2 그대로 제외**다. 단계에 제목 줄이 없어 그 `marginTop` 은 헤더 여백이 아니라
 * 콘텐츠 여백이라 축이 다르다(정정 1 에서도 그대로 유지).
 *
 * 그 인셋을 실제로 읽는 자리는 로 **단계 셸**(`app/onboarding/OnboardingStep.tsx`)
 * 로 옮겨갔다. 화면 파일이 아니라 이 가드가 훑지 않는다. 예외 자체는 화면에 남겨 둔다(단계가 다시
 * 화면으로 접히면 그 자리가 곧 이 이름이다).
 */
const EXEMPT = new Set(['OnboardingScreen.tsx'])

/** 상단 안전영역을 **소유**하는 셸 둘 — 화면 파일은 아니지만 같은 값을 봐야 한다. */
const SHELLS = [
  join(SRC, 'components', 'templates', 'PageHeader', 'PageHeader.tsx'),
  join(SRC, 'components', 'templates', 'ScreenScroll', 'ScreenScroll.tsx'),
]

function screenFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__snapshots__') out.push(...screenFiles(path))
    } else if (entry.endsWith('Screen.tsx') && !EXEMPT.has(entry)) {
      out.push(path)
    }
  }
  return out
}

/** 주석은 대상이 아니다. 이 정책의 기록이 여러 파일 머리에 산다(제목 줄 가드와 같은 사정). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/**
 * 상단 인셋을 직접 읽는 세 형태. **한 형태만 막으면 나머지 둘로 새어 나간다**. 그리고 그 셋은
 * 전부 옆 화면을 복붙 으로 들어온다.
 */
const DIRECT_TOP_INSET = [
  /\binsets\.top\b/,
  /useSafeAreaInsets\(\)\.top\b/,
  /\{[^}]*\btop\b[^}]*\}\s*=\s*useSafeAreaInsets\(\)/,
]

const files = [...screenFiles(join(SRC, 'app')), ...SHELLS].map((path) => ({
  name: path.slice(SRC.length + 1),
  source: stripComments(readFileSync(path, 'utf8')),
}))

describe(' — 상단 안전영역은 한 자리에서 나온다', () => {
  it('검사 대상을 실제로 찾는다', () => {
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(15)
    expect(files.filter((file) => file.source.includes('useTopSafeAreaPx')).length).toBeGreaterThan(5)
  })

  it('화면 상단은 `insets.top` 을 직접 읽지 않는다', () => {
    const offenders = files
      .filter((file) => DIRECT_TOP_INSET.some((pattern) => pattern.test(file.source)))
      .map((file) => file.name)

    expect(offenders).toEqual([])
  })
})
