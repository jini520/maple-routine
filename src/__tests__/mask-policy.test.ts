// 알파 마스크 패치 가드 — [[ADR-134]] 정정 4.
//
// **이 결함은 jest 가 원리적으로 못 본다.** 깨지는 자리가 렌더 트리가 아니라 **안드로이드가 pop
// 전환 중에 그리는 방식**이기 때문이다: `RNCMaskedView` 는 마스크를 `getChildAt(0)` 으로 찾는데,
// React 가 화면을 pop 하며 서브트리를 언마운트하면 자식들이 `mChildren` 에서 빠져
// `getChildAt(0)` 이 **null** 이 된다. 그런데 화면은 아직 밀려 나가는 중이라 Android 는 그것들을
// **disappearing child** 로 계속 그린다 — `INVISIBLE` 플래그도 무시하고. 마스크를 못 알아보니
// 화면을 채운 불투명 `#000` 판이 평범한 그림으로 깔려, 뒤로가기 전환 내내 화면이 검다
// (실기기 2026-08-15). 스냅샷은 초록인 채로 화면이 검다 — [[ADR-135]] 결정 4 가 «두 축을 이름
// 불렀는가» 로 계약을 옮긴 것과 같은 부류의 실패다.
//
// 그래서 계약을 «화면이 어떻게 보이는가» 가 아니라 **«패치가 걸려 있는가»** 로 적는다. 회귀는
// 깨지는 모양이 아니라 **조용히 빠지는** 모양으로 온다 — `patches/` 를 지우거나 루트 `postinstall`
// 을 건드리면 설치는 그대로 성공하고 화면만 다시 검어진다.
//
// **`@expo/ui` 의 `MaskedView` 로 갈아타는 길도 막는다.** 그쪽은 검정을 없애지만 안드로이드에서
// 자식을 Compose interop(`RNHostView`)로 감싸 **마스크 안의 탭이 통째로 죽는다**(실기기 실측 —
// 마스크 안 탭 0.00% 대 마스크를 끈 대조군 34.91%).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')
const REPO_ROOT = join(__dirname, '..', '..')

/** 패치 파일. 버전이 오르면 이름이 바뀌므로 **디렉터리에서 찾는다**(그래야 업그레이드가 시끄럽다). */
const PATCH_DIR = join(REPO_ROOT, 'patches')
const PATCH_TARGET = '@react-native-masked-view+masked-view'

/** 검정을 없애지만 마스크 안 터치를 죽이는 대체재 — 되돌아오면 안 된다. */
const FORBIDDEN_MODULE = '@expo/ui/community/masked-view'

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

/** 주석은 대상이 아니다 — 이 정책의 기록이 거기 산다(`backdrop-policy.test.ts` 와 같은 판단). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

function patchBody(): string {
  const file = readdirSync(PATCH_DIR).find((f) => f.startsWith(PATCH_TARGET))
  return readFileSync(join(PATCH_DIR, file as string), 'utf8')
}

describe('[[ADR-134]] 정정 4 — 마스크는 인덱스가 아니라 참조로 잡힌다', () => {
  it('패치 파일이 하나 있다', () => {
    expect(existsSync(PATCH_DIR)).toBe(true)

    expect(readdirSync(PATCH_DIR).filter((f) => f.startsWith(PATCH_TARGET))).toHaveLength(1)
  })

  it('패치가 마스크를 **참조로** 들고, `drawChild` 에서 막는다', () => {
    const body = patchBody()

    // 파일 존재만 보면 빈 패치도 통과한다 — 고리 둘을 이름으로 확인한다.
    expect(body).toContain('+  private View mMaskView = null;')
    expect(body).toContain('+  private View resolveMaskView() {')
    expect(body).toContain('+  protected boolean drawChild(Canvas canvas, View child, long drawingTime) {')
    // `getChildAt(0)` 만 보고 판단하던 자리들이 전부 참조 경유로 바뀌었는가
    expect(body).toContain('+    if (child != null) {')
    expect(body).toContain('+    if (child == resolveMaskView()) {')
    expect(body).toContain('View maskView = resolveMaskView();')
  })

  it('루트 `postinstall` 이 패치를 적용한다', () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    expect(manifest.scripts?.postinstall).toContain('patch-package')
    expect(Object.keys(manifest.devDependencies ?? {})).toContain('patch-package')
  })

  it(`대체재(${FORBIDDEN_MODULE})를 쓰지 않는다 — 마스크 안 터치가 죽는다`, () => {
    const files = sourceFiles(SRC)
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(50)

    const offenders = files.filter((file) =>
      stripComments(readFileSync(file, 'utf8')).includes(FORBIDDEN_MODULE),
    )

    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })
})
