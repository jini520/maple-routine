// 가운데 모달에서 물러나기만 하는 길(`나중에` · `취소`)은 패널 오른쪽 위 닫기 X 하나다. 화면이 다시 글자 버튼으로 그리면
// 같은 물러나기가 모달마다 다른 자리에 서고, 하는 일이 있는 글자 버튼(`기록 삭제` · `알림 없이 저장`)과 한 줄에 섞인다.
// 큰 버튼이 `취소` 인 되돌릴 수 없는 확인은 이 규칙 밖이다. `NoticeModal` 의 `action` 으로 넘기므로 아래 검사에 걸리지 않는다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (/\.tsx$/.test(name) && !/\.(test|spec)\.tsx$/.test(name)) out.push(path)
  }
  return out
}

/** 물러나기 글자 버튼을 그리는 모양. `NoticeModal` 의 부 버튼 · 그 값으로 쓰는 상수 · 직접 그린 `Button` 글자 */
const DISMISS_TEXT_BUTTON = [
  /secondaryAction=\{\{\s*label:\s*'(나중에|취소)'/,
  /label:\s*'나중에'/,
  />\s*(나중에|취소)\s*<\/Button>/,
]

describe('가운데 모달의 물러나기', () => {
  it('나중에 · 취소 를 글자 버튼으로 그리지 않는다', () => {
    const files = [...sources(join(SRC, 'app')), ...sources(join(SRC, 'components'))]
    expect(files.length).toBeGreaterThan(100)

    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      if (DISMISS_TEXT_BUTTON.some((pattern) => pattern.test(text))) offenders.push(relative(SRC, file))
    }
    expect(offenders).toEqual([])
  })
})
