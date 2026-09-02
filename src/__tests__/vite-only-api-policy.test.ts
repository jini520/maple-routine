// **제품 코드에 Vite 전용 API 가 남아 있지 않은지** 지킨다.
//
// ══ 이 파일의 목적은 두 번 뒤집혔다 ═══════════════════════════════════════════════
//
// 원래 사슬은 이랬다:
//   · core 는 에셋 목록을 빌드 타임 글롭(`import.meta.glob`)으로 만든다. Metro 에 짝이 없어
//     **모듈 평가 시점에** `__ExpoImportMetaRegistry.glob is not a function` 으로 죽었다.
//   · 그래도 타입 검사는 통과해야 해서 `ImportMeta.glob` 앰비언트 선언을 두었다.
//   · 그 선언 때문에 **치환되지 않은 글롭 모듈을 import 하면 tsc·lint 는 초록이고 런타임에만 죽었다.**
//   · 그래서 이 파일이 글롭 모듈 **여덟 개 목록을 손으로 고정**해, 하나가 늘면 알게 했다.
//
// ① 가 목록을 커밋된 생성물로 옮기면서 그 사슬의 **첫 고리가 사라졌다**. 글롭 사용처가
//    0이 되고, 치환 다섯이 필요 없어졌으며, `ImportMeta.glob` 선언도 함께 지웠다. 그래서 `전수
//    목록`이 **0이어야 한다로 뒤집혔다**: 감시 대상이 없어진 것이 아니라 *"없는 상태가
//    유지되는가"* 가 감시 대상이 됐다.
//
// ② 가 `core/` 를 `src/` 로 녹이면서 **치환 기구 자체가 사라졌다**(`core-shims.js` ·
//    Metro `resolveRequest` 훅 · jest `moduleNameMapper`). 갈아끼울 **별도 패키지** 가 없으니 표도
//    배선도 뜻이 없다. 그래서 그 부분을 검사하던 케이스들과 함께 지우고, **살아남을 이유가 있는
//    이 하나만** 남겼다. 대상이 `core/` 에서 `src/` 로 넓어졌다.
//
// 방어는 여전히 두 겹이다: 선언이 없으니 **tsc 가 먼저 막고**, 그것을 우회해도 여기가 빨개진다.
//
// 남은 벽 하나는 `import.meta.env` 다(`features/live-update/store.ts`). 그것은 아직 치환도 대체도
// 없고 **아무도 값으로 import 하지 않아서** 조용한 것이라, 그 사실은 `boot-order.test.tsx` 가 든다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '..')

/** `src/` 아래 `.ts`/`.tsx` 를 전부 훑는다(테스트는 제품 코드가 아니라 제외. vitest 는 Vite 위에서
 *  돌아 그쪽에서는 글롭이 **사실**이고, 실제로 `data/__tests__` 가 하나 쓴다). */
function productSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === '__mocks__' || entry === '__snapshots__'
        ? []
        : productSourceFiles(full)
    }
    return /\.tsx?$/.test(entry) ? [path.relative(SRC, full)] : []
  })
}

/**
 * 주석을 지운다. **이 정책의 기록 자체가 주석에 산다.**
 *
 * `UpdatePromptModal.tsx` 머리가 어째서 core 스토어를 값으로 import 하면 안 되는지를 설명하며 이
 * API 이름을 쓴다(그리고 실제로 그것 때문에 이 가드가 한 번 빨개졌다. 대상이 `core/` 에서 `src/`
 * 로 넓어진 첫 실행에서). 설명을 금지어로 잡으면 가드가 **기록을 지우라고 요구하는** 꼴이 된다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('제품 코드에 Vite 전용 글롭이 없다', () => {
  // 문자열을 쪼개 두는 이유: 이 파일 자신이 검사 대상(`src/`) 안에 있어서다.
  const GLOB_API = ['import.meta', 'glob'].join('.')

  it('훑는 대상이 실제로 있다', () => {
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(productSourceFiles(SRC).length).toBeGreaterThan(100)
  })

  it('글롭을 쓰는 제품 소스가 0개다', () => {
    const found = productSourceFiles(SRC)
      .filter((relative) => stripComments(readFileSync(path.join(SRC, relative), 'utf8')).includes(GLOB_API))
      .sort()

    expect(found).toEqual([])
  })
})
