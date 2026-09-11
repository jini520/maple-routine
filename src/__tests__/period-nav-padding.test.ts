// 기간 이동 줄의 위아래 여백 가드.
//
// `←` · 기간 라벨 · `→` 줄이 세 화면에 있고 **서로 베낀 코드**다. 공용 부품이 없으므로 같은 값을
// 세 곳에 적어야 하고, 한 곳만 바뀌면 같은 줄이 화면마다 다르게 보인다. 그 어긋남은 화면을 오갈
// 때만 보여서 리뷰에서 안 잡힌다.
//
// #351 이 이 줄을 부품 하나로 모으면 이 테스트는 그 부품을 보는 것으로 바뀐다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP = join(__dirname, '..', 'app')

const SCREENS = [
  join(APP, 'boss-profit', 'BossProfitScreen.tsx'),
  join(APP, 'cashbook', 'CashbookScreen.tsx'),
  join(APP, 'boss-profit', 'DropPriceScreen.tsx'),
]

/** 줄을 여는 클래스. 셋이 같은 문자열로 시작한다. */
const NAV_ROW = /className="flex-row items-center justify-center gap-4([^"]*)"/g

/** 그 줄이 든 위아래 여백. 없으면 `null`. */
function verticalPadding(source: string): (string | null)[] {
  return [...source.matchAll(NAV_ROW)].map((match) => /\bpy-[\d.]+\b/.exec(match[1])?.[0] ?? null)
}

describe('기간 이동 줄', () => {
  const found = SCREENS.map((path) => ({
    name: path.slice(APP.length + 1),
    paddings: verticalPadding(readFileSync(path, 'utf8')),
  }))

  it.each(found)('$name 의 줄이 위아래 여백을 든다', ({ paddings }) => {
    expect(paddings).toHaveLength(1)
    expect(paddings[0]).not.toBeNull()
  })

  it('세 화면이 같은 값이다', () => {
    const values = new Set(found.flatMap((one) => one.paddings))
    expect(values.size).toBe(1)
    expect(values.has(null)).toBe(false)
  })
})
