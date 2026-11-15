// 창 크기 정책 가드.
//
// 오른쪽 레일 화면(아이폰 듀오 외부 화면)에서는 창 폭 466 중 콘텐츠가 382 만 쓴다. 창 폭으로 치수를 계산하는
// 화면은 콘텐츠를 466 으로 펼쳐 오른쪽이 레일로 넘친다. 그 어긋남은 그 기기에서만 보이므로 테스트로 막는다.
// 창 크기는 `useScreenLayout()` 으로 받는다. 창 전체를 덮는 그림만 창 크기를 직접 읽는다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')

/** 창 크기를 직접 읽어도 되는 파일. 판정 자신과 창 전체를 덮는 셋이다. */
const ALLOWED = new Set([
  'lib/screen-layout.ts',
  'components/templates/ThemeBackdrop/ThemeBackdrop.tsx',
  'app/BootSplash.tsx',
  'components/organisms/DropEffectOverlay/DropEffectOverlay.tsx',
])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__fixtures__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

describe('창 크기는 useScreenLayout 으로 받는다', () => {
  it('useWindowDimensions 를 읽는 파일은 허용 목록뿐이다', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => /\buseWindowDimensions\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path))
      .filter((path) => !ALLOWED.has(path))

    expect(offenders).toEqual([])
  })
})
