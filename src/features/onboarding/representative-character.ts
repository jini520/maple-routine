import type { MapleCharacter } from '../../types'

type NameGroup = 0 | 1 | 2 | 3 // 한글 > 알파벳 > 숫자 > 그 외

function classifyName(name: string): NameGroup {
  const firstChar = name[0] ?? ''
  if (/[가-힣]/.test(firstChar)) return 0
  if (/[a-zA-Z]/.test(firstChar)) return 1
  if (/[0-9]/.test(firstChar)) return 2
  return 3
}

function compareByName(a: string, b: string): number {
  const groupA = classifyName(a)
  const groupB = classifyName(b)
  if (groupA !== groupB) return groupA - groupB

  const locale = groupA === 0 ? 'ko' : 'en'
  return a.localeCompare(b, locale, { numeric: true })
}

export function pickRepresentativeCharacter(characters: MapleCharacter[]): MapleCharacter {
  if (characters.length === 0) {
    throw new Error('pickRepresentativeCharacter: characters 배열이 비어 있습니다')
  }

  return [...characters].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    return compareByName(a.name, b.name)
  })[0]
}
