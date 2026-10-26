// 생성물이 **낡는 것**을 잡는다.
//
// 목록을 커밋하기로 한 대가가 정확히 이것이다. 그림을 하나 넣고 `npm run assets:gen` 을 안 돌리면
// 목록에 안 들어가고, 그때 화면은 **에러 없이 폴백만** 그린다(테마 배경 생략). 옛 `import.meta.glob` 은 빌드마다 다시 훑어 이 실패가 없었으므로, 이 테스트가
// 그 자리를 대신 지킨다.
//
// 검사 대상은 **키 집합**이다. 추가·삭제·개명이 전부 키로 드러나고, 값(번들 URL)은 번들러가 정하는
// 것이라 여기서 단언할 수 있는 것이 아니다.
//
// 훑는 규칙은 생성기와 **같은 표**(`asset-groups.ts`)를 읽는다. 여기 규칙을 한 번 더 적으면
// 그 사본이 낡았을 때 *"검사는 통과하는데 목록은 틀린"* 상태가 된다.

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { ASSET_GROUPS, type AssetGroup } from '../../asset-groups'
import { THEME_BACKGROUND_ASSETS } from '../themes'

const ASSETS_DIR = __dirname + '/../../'

/** 표의 `file` → 실제로 import 한 생성물. 여기 빠뜨리면 아래 첫 테스트가 잡는다. */
const GENERATED: Record<string, Record<string, unknown>> = {
  themes: THEME_BACKGROUND_ASSETS,
}

/** 디렉터리 하나의 대상 파일 이름(하위 디렉터리는 안 본다. 생성기와 같은 규칙). */
function filesIn(dir: string, extensions: string[]): string[] {
  const full = path.join(ASSETS_DIR, dir)
  return readdirSync(full).filter((name) => {
    if (!statSync(path.join(full, name)).isFile()) return false
    const dot = name.lastIndexOf('.')
    return dot > 0 && extensions.includes(name.slice(dot + 1))
  })
}

/** 지금 디렉터리 상태에서 나와야 하는 키 집합. */
function expectedKeys(group: AssetGroup): Set<string> {
  return new Set(
    group.dirs.flatMap((dir) =>
      filesIn(dir, group.extensions).map((fileName) =>
        (group.key === 'fileName'
          ? fileName
          : fileName.slice(0, fileName.lastIndexOf('.'))
        ).normalize('NFC'),
      ),
    ),
  )
}

describe('생성된 에셋 목록이 디렉터리와 맞는다', () => {
  it('표의 그룹이 전부 생성물로 있다', () => {
    expect(Object.keys(GENERATED).sort()).toEqual(ASSET_GROUPS.map((g) => g.file).sort())
  })

  it.each(ASSET_GROUPS.map((group) => [group.file, group] as const))(
    '%s. 키 집합이 파일 목록과 같다 (다르면 `npm run assets:gen`)',
    (_file, group) => {
      const actual = new Set(Object.keys(GENERATED[group.file]))
      const expected = expectedKeys(group)

      expect([...actual].sort()).toEqual([...expected].sort())
      expect(actual.size, `${group.file} 목록이 비어 있다`).toBeGreaterThan(0)
    },
  )
})
