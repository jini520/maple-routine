// 장비 이름·레벨 표. **AI 가 지어낸 값이 한 건도 없어야 한다.**
//
// 이름은 사용자 제공, 보조무기 22종의 레벨도 사용자 제공, 그 밖의 레벨은 넥슨 히스토리 API 가
// 준 값을 그대로 옮긴 것이다. 이 파일이 지키는 것은 그 표가 **스스로 모순되지 않는가** 다.
import equipmentItems from '../equipment-items.json'

interface Item {
  key: string
  name: string
  group: string
  level: number | null
}

const items = equipmentItems.items as Item[]

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

// ⚠️ 세트 레벨을 채울 때 **영문 키의 접두사로 세트를 판정하지 말 것**(사용자 지적).
//
// `royal_black_metal_shoulder`(로얄블랙메탈숄더)가 하이네스 세트(`royal_*`)로, `genesis_badge`
// (창세의뱃지)가 제네시스 무기 세트로 잘못 채워졌었다. 키는 GMS 표기라 세트를 안 가른다.
// 세트를 가르는 것은 **한글 이름**이다.
const SET_LABEL_BY_KEY_PREFIX: [string, string][] = [
  ['meister', '마이스터'],
  ['royal', '하이네스'],
  ['eagle_eye', '이글아이'],
  ['trickster', '트릭스터'],
  ['trixter', '트릭스터'],
  ['fafnir', '파프니르'],
  ['absolab', '앱솔랩스'],
  ['arcane_umbra', '아케인셰이드'],
  ['eternel', '에테르넬'],
  ['genesis_', '제네시스'],
  ['destiny_', '데스티니'],
  ['scarlet', '스칼렛'],
]

it('영문 키가 가리키는 세트와 한글 이름이 어긋나지 않는다', () => {
  const mismatched = items
    .map((item) => {
      const label = SET_LABEL_BY_KEY_PREFIX.find(([prefix]) => item.key.startsWith(prefix))?.[1]
      return label !== undefined && !item.name.startsWith(label) ? `${item.key} → ${item.name}` : null
    })
    .filter((entry): entry is string => entry !== null)

  expect(mismatched).toEqual(['royal_black_metal_shoulder → 로얄블랙메탈숄더', 'genesis_badge → 창세의뱃지'])
})

it('출처와 note 를 비워 두지 않는다. 다음 세션이 값의 근거를 여기서 읽는다', () => {
  expect(equipmentItems.source.length).toBeGreaterThan(50)
  expect(equipmentItems.note.length).toBeGreaterThan(50)
})
