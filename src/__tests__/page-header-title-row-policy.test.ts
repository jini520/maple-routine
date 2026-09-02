// 제목 줄 정책 가드 —.
//
// **제목을 그리는 화면은 전부 `PageHeaderTitleRow` 로 그 줄을 그린다.** 이 정책이 문서에만 있으면
// 다음 화면에서 조용히 어긋난다. 새 화면을 만드는 사람은 옆 화면을 복붙하고, 그때 복붙되는 것이
// 하필 줄을 손으로 그린 옛 화면일 수 있다. 그러면 그 화면만 제목이 4px 위에 서고, 그 어긋남은
// 탭을 오갈 때만 보인다(그래서 리뷰에서 안 잡힌다. 이 정정을 낳은 관측이 정확히 그것이다).
//
// 이 저장소가 sticky 가드 디버그 도구 가드에서 쓴 방식과 같다:
// **결정을 문서가 아니라 실패하는 테스트로 지킨다.**
//
// ## 경계는 **화면인가** 다
//
// 같은 글자 스타일을 모달(`ThemeModal`·`TrackingModeModal`·`DisconnectConfirm`)과 온보딩 단계
// (`ApiKeyForm`·`TrackingModeStep`·`ContentCharacterStep`)도 쓰는데, **그 제목은 페이지 헤더가
// 아니다**. 모달은 자기 판의 머리이고 온보딩 단계에는 헤더 줄 자체가 없다(범위표의
// `제외`와 같은 경계다). 파일 이름(`*Screen.tsx`)이 그 경계와 정확히 겹쳐서 그것으로 가른다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

/** 화면 파일만 — 모달·단계·행 조각은 대상이 아니다(위 경계). */
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

/** 주석은 대상이 아니다. 이 정책의 기록이 여러 파일 머리에 산다(sticky 가드와 같은 사정). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** 화면 제목의 글자 — `text-lg font-semibold text-text`(`design-system.md` 타이포). */
const TITLE_CLASS = /text-lg font-semibold text-text/

const files = screenFiles(APP).map((path) => ({
  name: path.slice(APP.length + 1),
  source: stripComments(readFileSync(path, 'utf8')),
}))

describe(' — 제목 줄은 프리미티브 하나로 그린다', () => {
  it('검사 대상 화면을 실제로 찾는다', () => {
    // 경로가 틀려 0개를 훑고도 초록이 되는 것이 이 부류 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(15)
    expect(files.filter((file) => TITLE_CLASS.test(file.source)).length).toBeGreaterThan(15)
  })

  it('제목을 그리는 화면은 모두 `PageHeaderTitleRow` 를 쓴다', () => {
    const offenders = files
      .filter((file) => TITLE_CLASS.test(file.source) && !file.source.includes('<PageHeaderTitleRow'))
      .map((file) => file.name)

    expect(offenders).toEqual([])
  })

  // 줄을 손으로 그린 흔적이 프리미티브 **옆에** 남는 경우를 잡는다. 한 화면에 제목이 둘인
  // 자리(빈 상태 가지 + 헤더)에서 하나만 옮기면 나머지가 그대로 어긋난다.
  it('제목 개수와 제목 줄 개수가 화면마다 같다', () => {
    const count = (source: string, pattern: RegExp): number => source.match(pattern)?.length ?? 0
    const mismatched = files
      .filter((file) => TITLE_CLASS.test(file.source))
      .map((file) => ({
        name: file.name,
        titles: count(file.source, /text-lg font-semibold text-text/g),
        rows: count(file.source, /<PageHeaderTitleRow/g),
      }))
      .filter((file) => file.titles !== file.rows)

    expect(mismatched).toEqual([])
  })
})
