import { CHARACTER_BLOCK_COLORS, UNKNOWN_CHARACTER_COLOR, characterColorsOf } from '../character-colors'

it('추적 순서대로 팔레트를 하나씩 준다', () => {
  const colors = characterColorsOf(['a', 'b', 'c'])

  expect(colors('a')).toBe(CHARACTER_BLOCK_COLORS[0])
  expect(colors('b')).toBe(CHARACTER_BLOCK_COLORS[1])
  expect(colors('c')).toBe(CHARACTER_BLOCK_COLORS[2])
})

it('팔레트보다 캐릭터가 많으면 처음부터 다시 돈다', () => {
  const ocids = Array.from({ length: CHARACTER_BLOCK_COLORS.length + 1 }, (_, index) => `o${index}`)

  expect(characterColorsOf(ocids)(`o${CHARACTER_BLOCK_COLORS.length}`)).toBe(CHARACTER_BLOCK_COLORS[0])
})

it('추적 목록에 없는 캐릭터는 회색이다', () => {
  expect(characterColorsOf(['a'])('gone')).toBe(UNKNOWN_CHARACTER_COLOR)
})
