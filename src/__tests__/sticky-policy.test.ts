// sticky 정책 가드.
//
// **화면에 고정되는 영역을 두지 않는다.** 판정이 두 번에 걸쳐 좁혀졌지만(**최상단 헤더만 남긴다**
// → **그 헤더도 푼다**) 이 가드가 지키는 것은 **최종 상태 하나**다. 이 패키지에는 sticky 를 쓰는
// 코드가 **하나도 없어야 한다.** `PageHeader` 조차 이제 스크롤 뷰의 **첫 자식**이라 목록과 함께
// 흘러 올라간다(`ScreenScroll`).
//
// ## 왜 **없음** 을 테스트하나
//
// 이 정책은 의 중첩 sticky 를 **안 만들기로 한** 결정이라, 지켜야 할 코드가 없다.
// 그래서 회귀는 **기능이 깨지는** 모양이 아니라 **없기로 한 것이 슬그머니 생기는** 모양으로 온다 —
// 누군가 카드 헤더를 고정하고 싶어 `stickyHeaderIndices` 를 한 줄 넣으면 그것으로 정책이 뒤집히고,
// 리뷰에서 **왜 안 되는지** 를 아는 사람이 없으면 그대로 남는다.
//
// 이 저장소가 디버그 도구 배포 가드에서 쓴 방식과 같다: **결정을 문서가
// 아니라 실패하는 테스트로 지킨다.**
//
// ## 무엇을 잡나
//
// - `stickyHeaderIndices`. RN `ScrollView`/`FlatList` 의 sticky 수단
// - `position: 'sticky'`. RN 에는 없는 값이지만 웹 코드를 그대로 옮기면 들어온다(그리고 조용히
//   무시된다. 이 전환에서 반복해 겪은 **값은 맞는데 안 먹는** 부류다)
// - `stickyTop`. 이 쓰던 오프셋 프롭 이름. 되살아나면 그 구조가 함께 온다는 신호다
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..')

/** 검사 대상 — 소스만. 이 파일과 ADR 을 인용하는 주석은 대상이 아니다(아래 `stripComments`). */
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
 * `BossProfitScreen.contract.md` 와 여러 파일 머리가 *"중첩 sticky 는 안 옮긴다"* 를 설명하며
 * 그 단어를 쓴다. 설명을 금지어로 잡으면 가드가 **기록을 지우라고 요구하는** 꼴이 되고, 그러면
 * 다음 사람이 왜 없는지를 알 길이 없어진다. 잡을 것은 **코드**다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const FORBIDDEN: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bstickyHeaderIndices\b/, what: 'ScrollView/FlatList 의 sticky' },
  { pattern: /position\s*:\s*['"]sticky['"]/, what: "position: 'sticky' (RN 에 없는 값이다)"},
 { pattern: /\bstickyTop\b/, what: ' 의 sticky 오프셋 프롭' },
]

describe(' 고정되는 영역이 없다 — sticky 가 코드에 하나도 없다', () => {
 const files = sourceFiles(SRC)

 it('검사 대상 파일을 실제로 찾는다', () => {
 // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
 expect(files.length).toBeGreaterThan(50)
 })

 it.each(FORBIDDEN)('$what 을 쓰지 않는다', ({ pattern }) => {
 const offenders = files.filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))

 expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
 })
})