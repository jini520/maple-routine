// 장비 이름·레벨 표. **AI 가 지어낸 값이 한 건도 없어야 한다.**
//
// 이름은 사용자 제공, 보조무기 22종의 레벨도 사용자 제공, 그 밖의 레벨은 넥슨 히스토리 API 가
// 준 값을 그대로 옮긴 것이다. 이 파일이 지키는 것은 그 표가 **스스로 모순되지 않는가** 다.
import equipmentItems from '../equipment-items.json'

interface Item {
  key: string
  name: string
  group: string
  set: string | null
  level: number | null
}

const items = equipmentItems.items as Item[]
const sets = equipmentItems.sets as { name: string; level: number | null }[]

it('키가 유일하다. 겹치면 뒤엣것이 앞엣것을 조용히 덮는다', () => {
  expect(new Set(items.map((item) => item.key)).size).toBe(items.length)
})

// 조회가 **공백 지운 이름**으로 이뤄지므로 그 형태에서 겹치면 안 된다.
it('이름이 유일하다', () => {
  expect(new Set(items.map((item) => item.name)).size).toBe(items.length)
})

it('이름에 공백이 없다. 조회 쪽이 공백을 지워 맞춘다', () => {
  expect(items.filter((item) => /\s/.test(item.name))).toEqual([])
})

// **0 은 모름이 아니다.** null 이어야 그 아이템의 비용을 안 매긴다.
it('레벨은 양수이거나 null 이다', () => {
  expect(items.filter((item) => item.level !== null && item.level <= 0)).toEqual([])
})

it('세트 이름은 sets 에 있는 것만 쓴다', () => {
  const known = new Set(sets.map((entry) => entry.name))
  expect(items.filter((item) => item.set !== null && !known.has(item.set))).toEqual([])
})

// 한 세트 안에서 레벨이 갈리면 세트 레벨을 쓸 수 없다. 그 세트는 sets.level 이 null 이어야 한다.
it('세트 레벨이 있으면 그 세트의 개별 레벨과 안 어긋난다', () => {
  const conflict = sets
    .filter((entry) => entry.level !== null)
    .flatMap((entry) =>
      items
        .filter((item) => item.set === entry.name && item.level !== null && item.level !== entry.level)
        .map((item) => `${item.name} ${item.level} ≠ ${entry.name} ${entry.level}`),
    )

  expect(conflict).toEqual([])
})

it('출처와 note 를 비워 두지 않는다. 다음 세션이 값의 근거를 여기서 읽는다', () => {
  expect(equipmentItems.source.length).toBeGreaterThan(50)
  expect(equipmentItems.note.length).toBeGreaterThan(50)
})
