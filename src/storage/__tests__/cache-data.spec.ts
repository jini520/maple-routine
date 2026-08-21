import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakePreferences } from './fake-preferences'
import type { CacheDataSelection } from '../cache-data'
import {
  BOSS_RECORD_TABLE_NAMES,
  GENERAL_TABLE_NAMES,
  clearCacheData,
  getCacheDataSizes,
} from '../cache-data'
import { BOSS_PROFIT_TABLE_NAMES, getBossProfitDb } from '../sqlite/db'
// 한시적 core→app 참조([[ADR-128]]) — `features/settings/cache-data` 가 core 로 오면(step 6) 상대
// 경로로 돌아온다. 이 파일이 검사하는 「닫기 → 커버 → 리로드」 순서(ADR-117 결정 8)와 storage 쪽
// 삭제 범위(ADR-052·058)는 같은 계약의 앞뒤라 떼어 놓지 않는다.
import { clearCacheDataAndReload } from '../../features/settings/cache-data'

// clearCacheDataAndReload의 "닫기 → 커버 → 리로드" 순서를 잡기 위한 공유 호출 기록(ADR-117 결정 8).
// 각 mock이 호출되는 시점에 이름을 push하므로 배열 자체가 곧 실행 순서다 — toHaveBeenCalled로는
// 순서가 안 잡히고, 이 step이 고치는 것이 정확히 순서다.
const { callOrder, closeDbMock, showSplashMock } = vi.hoisted(() => {
  const callOrder: string[] = []
  return {
    callOrder,
    closeDbMock: vi.fn(async () => {
      callOrder.push('close')
    }),
    showSplashMock: vi.fn(async () => {
      callOrder.push('cover')
    }),
  }
})

const { dbExecuteMock, dbQueryMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn<(statement: string) => Promise<void>>(async () => {}),
  dbQueryMock: vi.fn(),
}))
// ADR-052 결정 2: 삭제 대상 테이블 목록은 db.ts가 단일 진실 공급원이므로, 커넥션(getBossProfitDb)만
// 가짜로 바꾸고 BOSS_PROFIT_TABLE_NAMES는 실제 값을 그대로 쓴다 — 목록까지 모킹하면 "실제 테이블
// 전부를 지우는가"를 검증하지 못한다.
vi.mock('../sqlite/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sqlite/db')>()),
  getBossProfitDb: vi.fn(async () => ({ execute: dbExecuteMock, query: dbQueryMock })),
  closeBossProfitDb: closeDbMock,
}))

// 위 import와 같은 한시적 참조다 — `features/settings/cache-data` 가 부르는 그 모듈을 가리켜야
// 목이 걸린다(경로가 어긋나면 실물이 로드돼 커버가 진짜로 올라간다).
vi.mock('../../native/splash-screen', () => ({ showSplashScreen: showSplashMock }))

const KEEP_KEY_NAMES = ['apiKey', 'selectedAccountId', 'theme', 'trackingMode', 'dropEffect']

function deleteCalls(): string[] {
  return dbExecuteMock.mock.calls.map(([statement]) => statement)
}

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.set('apiKey', 'test-key')
  await prefs.set('selectedAccountId', 'acc-1')
  await prefs.set('theme', '렌')
  await prefs.set('trackingMode', 'manual')
  await prefs.set('dropEffect', 'off')
  await prefs.set('schedulerCache:ocid-1', '{}')
  await prefs.set('characterBasicCache:index', '[]')
  await prefs.set('trackedCharacters', '[]')
  await prefs.set('lastSelectedCharacter', 'ocid-1')
  dbQueryMock.mockResolvedValue({ values: [] })
  vi.clearAllMocks()
})

// ADR-058 결정 2: 그룹 정의는 열거가 아니라 차집합이다 — bossRecords만 명시 목록이고 general은
// 나머지 전부로 파생된다. 이 성질이 깨지면 새 테이블이 어느 그룹에도 안 잡혀 영영 안 지워진다
// (ADR-052가 없앤 누락 결함의 부호만 뒤집힌 형태).
describe('그룹 ↔ 테이블 분할', () => {
  it('두 그룹의 합집합이 db.ts가 정의한 테이블 전체와 같다', () => {
    const union = new Set([...GENERAL_TABLE_NAMES, ...BOSS_RECORD_TABLE_NAMES])

    expect(union).toEqual(new Set(BOSS_PROFIT_TABLE_NAMES))
  })

  it('두 그룹이 겹치지 않는다 — 한 테이블은 정확히 한 그룹에만 속한다', () => {
    const bossRecords = new Set<string>(BOSS_RECORD_TABLE_NAMES)

    expect(GENERAL_TABLE_NAMES.filter((table) => bossRecords.has(table))).toEqual([])
  })

  // ADR-058 결정 3: 재조회 표식만 남고 기록이 사라지면 loadPeriod의 isPeriodChecked 가드가
  // 백필을 건너뛰어(ADR-023), API가 아직 주는 최근 2주치마저 되살릴 수 없게 된다.
  it('boss_profit_period_checks는 수익 기록과 같은 그룹이다', () => {
    expect(BOSS_RECORD_TABLE_NAMES).toContain('boss_profit_records')
    expect(BOSS_RECORD_TABLE_NAMES).toContain('boss_drop_records')
    expect(BOSS_RECORD_TABLE_NAMES).toContain('boss_profit_period_checks')
  })

  // ADR-058 결정 4: 기록이 아니라 설정이고, 어느 쪽으로 지워도 위험한 조합이 없다.
  it('boss_party_settings는 일반 데이터 그룹이다', () => {
    expect(GENERAL_TABLE_NAMES).toContain('boss_party_settings')
  })
})

describe('clearCacheData', () => {
  // ADR-052 결정 1: trackingMode·dropEffect는 재조회로 복구되는 캐시가 아니라 사용자가 고른
  // 취향 설정이라, theme과 같이 캐시 삭제에도 보존한다.
  it('apiKey·selectedAccountId·theme·trackingMode·dropEffect는 남긴다', async () => {
    await clearCacheData()

    expect(await prefs.get('apiKey')).toBe('test-key')
    expect(await prefs.get('selectedAccountId')).toBe('acc-1')
    expect(await prefs.get('theme')).toBe('렌')
    expect(await prefs.get('trackingMode')).toBe('manual')
    expect(await prefs.get('dropEffect')).toBe('off')
  })

  it('보존 키는 어떤 그룹 조합에서도 남는다', async () => {
    await clearCacheData({ general: true, bossRecords: true })
    await clearCacheData({ general: true, bossRecords: false })
    await clearCacheData({ general: false, bossRecords: true })

    for (const key of KEEP_KEY_NAMES) {
      expect(await prefs.get(key)).not.toBeNull()
    }
  })

  // 인자 없는 호출은 선택 삭제 도입 전과 같아야 한다(ADR-058 — 호출부 호환).
  it('인자 없이 호출하면 두 그룹을 모두 지운다', async () => {
    await clearCacheData()

    expect(await prefs.get('schedulerCache:ocid-1')).toBeNull()
    expect(await prefs.get('characterBasicCache:index')).toBeNull()
    expect(await prefs.get('trackedCharacters')).toBeNull()
    expect(await prefs.get('lastSelectedCharacter')).toBeNull()
    for (const table of BOSS_PROFIT_TABLE_NAMES) {
      expect(dbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
    }
    // 목록에 없는 테이블까지 지우지 않는다(스키마 DROP·다른 DELETE 없음).
    expect(dbExecuteMock).toHaveBeenCalledTimes(BOSS_PROFIT_TABLE_NAMES.length)
  })

  describe('일반 데이터만 선택', () => {
    it('보존 키를 제외한 Preferences를 모두 지운다', async () => {
      await clearCacheData({ general: true, bossRecords: false })

      expect(await prefs.get('schedulerCache:ocid-1')).toBeNull()
      expect(await prefs.get('characterBasicCache:index')).toBeNull()
      expect(await prefs.get('trackedCharacters')).toBeNull()
      expect(await prefs.get('lastSelectedCharacter')).toBeNull()
    })

    it('일반 그룹 테이블만 비우고 수익·드롭 기록은 건드리지 않는다', async () => {
      await clearCacheData({ general: true, bossRecords: false })

      for (const table of GENERAL_TABLE_NAMES) {
        expect(dbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      for (const table of BOSS_RECORD_TABLE_NAMES) {
        expect(dbExecuteMock).not.toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      expect(deleteCalls()).toHaveLength(GENERAL_TABLE_NAMES.length)
    })
  })

  describe('수익·드롭 기록만 선택', () => {
    it('Preferences는 한 개도 지우지 않는다', async () => {
      await clearCacheData({ general: false, bossRecords: true })

      expect(await prefs.get('schedulerCache:ocid-1')).toBe('{}')
      expect(await prefs.get('characterBasicCache:index')).toBe('[]')
      expect(await prefs.get('trackedCharacters')).toBe('[]')
      expect(await prefs.get('lastSelectedCharacter')).toBe('ocid-1')
      expect(prefs.remove).not.toHaveBeenCalled()
    })

    it('수익·드롭 기록 테이블만 비운다', async () => {
      await clearCacheData({ general: false, bossRecords: true })

      for (const table of BOSS_RECORD_TABLE_NAMES) {
        expect(dbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      for (const table of GENERAL_TABLE_NAMES) {
        expect(dbExecuteMock).not.toHaveBeenCalledWith(`DELETE FROM ${table};`)
      }
      expect(deleteCalls()).toHaveLength(BOSS_RECORD_TABLE_NAMES.length)
    })
  })

  it('아무 그룹도 선택하지 않으면 아무것도 지우지 않는다', async () => {
    await clearCacheData({ general: false, bossRecords: false })

    expect(prefs.remove).not.toHaveBeenCalled()
    expect(dbExecuteMock).not.toHaveBeenCalled()
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
    // trackingMode 'manual'(6)·dropEffect 'off'(3)를 seed해도 합계가 늘지 않아야 한다(ADR-052 결정 1).
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
    expect(sizes.bossRecords).toBe(recordBytes)
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
    expect(sizes.bossRecords).toBe(0)
  })
})

// ADR-117 결정 8 — 캐시 삭제 경로는 OTA 적용 경로와 **같은 결함**을 갖고 있었다: 커버를 먼저
// 올린 뒤 매달릴 수 있는 닫기를 돌고, 화면을 되살리는 일(reload)이 그 뒤에 있었다. 닫기가 응답하지
// 않으면 리로드에 도달하지 못하고 브랜드 주황 커버만 남는다(이슈 #175와 같은 증상, 다른 트리거).
// 여기서 고치는 것은 순서 하나뿐이다 — 실패 UX는 만들지 않는다(ADR-065 결정 3: 항상 리로드하고
// 실패는 pendingNotice로 부팅 후에 알린다).
describe('clearCacheDataAndReload', () => {
  const ALL: CacheDataSelection = { general: true, bossRecords: true }

  beforeEach(() => {
    callOrder.length = 0
  })

  it('닫기 → 커버 → 리로드 순으로 부른다', async () => {
    const reload = vi.fn(() => {
      callOrder.push('reload')
    })

    await clearCacheDataAndReload(ALL, reload)

    expect(callOrder).toEqual(['close', 'cover', 'reload'])
  })

  // 이 순서의 값은 여기서 드러난다 — 닫기가 매달리는 동안 화면이 가려져 있지 않다(그 구간이
  // 정확히 사용자가 주황 화면에 갇히던 자리다). 커버는 리로드 직전에만 올라간다.
  it('닫기가 끝나기 전에는 커버를 올리지 않는다', async () => {
    let finishClose: () => void = () => {}
    closeDbMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            callOrder.push('close')
            resolve()
          }
        }),
    )
    const reload = vi.fn(() => {
      callOrder.push('reload')
    })

    const pending = clearCacheDataAndReload(ALL, reload)
    await vi.waitFor(() => {
      expect(closeDbMock).toHaveBeenCalled()
    })

    expect(showSplashMock).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()

    finishClose()
    await pending

    expect(callOrder).toEqual(['close', 'cover', 'reload'])
  })

  // 커버는 시각적 장치일 뿐이라, 그것이 실패했다고 리로드를 막으면 본말전도다
  // (ADR-027 2026-07-17 추가의 "스플래시 표시가 실패해도 진행한다"가 그대로 유효하다).
  it('커버 표시가 실패해도 리로드한다', async () => {
    showSplashMock.mockRejectedValueOnce(new Error('splash failed'))
    const reload = vi.fn(() => {
      callOrder.push('reload')
    })

    await clearCacheDataAndReload(ALL, reload)

    expect(reload).toHaveBeenCalledOnce()
    expect(callOrder).toEqual(['close', 'reload'])
  })
})
