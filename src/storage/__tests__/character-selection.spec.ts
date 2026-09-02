import { installFakePreferences } from './fake-preferences'
import {
  clearLastSelectedCharacter,
  clearRepresentativeCharacter,
  clearTrackedCharacterOcids,
  getLastSelectedCharacter,
  getRepresentativeCharacter,
  getTrackedCharacterOcids,
  setCharacterSelection,
  setLastSelectedCharacter,
  setRepresentativeCharacter,
  setTrackedCharacterOcids,
} from '../character-selection'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

describe('round-trip', () => {
  it('setTrackedCharacterOcids 후 getTrackedCharacterOcids로 저장한 값을 그대로 읽는다', async () => {
    await setTrackedCharacterOcids(['ocid-1', 'ocid-2'])
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['ocid-1', 'ocid-2'])
  })

  it('단일 키(trackedCharacters)에 저장한다', async () => {
    await setTrackedCharacterOcids(['ocid-1'])
    await expect(prefs.get('trackedCharacters')).resolves.toBe(JSON.stringify(['ocid-1']))
  })
})

describe('저장된 값이 없는 경우', () => {
  it('한 번도 설정한 적 없으면 null을 반환한다', async () => {
    await expect(getTrackedCharacterOcids()).resolves.toBeNull()
  })
})

describe('빈 배열과 null의 구분', () => {
  it('사용자가 명시적으로 전부 해제하면 null이 아니라 빈 배열을 반환한다', async () => {
    await setTrackedCharacterOcids([])
    await expect(getTrackedCharacterOcids()).resolves.toEqual([])
  })
})

describe('clearTrackedCharacterOcids', () => {
  it('clear 이후에는 다시 null을 반환한다', async () => {
    await setTrackedCharacterOcids(['ocid-1'])
    await clearTrackedCharacterOcids()
    await expect(getTrackedCharacterOcids()).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await prefs.set('trackedCharacters', 'not-valid-json{')
    await expect(getTrackedCharacterOcids()).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setTrackedCharacterOcids도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setTrackedCharacterOcids(['ocid-1'])).rejects.toThrow('disk full')
  })
})

// content/boss로 갈려 있던 추적 목록을 단일 키로 통합한다.
describe('통합 마이그레이션', () => {
  it('content·boss 목록을 중복 제거된 합집합으로 이관한다', async () => {
    await prefs.set('trackedCharacters:content', JSON.stringify(['a', 'b']))
    await prefs.set('trackedCharacters:boss', JSON.stringify(['b', 'c']))

    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'b', 'c'])
  })

  it('레거시 daily/weekly만 있는 설치본의 목록도 흡수한다', async () => {
    await prefs.set('trackedCharacters:daily', JSON.stringify(['a']))
    await prefs.set('trackedCharacters:weekly', JSON.stringify(['b', 'a']))

    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'b'])
  })

  it('네 레거시 키가 전부 없으면 아무것도 쓰지 않고 null을 반환한다', async () => {
    await expect(getTrackedCharacterOcids()).resolves.toBeNull()
    await expect(prefs.get('trackedCharacters')).resolves.toBeNull()
  })

  it('레거시 목록이 빈 배열(명시적 전부 해제)이면 빈 배열로 이관한다', async () => {
    await prefs.set('trackedCharacters:content', JSON.stringify([]))

    await expect(getTrackedCharacterOcids()).resolves.toEqual([])
  })

  it('마지막 선택 캐릭터는 content 값을 우선해 이관한다', async () => {
    await prefs.set('trackedCharacters:content', JSON.stringify(['a']))
    await prefs.set('lastSelectedCharacter:content', 'ocid-content')
    await prefs.set('lastSelectedCharacter:boss', 'ocid-boss')

    await expect(getLastSelectedCharacter()).resolves.toBe('ocid-content')
  })

  it('content 쪽 마지막 선택이 없으면 boss 값을 이관한다', async () => {
    await prefs.set('trackedCharacters:boss', JSON.stringify(['a']))
    await prefs.set('lastSelectedCharacter:boss', 'ocid-boss')

    await expect(getLastSelectedCharacter()).resolves.toBe('ocid-boss')
  })

  it('이관 후 레거시 키를 전부 삭제한다', async () => {
    await prefs.set('trackedCharacters:content', JSON.stringify(['a']))
    await prefs.set('trackedCharacters:boss', JSON.stringify(['b']))
    await prefs.set('trackedCharacters:daily', JSON.stringify(['c']))
    await prefs.set('trackedCharacters:weekly', JSON.stringify(['d']))
    await prefs.set('lastSelectedCharacter:content', 'ocid-content')
    await prefs.set('lastSelectedCharacter:boss', 'ocid-boss')

    await getTrackedCharacterOcids()

    for (const key of [
      'trackedCharacters:content',
      'trackedCharacters:boss',
      'trackedCharacters:daily',
      'trackedCharacters:weekly',
      'lastSelectedCharacter:content',
      'lastSelectedCharacter:boss',
    ]) {
      await expect(prefs.get(key)).resolves.toBeNull()
    }
  })

  it('통합 키가 이미 있으면 레거시 값으로 덮어쓰지 않는다', async () => {
    await setTrackedCharacterOcids([])
    await prefs.set('trackedCharacters:content', JSON.stringify(['a']))

    await expect(getTrackedCharacterOcids()).resolves.toEqual([])
  })

  it('getLastSelectedCharacter만 호출해도 이관이 수행된다', async () => {
    await prefs.set('trackedCharacters:content', JSON.stringify(['a']))
    await prefs.set('lastSelectedCharacter:content', 'ocid-content')

    await getLastSelectedCharacter()

    await expect(prefs.get('trackedCharacters')).resolves.toBe(JSON.stringify(['a']))
  })

  it('추적 목록과 마지막 선택을 동시에 조회해도(스토어의 Promise.all) 합집합이 유실되지 않는다', async () => {
    await prefs.set('trackedCharacters:content', JSON.stringify(['a']))
    await prefs.set('trackedCharacters:boss', JSON.stringify(['b']))

    const [ocids] = await Promise.all([getTrackedCharacterOcids(), getLastSelectedCharacter()])

    expect(ocids).toEqual(['a', 'b'])
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'b'])
  })
})

// 대표 캐릭터는 "표식"이다. 미지정이면 키가 없고, 그때 "첫 번째가 임시 대표"라는
// 규칙은 읽는 쪽(화면)의 것이라 저장 레이어가 그 파생값을 만들지도 저장하지도 않는다.
describe('대표 캐릭터', () => {
  it('저장 전에는 null을 반환한다', async () => {
    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('setRepresentativeCharacter 후 저장한 ocid를 그대로 읽는다', async () => {
    await setRepresentativeCharacter('ocid-1')
    await expect(getRepresentativeCharacter()).resolves.toBe('ocid-1')
  })

  it('단일 키(representativeCharacter)에 저장한다', async () => {
    await setRepresentativeCharacter('ocid-1')
    await expect(prefs.get('representativeCharacter')).resolves.toBe('ocid-1')
  })

  it('clearRepresentativeCharacter 호출 후 다시 null을 반환한다', async () => {
    await setRepresentativeCharacter('ocid-1')
    await clearRepresentativeCharacter()
    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('미지정이면 목록의 첫 번째를 대신 돌려주지 않는다. 파생값을 만들지 않는다', async () => {
    await setTrackedCharacterOcids(['ocid-1', 'ocid-2'])
    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('lastSelectedCharacter와 다른 축이라 서로를 건드리지 않는다', async () => {
    await setLastSelectedCharacter('ocid-last')
    await setRepresentativeCharacter('ocid-rep')

    await expect(getLastSelectedCharacter()).resolves.toBe('ocid-last')
    await expect(getRepresentativeCharacter()).resolves.toBe('ocid-rep')
  })
})

// 참조 무결성은 쓰는 쪽이 지킨다. 대표가 추적 목록에 없으면 그 키를 지운다.
describe('setCharacterSelection (참조 무결성)', () => {
  it('목록과 대표를 함께 저장한다', async () => {
    await setCharacterSelection(['ocid-1', 'ocid-2'], 'ocid-2')

    await expect(getTrackedCharacterOcids()).resolves.toEqual(['ocid-1', 'ocid-2'])
    await expect(getRepresentativeCharacter()).resolves.toBe('ocid-2')
  })

  it('대표를 목록에서 빼고 저장하면 대표 키가 지워진다', async () => {
    await setCharacterSelection(['ocid-1', 'ocid-2'], 'ocid-1')

    await setCharacterSelection(['ocid-2'], 'ocid-1')

    await expect(getTrackedCharacterOcids()).resolves.toEqual(['ocid-2'])
    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('대표가 null이면 이미 저장된 대표를 지운다', async () => {
    await setCharacterSelection(['ocid-1'], 'ocid-1')

    await setCharacterSelection(['ocid-1'], null)

    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('목록만 따로 저장해도 목록에 없는 대표는 남지 않는다', async () => {
    await setRepresentativeCharacter('ocid-1')

    await setTrackedCharacterOcids(['ocid-2'])

    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('대표가 새 목록에 그대로 있으면 유지한다', async () => {
    await setRepresentativeCharacter('ocid-1')

    await setTrackedCharacterOcids(['ocid-2', 'ocid-1'])

    await expect(getRepresentativeCharacter()).resolves.toBe('ocid-1')
  })

  it('목록 저장이 실패하면 대표를 건드리지 않는다', async () => {
    await setCharacterSelection(['ocid-1'], 'ocid-1')
    prefs.set.mockRejectedValueOnce(new Error('disk full'))

    await expect(setCharacterSelection(['ocid-2'], 'ocid-2')).rejects.toThrow('disk full')

    await expect(getTrackedCharacterOcids()).resolves.toEqual(['ocid-1'])
    await expect(getRepresentativeCharacter()).resolves.toBe('ocid-1')
  })
})

describe('마지막 선택 캐릭터', () => {
  it('저장 전에는 null을 반환한다', async () => {
    await expect(getLastSelectedCharacter()).resolves.toBeNull()
  })

  it('setLastSelectedCharacter 후 getLastSelectedCharacter로 저장한 ocid를 그대로 읽는다', async () => {
    await setLastSelectedCharacter('ocid-1')
    await expect(getLastSelectedCharacter()).resolves.toBe('ocid-1')
  })

  it('clearLastSelectedCharacter 호출 후 다시 null을 반환한다', async () => {
    await setLastSelectedCharacter('ocid-1')
    await clearLastSelectedCharacter()
    await expect(getLastSelectedCharacter()).resolves.toBeNull()
  })
})
