// **제품 코드에 Vite 전용 API 가 남아 있지 않은지** 지킨다.
//
// 에셋 목록은 빌드 타임 글롭(`import.meta.glob`)으로 만들던 것이 커밋된 생성물로 옮겨졌고,
// Metro 에는 그 API 의 짝이 없다. 되살아나면 **모듈 평가 시점에**
// `__ExpoImportMetaRegistry.glob is not a function` 으로 죽는다. 그래서 이 가드가 묻는 것은
// **쓴 자리가 하나도 없는가** 다.
//
// 방어는 두 겹이다. `ImportMeta.glob` 앰비언트 선언이 없으니 **tsc 가 먼저 막고**, 그것을
// 우회해도 여기가 빨개진다.
//
// 남은 벽 하나는 `import.meta.env` 다(`features/live-update/store.ts`). 그것은 아직 치환도 대체도
// 없고 **아무도 값으로 import 하지 않아서** 조용한 것이라, 그 사실은 `boot-order.test.tsx` 가 든다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '..')

/** `src/` 아래 `.ts`/`.tsx` 를 전부 훑는다. 테스트는 제품 코드가 아니라 제외한다. */
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
 * 주석을 걷어낸 소스. **이 정책의 기록 자체가 주석에 산다.**
 *
 * `UpdatePromptModal.tsx` 머리가 어째서 스토어를 값으로 import 하면 안 되는지를 설명하며 이
 * API 이름을 쓴다. 설명을 금지어로 잡으면 가드가 **기록을 지우라고 요구하는** 꼴이 된다.
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
