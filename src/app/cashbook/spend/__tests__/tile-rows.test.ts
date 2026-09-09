// 묶음을 줄로 묶는 규칙.
//
// 배치 규칙이 렌더러 안에 있으면 시뮬레이터를 띄워야만 검증된다. 그래서 판정만 따로 본다.
import { rowsOfGroups } from '../tile-rows'

const 하나 = (name: string) => ({ group: name, choices: [{ label: name }] })
const 여럿 = (name: string, n: number) => ({
  group: name,
  choices: Array.from({ length: n }, (_, i) => ({ label: `${name}${i}` })),
})

const 이름 = (rows: { group: string }[][]): string[][] =>
  rows.map((row) => row.map((each) => each.group))

describe('타일 하나짜리 묶음은 한 줄에 둘씩', () => {
  it('잇달아 오는 하나짜리 둘이 한 줄에 선다', () => {
    const rows = rowsOfGroups([여럿('포인트 샵', 5), 하나('VIP 사우나'), 하나('기타')])

    expect(이름(rows)).toEqual([['포인트 샵'], ['VIP 사우나', '기타']])
  })

  it('타일이 여럿인 묶음은 혼자 한 줄이다', () => {
    const rows = rowsOfGroups([여럿('가', 2), 여럿('나', 3)])

    expect(이름(rows)).toEqual([['가'], ['나']])
  })

  // 셋을 한 줄에 세우면 타일이 1/3 폭으로 돌아가 다른 줄과 크기가 갈린다.
  it('하나짜리가 셋이면 둘 + 하나다', () => {
    const rows = rowsOfGroups([하나('가'), 하나('나'), 하나('다')])

    expect(이름(rows)).toEqual([['가', '나'], ['다']])
  })

  it('하나짜리 사이에 여럿짜리가 끼면 안 묶인다', () => {
    const rows = rowsOfGroups([하나('가'), 여럿('나', 2), 하나('다')])

    expect(이름(rows)).toEqual([['가'], ['나'], ['다']])
  })

  it('빈 목록은 빈 목록이다', () => {
    expect(rowsOfGroups([])).toEqual([])
  })
})
