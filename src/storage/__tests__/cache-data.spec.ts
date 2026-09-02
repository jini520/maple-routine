
import { waitFor } from '../../__tests__/wait-for'
import { installFakePreferences } from './fake-preferences'
import type { CacheDataSelection } from '../cache-data'
import {
  RECORD_TABLE_NAMES,
  GENERAL_TABLE_NAMES,
  clearCacheData,
  getCacheDataSizes,
} from '../cache-data'
import { BOSS_PROFIT_TABLE_NAMES, getBossProfitDb } from '../sqlite/db'
// 한시적 core→app 참조 — `features/settings/cache-data` 가 core 로 오면(step 6) 상대
// 경로로 돌아온다. 이 파일이 검사하는 `닫기 → 커버 → 리로드` 순서와 storage 쪽
// 삭제 범위(058)는 같은 계약의 앞뒤라 떼어 놓지 않는다.
import { clearCacheDataAndReload } from '../../features/settings/cache-data'

// 팩토리 밖 이름은 `mock` 접두만 끌어올 수 있고 팩토리가 여러 번 불릴 수 있어, **같은 목을
// 돌려주는** 멱등 헬퍼로 둔다(vitest 의 `vi.hoisted` 가 하던 일).
var mockCallOrder: string[] | undefined
var mockShared: Record<string, jest.Mock> | undefined

/** 가짜 DB 가 돌려주는 함수들도 **같은 인스턴스**여야 한다. 테스트가 그 위에 단언한다. */
function mockDb(name: string): jest.Mock {
  const shared = (mockShared = mockShared ?? {})
  shared[name] = shared[name] ?? jest.fn()
  return shared[name]
}

function mockOnce(name: string, label: string): jest.Mock {
  const order = (mockCallOrder = mockCallOrder ?? [])
  const shared = (mockShared = mockShared ?? {})
  shared[name] =
    shared[name] ??
    jest.fn(async () => {
      order.push(label)
    })
  return shared[name]
}

// clearCacheDataAndReload의 "닫기 → 커버 → 리로드" 순서를 잡기 위한 공유 호출 기록.
// 각 mock이 호출되는 시점에 이름을 push하므로 배열 자체가 곧 실행 순서다. toHaveBeenCalled로는
// 순서가 안 잡히고, 이 step이 고치는 것이 정확히 순서다.
// 삭제 대상 테이블 목록은 db.ts가 단일 진실 공급원이므로, 커넥션(getBossProfitDb)만
// 가짜로 바꾸고 BOSS_PROFIT_TABLE_NAMES는 실제 값을 그대로 쓴다. 목록까지 모킹하면 "실제 테이블
// 전부를 지우는가"를 검증하지 못한다.
jest.mock('../sqlite/db', () => ({
  ...jest.requireActual<typeof import('../sqlite/db')>('../sqlite/db'),
  getBossProfitDb: jest.fn(async () => ({ execute: mockDb('execute'), query: mockDb('query') })),
  closeBossProfitDb: mockOnce('close', 'close'),
}))

// 위 import와 같은 한시적 참조다. `features/settings/cache-data` 가 부르는 그 모듈을 가리켜야
// 목이 걸린다(경로가 어긋나면 실물이 로드돼 커버가 진짜로 올라간다).
jest.mock('../../native/splash-screen', () => ({ showSplashScreen: mockOnce('splash', 'cover') }))

const mockDbExecuteMock = mockDb('execute')
const dbQueryMock = mockDb('query')
const mockCloseDbMock = mockOnce('close', 'close')
const mockShowSplashMock = mockOnce('splash', 'cover')
const callOrder = (mockCallOrder = mockCallOrder ?? [])


const KEEP_KEY_NAMES = ['apiKey', 'theme', 'trackingMode', 'dropEffect']

function deleteCalls(): string[] {
  return mockDbExecuteMock.mock.calls.map(([statement]) => statement)
}

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.set('apiKey', 'test-key')
  await prefs.set('theme', '렌')
  await prefs.set('trackingMode', 'manual')
  await prefs.set('dropEffect', 'off')
  await prefs.set('schedulerCache:ocid-1', '{}')
  await prefs.set('characterBasicCache:index', '[]')
  await prefs.set('trackedCharacters', '[]')
  await prefs.set('lastSelectedCharacter', 'ocid-1')
  dbQueryMock.mockResolvedValue({ values: [] })
  jest.clearAllMocks()
})

// 그룹 정의는 열거가 아니라 차집합이다. records만 명시 목록이고 general은
// 나머지 전부로 파생된다. 이 성질이 깨지면 새 테이블이 어느 그룹에도 안 잡혀 영영 안 지워진다
// (가 없앤 누락 결함의 부호만 뒤집힌 형태).
describe('그룹 ↔ 테이블 분할', () => {
  it('두 그룹의 합집합이 db.ts가 정의한 테이블 전체와 같다', () => {
    const union = new Set([...GENERAL_TABLE_NAMES, ...RECORD_TABLE_NAMES])

    expect(union).toEqual(new Set(BOSS_PROFIT_TABLE_NAMES))
  })

  it('두 그룹이 겹치지 않는다 — 한 테이블은 정확히 한 그룹에만 속한다', () => {
    const records = new Set<string>(RECORD_TABLE_NAMES)

    expect(GENERAL_TABLE_NAMES.filter((table) => records.has(table))).toEqual([])
  })

  // 재조회 표식만 남고 기록이 사라지면 loadPeriod의 isPeriodChecked 가드가
  // 백필을 건너뛰어, API가 아직 주는 최근 2주치마저 되살릴 수 없게 된다.
  it('boss_profit_period_checks는 수익 기록과 같은 그룹이다', () => {
    expect(RECORD_TABLE_NAMES).toContain('boss_profit_records')
    expect(RECORD_TABLE_NAMES).toContain('boss_drop_records')
    expect(RECORD_TABLE_NAMES).toContain('boss_profit_period_checks')
  })

  // 기록이 아니라 설정이고, 어느 쪽으로 지워도 위험한 조합이 없다.
  it('boss_party_settings는 일반 데이터 그룹이다', () => {
    expect(GENERAL_TABLE_NAMES).toContain('boss_party_settings')
  })

  // : 그룹 이름이 `bossRecords` 에서 `records` 로 넓어진
  // 이유가 이 둘이다. 손입력이 유일한 원천이라 **API 로 되살릴 길이 0%** 이고, 아무것도 안 하면
  // 차집합 파생 때문에 **지워도 되는 것**(general)으로 끌려간다.
  it('손입력 기록 둘은 `기록` 그룹이다 — 지워지면 되살릴 길이 없다', () => {
    expect(RECORD_TABLE_NAMES).toContain('income_records')
    expect(RECORD_TABLE_NAMES).toContain('spend_records')
  })

  it('손입력 기록 둘은 일반 데이터 그룹에 없다', () => {
    expect(GENERAL_TABLE_NAMES).not.toContain('income_records')
    expect(GENERAL_TABLE_NAMES).not.toContain('spend_records')
  })
})

describe('clearCacheData', () => {
  // trackingMode·dropEffect는 재조회로 복구되는 캐시가 아니라 사용자가 고른
  // 취향 설정이라, theme과 같이 캐시 삭제에도 보존한다.
  it('apiKey·theme·trackingMode·dropEffect는 남긴다', async () => {
    await clearCacheData()

    expect(await prefs.get('apiKey')).toBe('test-key')
    expect(await prefs.get('theme')).toBe('렌')
    expect(await prefs.get('trackingMode')).toBe('manual')
    expect(await prefs.get('dropEffect')).toBe('off')
  })

  it('보존 키는 어떤 그룹 조합에서도 남는다', async () => {
    await clearCacheData({ general: true, records: true })
    await clearCacheData({ general: true, records: false })
    await clearCacheData({ general: false, records: true })

    for (const key of KEEP_KEY_NAMES) {
      expect(await prefs.get(key)).not.toBeNull()
    }
  })

  // 인자 없는 호출은 선택 삭제 도입 전과 같아야 한다(호출부 호환).
  it('인자 없이 호출하면 두 그룹을 모두 지운다', async () => {
    await clearCacheData()

    expect(await prefs.get('schedulerCache:ocid-1')).toBeNull()
    expect(await prefs.get('characterBasicCache:index')).toBeNull()
    expect(await prefs.get('trackedCharacters')).toBeNull()
    expect(await prefs.get('lastSelectedCharacter')).toBeNull()
    for (const table of BOSS_PROFIT_TABLE_NAMES) {
      expect(mockDbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
    }
    // 목록에 없는 테이블까지 지우지 않는다(스키마 DROP·다른 DELETE 없음).
    expect(mockDbExecuteMock).toHaveBeenCalledTimes(BOSS_PROFIT_TABLE_NAMES.length)
  })

  describe('일반 데이터만 선택', () => {
    it('보존 키를 제외한 Preferences를 모두 지운다', async () => {
      await clearCacheData({ general: true, records: false })

      expect(await prefs.get('schedulerCache:ocid-1')).toBeNull()
      expect(await prefs.get('characterBasicCache:index')).toBeNull()
      expect(await prefs.get('trackedCharacters')).toBeNull()
      expect(await prefs.get('lastSelectedCharacter')).toBeNull()
    })

    it('일반 그룹 테이블만 비우고 수익·드롭 기록은 건드리지 않는다', async () => {
      await clearCacheData({ general: true, records: false })

      for (const table of GENERAL_TABLE_NAMES) {
        expect(mockDbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      for (const table of RECORD_TABLE_NAMES) {
        expect(mockDbExecuteMock).not.toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      expect(deleteCalls()).toHaveLength(GENERAL_TABLE_NAMES.length)
    })
  })

  describe('수익·드롭 기록만 선택', () => {
    it('Preferences는 한 개도 지우지 않는다', async () => {
      await clearCacheData({ general: false, records: true })

      expect(await prefs.get('schedulerCache:ocid-1')).toBe('{}')
      expect(await prefs.get('characterBasicCache:index')).toBe('[]')
      expect(await prefs.get('trackedCharacters')).toBe('[]')
      expect(await prefs.get('lastSelectedCharacter')).toBe('ocid-1')
      expect(prefs.remove).not.toHaveBeenCalled()
    })

    it('수익·드롭 기록 테이블만 비운다', async () => {
      await clearCacheData({ general: false, records: true })

      for (const table of RECORD_TABLE_NAMES) {
        expect(mockDbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      for (const table of GENERAL_TABLE_NAMES) {
        expect(mockDbExecuteMock).not.toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      expect(deleteCalls()).toHaveLength(RECORD_TABLE_NAMES.length)
    })
  })

  it('아무 그룹도 선택하지 않으면 아무것도 지우지 않는다', async () => {
    await clearCacheData({ general: false, records: false })

    expect(prefs.remove).not.toHaveBeenCalled()
    expect(mockDbExecuteMock).not.toHaveBeenCalled()
    // 지울 것이 없으면 커넥션도 열지 않는다.
    expect(getBossProfitDb).not.toHaveBeenCalled()
  })
})

describe('getCacheDataSizes', () => {
  it('보존 키를 제외한 Preferences 바이트 수를 일반 그룹에 합산한다', async () => {
    const sizes = await getCacheDataSizes()

    // schedulerCache:ocid-1 '{}'(2) + characterBasicCache:index '[]'(2)
    // + trackedCharacters '[]'(2) + lastSelectedCharacter 'ocid-1'(6) = 12.
    // 보존 키(apiKey·selectedAccountId·theme·trackingMode·dropEffect)는 삭제되지 않으므로 제외 —
    // trackingMode 'manual'(6)·dropEffect 'off'(3)를 seed해도 합계가 늘지 않아야 한다.
    expect(sizes.general).toBe(12)
  })

  it('SQLite 각 테이블 행의 바이트 수를 그 테이블이 속한 그룹에 합산한다', async () => {
    dbQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('boss_profit_records')) {
        return { values: [{ ocid: 'ocid-1', boss: '자쿰' }] }
      }
      if (sql.includes('boss_party_settings')) {
        return { values: [{ ocid: 'ocid-2' }] }
      }
      return { values: [] }
    })

    const sizes = await getCacheDataSizes()

    const recordBytes = new TextEncoder().encode('ocid-1').length + new TextEncoder().encode('자쿰').length
    expect(sizes.records).toBe(recordBytes)
    // 일반 그룹 = Preferences 12 + boss_party_settings의 'ocid-2'(6)
    expect(sizes.general).toBe(12 + new TextEncoder().encode('ocid-2').length)
  })

  it('보존 키만 남아 있으면 일반 그룹이 0이다', async () => {
    const keys = await prefs.keys()
    await Promise.all(
      keys.filter((key) => !KEEP_KEY_NAMES.includes(key)).map((key) => prefs.remove(key)),
    )

    const sizes = await getCacheDataSizes()

    expect(sizes.general).toBe(0)
    expect(sizes.records).toBe(0)
  })
})

// 캐시 삭제 경로는 OTA 적용 경로와 **같은 결함**을 갖고 있었다: 커버를 먼저
// 올린 뒤 매달릴 수 있는 닫기를 돌고, 화면을 되살리는 일(reload)이 그 뒤에 있었다. 닫기가 응답하지
// 않으면 리로드에 도달하지 못하고 브랜드 주황 커버만 남는다(이슈 #175와 같은 증상, 다른 트리거).
// 여기서 고치는 것은 순서 하나뿐이다. 실패 UX는 만들지 않는다(: 항상 리로드하고
// 실패는 pendingNotice로 부팅 후에 알린다).
describe('clearCacheDataAndReload', () => {
  const ALL: CacheDataSelection = { general: true, records: true }

  beforeEach(() => {
    callOrder.length = 0
  })

  it('닫기 → 커버 → 리로드 순으로 부른다', async () => {
    const reload = jest.fn(() => {
      callOrder.push('reload')
    })

    await clearCacheDataAndReload(ALL, reload)

    expect(callOrder).toEqual(['close', 'cover', 'reload'])
  })

  // 이 순서의 값은 여기서 드러난다. 닫기가 매달리는 동안 화면이 가려져 있지 않다(그 구간이
  // 정확히 사용자가 주황 화면에 갇히던 자리다). 커버는 리로드 직전에만 올라간다.
  it('닫기가 끝나기 전에는 커버를 올리지 않는다', async () => {
    let finishClose: () => void = () => {}
    mockCloseDbMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            callOrder.push('close')
            resolve()
          }
        }),
    )
    const reload = jest.fn(() => {
      callOrder.push('reload')
    })

    const pending = clearCacheDataAndReload(ALL, reload)
    await waitFor(() => {
      expect(mockCloseDbMock).toHaveBeenCalled()
    })

    expect(mockShowSplashMock).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()

    finishClose()
    await pending

    expect(callOrder).toEqual(['close', 'cover', 'reload'])
  })

  // 커버는 시각적 장치일 뿐이라, 그것이 실패했다고 리로드를 막으면 본말전도다
  // (2026-07-17 추가의 "스플래시 표시가 실패해도 진행한다"가 그대로 유효하다).
  it('커버 표시가 실패해도 리로드한다', async () => {
    mockShowSplashMock.mockRejectedValueOnce(new Error('splash failed'))
    const reload = jest.fn(() => {
      callOrder.push('reload')
    })

    await clearCacheDataAndReload(ALL, reload)

    expect(reload).toHaveBeenCalledOnce()
    expect(callOrder).toEqual(['close', 'reload'])
  })
})
