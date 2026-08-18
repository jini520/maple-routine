// 하단 안전영역 정책 가드 — [[ADR-132]] 정정 31.
//
// **화면 하단은 `insets.bottom` 을 직접 읽지 않는다.** `top-safe-area-policy.test.ts` 와 같은 형태의
// 가드이고 이유도 같다 — 안드로이드 하한이 값 하나에서 나오는 것이 이 정정의 전부인데 그 «하나» 는
// 코드로 강제되지 않고, jest-expo 는 iOS 로 돌아 **렌더 트리로는 이 정책을 못 본다**(iOS 인셋 34 가
// 곧 하한이라 직접 읽든 함수를 거치든 결과가 같다).
//
// 하단은 상단보다 어긋났을 때의 값이 크다. 상단은 제목과 페이드 끝선이 갈리는 것으로 끝나지만,
// 하단은 **바가 뜨는 높이 · 콘텐츠가 남기는 몫 · 페이드 · 토스트가 서로 물려** 있어서 한 자리만
// 옛 줄로 남으면 콘텐츠가 캡슐 뒤로 들어가거나 토스트가 캡슐 위에 겹친다.
//
// ## 경계는 «화면 하단인가» 다
//
// `insets.bottom` 을 계속 봐야 하는 자리가 남는다 — 오버레이(`BottomSheet`·캐릭터 피커·계정
// 드롭다운)의 그 값은 «리듬» 이 아니라 **«내비바를 안 가린다»** 를 뜻해서, 하한을 깔면 시트가
// 실제로 필요한 것보다 더 올라와 내용만 좁아진다. 그래서 이 가드는 **화면 파일**(`*Screen.tsx`)과
// 하단을 소유하는 셸만 본다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/**
 * 하단 안전영역을 **소유**하는 둘 — 화면 파일은 아니지만 같은 값을 봐야 한다.
 *
 * `ToastStack` 이 여기 있는 것이 상단 가드와 다른 점이다. 토스트는 **바 위에 쌓이므로** 바가 뜨는
 * 높이에서 출발해야 하고, 여기만 인셋으로 남으면 안드로이드에서 토스트가 캡슐 위에 겹친다
 * (실제로 그렇게 된다 — 바가 34 에 뜨는데 토스트는 15 + 바 높이에 서면 7px 이 캡슐 안이다).
 */
const SHELLS = [
  join(SRC, 'navigation', 'BottomBar.tsx'),
  join(SRC, 'components', 'organisms', 'Toast', 'ToastStack.tsx'),
]

/**
 * `ScreenScroll` 은 **둘 다 보는 유일한 자리**라 위 목록에 없다.
 *
 * 하위 페이지에서 스크롤포트가 비우는 몫은 «내비바가 실제로 차지하는 자리» 라 하한이 아니라
 * **인셋**이어야 한다([[ADR-132]] 정정 31 의 딸린 변경 — `bottom-inset.ts`). 그래서 이 파일에는
 * 금지 대신 **하한 값을 함께 봐야 한다**는 요구만 건다.
 */
const SCREEN_SCROLL = join(SRC, 'components', 'templates', 'ScreenScroll', 'ScreenScroll.tsx')

function screenFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__snapshots__') out.push(...screenFiles(path))
    } else if (entry.endsWith('Screen.tsx')) {
      out.push(path)
    }
  }
  return out
}

/** 주석은 대상이 아니다 — 이 정책의 기록이 여러 파일 머리에 산다(상단 가드와 같은 사정). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/**
 * 하단 인셋을 직접 읽는 세 형태. 상단 가드와 같은 셋이고 이유도 같다 — **한 형태만 막으면 나머지
 * 둘로 새어 나가고**, 그 셋은 전부 «옆 화면을 복붙» 으로 들어온다.
 */
const DIRECT_BOTTOM_INSET = [
  /\binsets\.bottom\b/,
  /useSafeAreaInsets\(\)\.bottom\b/,
  /\{[^}]*\bbottom\b[^}]*\}\s*=\s*useSafeAreaInsets\(\)/,
]

const read = (path: string): { name: string; source: string } => ({
  name: path.slice(SRC.length + 1),
  source: stripComments(readFileSync(path, 'utf8')),
})

const files = [...screenFiles(join(SRC, 'app')), ...SHELLS].map(read)

describe('[[ADR-132]] 정정 31 — 하단 안전영역은 한 자리에서 나온다', () => {
  it('검사 대상을 실제로 찾는다', () => {
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(15)
    // 셸 둘 + 자기 `paddingBottom` 을 직접 주는 화면 셋(처리방침 · 캐릭터 관리 · 온보딩).
    expect(
      files.filter((file) => file.source.includes('bottom-safe-area')).length,
    ).toBeGreaterThanOrEqual(SHELLS.length + 3)
  })

  it('화면 하단은 `insets.bottom` 을 직접 읽지 않는다', () => {
    const offenders = files
      .filter((file) => DIRECT_BOTTOM_INSET.some((pattern) => pattern.test(file.source)))
      .map((file) => file.name)

    expect(offenders).toEqual([])
  })

  // 인셋을 계속 봐야 하는 그 한 자리도 **하한을 함께 본다.** 여기가 인셋만 보면 탭 화면의 콘텐츠
  // 몫과 페이드가 바보다 19px 낮은 자리를 기준으로 서고, 그 어긋남은 안드로이드에서만 보인다.
  it('`ScreenScroll` 은 인셋과 하한을 **둘 다** 본다', () => {
    const { source } = read(SCREEN_SCROLL)

    expect(source).toMatch(/\binsets\.bottom\b/)
    expect(source).toContain('bottom-safe-area')
  })
})
