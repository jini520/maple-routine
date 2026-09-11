import { installFakePreferences } from './fake-preferences'
import {
  clearLastSelectedCharacter,
  clearRepresentativeCharacter,
  clearTrackedCharacterOcids,
  getLastSelectedCharacter,
  getRepresentativeCharacter,
  getTrackedCharacterOcids,
  removeTrackedCharacter,
  replaceTrackedCharacter,
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

// 월드 리프 확인 뒤의 교체. 사용자가 모달에서 그렇다고 답할 때만 불린다.
describe('replaceTrackedCharacter', () => {
  it('추적 목록에서 옛 ocid 자리에 새 ocid 를 넣는다. 순서가 안 바뀐다', async () => {
    await setTrackedCharacterOcids(['a', 'old', 'b'])
    await replaceTrackedCharacter('old', 'new')
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'new', 'b'])
  })

  it('대표가 옛 ocid 였으면 새 ocid 로 옮긴다', async () => {
    await setTrackedCharacterOcids(['old'])
    await setRepresentativeCharacter('old')
    await replaceTrackedCharacter('old', 'new')
    await expect(getRepresentativeCharacter()).resolves.toBe('new')
  })

  it('대표가 남이면 안 건드린다', async () => {
    await setTrackedCharacterOcids(['a', 'old'])
    await setRepresentativeCharacter('a')
    await replaceTrackedCharacter('old', 'new')
    await expect(getRepresentativeCharacter()).resolves.toBe('a')
  })

  it('마지막 선택이 옛 ocid 였으면 새 ocid 로 옮긴다', async () => {
    await setTrackedCharacterOcids(['old'])
    await setLastSelectedCharacter('old')
    await replaceTrackedCharacter('old', 'new')
    await expect(getLastSelectedCharacter()).resolves.toBe('new')
  })

  // 화면이 한 번 더 부르거나 두 기기가 겹쳐 도는 경우. 이미 바뀐 목록을 망가뜨리면 안 된다.
  it('옛 ocid 가 목록에 없으면 아무것도 안 한다', async () => {
    await setTrackedCharacterOcids(['a', 'new'])
    await replaceTrackedCharacter('old', 'new')
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'new'])
  })

  // 사용자가 모달을 띄워 둔 채 새 캐릭터를 손으로 추가한 경우. 같은 ocid 가 두 번 서면 격자
  // 키가 겹쳐 행 하나가 사라진다.
  it('새 ocid 가 이미 목록에 있으면 옛 자리만 빼고 중복을 안 만든다', async () => {
    await setTrackedCharacterOcids(['old', 'new', 'b'])
    await replaceTrackedCharacter('old', 'new')
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['new', 'b'])
  })
})

// 옮겨간 캐릭터를 이미 관리 중일 때의 처방. 사용자가 모달에서 `목록에서 빼기` 를 누를 때만
// 불린다. 교체와 달리 **남는 캐릭터의 자리를 안 건드린다**.
describe('removeTrackedCharacter', () => {
  it('그 ocid 만 빼고 나머지 순서는 그대로 둔다', async () => {
    await setTrackedCharacterOcids(['a', 'old', 'b'])
    await expect(removeTrackedCharacter('old')).resolves.toEqual(['a', 'b'])
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'b'])
  })

  // 교체는 옛 자리를 새 ocid 가 물려받지만 여기서는 새 것이 이미 제 자리에 서 있다. 끌어오면
  // 사용자가 맞춰 둔 순서가 이유 없이 바뀐다.
  it('옮겨간 캐릭터의 자리를 안 옮긴다', async () => {
    await setTrackedCharacterOcids(['a', 'old', 'b', 'new'])
    await expect(removeTrackedCharacter('old')).resolves.toEqual(['a', 'b', 'new'])
  })

  it('대표가 그 ocid 였으면 대표를 비운다', async () => {
    await setTrackedCharacterOcids(['a', 'old'])
    await setRepresentativeCharacter('old')
    await removeTrackedCharacter('old')
    await expect(getRepresentativeCharacter()).resolves.toBeNull()
  })

  it('대표가 남이면 안 건드린다', async () => {
    await setTrackedCharacterOcids(['a', 'old'])
    await setRepresentativeCharacter('a')
    await removeTrackedCharacter('old')
    await expect(getRepresentativeCharacter()).resolves.toBe('a')
  })

  // 모달을 띄워 둔 채 사용자가 캐릭터 관리에서 직접 뺀 경우.
  it('목록에 없으면 아무것도 안 하고 null 이다', async () => {
    await setTrackedCharacterOcids(['a', 'b'])
    await expect(removeTrackedCharacter('old')).resolves.toBeNull()
    await expect(getTrackedCharacterOcids()).resolves.toEqual(['a', 'b'])
  })
})
