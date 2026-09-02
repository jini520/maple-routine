// 이 파일이 지키는 것은 **기존 사용자의 데이터가 계속 보이는가** 하나다(`docs/migration/data.md` 결정 1).
//
// 여기서 틀리면 예외가 안 난다. 접두사가 어긋나면 조회가 그냥 `null` 을 돌려주고, 화면에는 "빈
// 저장소"로 그려진다. 그래서 접두사 문자열 자체를 리터럴로 못박는다: 상수를 참조해 비교하면 상수가
// 틀렸을 때 테스트도 같이 틀린다.
import {
  IOS_KEY_PREFIX,
  toAppKeys,
  toNativeKey,
} from '../capacitor-storage-keys'

// 실제로 쓰이는 키에서 골랐다(`src/storage/keys.ts` · `docs/persistence/preferences.md`).
// `:` 를 물고 있는 파생 키를 섞은 이유는 접두사 처리가 키 모양을 안 가리는지 함께 보기 위해서다.
const APP_KEYS = [
  'apiKey',
  'trackedCharacters',
  'schedulerCache:abc123',
  'characterBasicCache:index:69e3525',
]

describe('iOS 키 접두사', () => {
  it('접두사는 점(`.`)까지 포함해 정확히 "CapacitorStorage." 다', () => {
    expect(IOS_KEY_PREFIX).toBe('CapacitorStorage.')
  })

  it('앱 키 앞에 접두사를 붙인다', () => {
    expect(toNativeKey('apiKey', 'ios')).toBe('CapacitorStorage.apiKey')
    expect(toNativeKey('schedulerCache:abc123', 'ios')).toBe(
      'CapacitorStorage.schedulerCache:abc123',
    )
  })

  it('접두사를 떼어 앱 키로 되돌린다', () => {
    expect(toAppKeys(['CapacitorStorage.apiKey', 'CapacitorStorage.theme'], 'ios')).toEqual([
      'apiKey',
      'theme',
    ])
  })

  // 읽기와 쓰기가 같은 키를 봐야 한다. 한쪽만 접두사를 붙이면 앱을 쓸수록 데이터가 갈라진다.
  it('붙였다 떼면 원래 키 목록과 같다', () => {
    const nativeKeys = APP_KEYS.map((key) => toNativeKey(key, 'ios'))
    expect(toAppKeys(nativeKeys, 'ios')).toEqual(APP_KEYS)
  })
})

describe('iOS 키 목록 필터', () => {
  // UserDefaults.standard 는 시스템과 공유하는 저장소라 남의 키가 반드시 섞여 온다.
  it('접두사가 없는 무관한 UserDefaults 키는 목록에 섞이지 않는다', () => {
    const raw = [
      'AppleLanguages',
      'CapacitorStorage.apiKey',
      'NSInterfaceStyle',
      'CapacitorStorage.theme',
      'AppleLocale',
    ]
    expect(toAppKeys(raw, 'ios')).toEqual(['apiKey', 'theme'])
  })

  it('접두사와 닮았을 뿐인 키도 섞이지 않는다', () => {
    // 점이 없는 `CapacitorStorage`(그룹명 그 자체)와, 접두사로 시작하는 척하는 다른 그룹.
    const raw = ['CapacitorStorage', 'CapacitorStorageBackup.apiKey', 'CapacitorStorage.apiKey']
    expect(toAppKeys(raw, 'ios')).toEqual(['apiKey'])
  })

  it('앱 키가 하나도 없으면 빈 목록이다', () => {
    expect(toAppKeys(['AppleLanguages', 'AppleLocale'], 'ios')).toEqual([])
  })
})

describe('Android 키 규칙', () => {
  // Android 는 `CapacitorStorage` 라는 별도 SharedPreferences 파일이 곧 네임스페이스라 키에
  // 접두사가 붙지 않는다. 붙이면 기존 키를 하나도 못 찾는다.
  it('키를 그대로 둔다', () => {
    for (const key of APP_KEYS) {
      expect(toNativeKey(key, 'android')).toBe(key)
    }
  })

  it('키 목록을 거르지도 자르지도 않는다', () => {
    expect(toAppKeys(APP_KEYS, 'android')).toEqual(APP_KEYS)
  })
})
