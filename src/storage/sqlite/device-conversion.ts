/**
 * 1.0.15 기기 변환의 단계 목록과 돌리는 함수. 기기의 기록 표를 서버 표와 같은 모양으로 한 번 바꾼다.
 *
 * DB 버전 이관(`migrations.ts`)과 따로 두는 이유는 단계가 새 게임 데이터의 줄 id 를 읽기 때문이다. DB 를 열 때는 게임 데이터가
 * 아직 없다. 마친 단계의 번호는 한 줄짜리 표 `device_conversion` 에 적는다.
 */
import type { SqliteDbConnection } from '../ports'
import { convertBossTables } from './convert-boss-tables'
import { convertCashbookTables } from './convert-cashbook-tables'
import { convertEnhancementTables } from './convert-enhancement-tables'
import { inTransaction } from './transaction'

/**
 * 단계가 받는 Preferences 의 값. 저장소 층의 단계는 Preferences 를 읽지 않아 부팅이 변환 전에 읽어 넘긴다. 새로 설치한 DB 는 바꿀
 * 줄이 없어 비어 있다.
 */
export interface DeviceConversionContext {
  /** 지금 넥슨을 부르는 자격의 계정 id. 계정 칸이 생기기 전의 기록은 모두 이 계정으로 받았다. 로그인 전이면 없다 */
  mainNexonAccountId?: string | null
  /** 화면이 대표로 세우는 캐릭터. 주인을 모르는 옛 손입력이 이 캐릭터에게 붙는다 */
  representativeOcid?: string | null
}

/** 변환 단계 하나. 앞 단계가 바꾼 표를 받아 다음 모양으로 바꾼다. */
export type DeviceConversionStep = (db: SqliteDbConnection, context: DeviceConversionContext) => Promise<unknown>

/** 마친 단계의 번호를 적는 한 줄짜리 표. 데이터 삭제가 지우지 않는다. 지우면 바뀐 표를 다시 바꾸려다 던진다. */
export const DEVICE_CONVERSION_BODY = `(
    version INTEGER NOT NULL
  )`

/** 단계가 던진 실패. 사용 로그가 어느 단계에서 멈췄는지 알린다. 사본을 뜨다 실패하면 단계는 0 이다. */
export class DeviceConversionError extends Error {
  constructor(
    readonly step: number,
    cause: unknown,
  ) {
    super(`기기 변환 ${step}단계가 실패했다: ${String(cause)}`)
    this.name = 'DeviceConversionError'
  }
}

/** 버전 13 이 지우게 된 것은 그 버전을 지난 기기가 생긴 뒤라, 그 기기에 남은 빈 표를 지운다. */
async function dropLeftoverBossProfitPeriodChecks(db: SqliteDbConnection): Promise<void> {
  await db.execute('DROP TABLE IF EXISTS boss_profit_period_checks')
}

/**
 * 1.0.14 가 서버로 못 보낸 드롭 판매가 줄을 비운다. 1.0.15 서버에는 그 경로가 없고, 기기의 드롭은 첫 올리기가 모두 올린다. 옛
 * 앱의 다른 종류 줄도 보낼 곳이 없어 함께 비운다.
 */
async function clearLegacyServerSyncQueue(db: SqliteDbConnection): Promise<void> {
  await db.execute('DELETE FROM server_sync_queue')
}

/** 단계는 뒤에만 더한다. 차례를 바꾸거나 빼면 이미 그 번호까지 돈 기기가 다른 단계를 건너뛴다. */
const STEPS: readonly DeviceConversionStep[] = [
  dropLeftoverBossProfitPeriodChecks,
  convertBossTables,
  convertCashbookTables,
  convertEnhancementTables,
  clearLegacyServerSyncQueue,
]

/** 보스 기록 표 셋을 새 모양으로 바꾸는 단계의 번호. 이 번호까지 돈 DB 는 DB 를 열 때 새 표를 만든다. */
export const BOSS_TABLES_CONVERTED_AT = STEPS.indexOf(convertBossTables) + 1

/** 가계부 기록 표 · 인벤토리 · 기억한 레벨을 새 모양으로 바꾸는 단계의 번호. 이 번호까지 돈 DB 는 DB 를 열 때 새 표를 만든다. */
export const CASHBOOK_TABLES_CONVERTED_AT = STEPS.indexOf(convertCashbookTables) + 1

/** 강화 합계 · 월드 리프 · MVP 등급 표를 새 모양으로 바꾸는 단계의 번호. 이 번호까지 돈 DB 는 DB 를 열 때 새 표를 만든다. */
export const ENHANCEMENT_TABLES_CONVERTED_AT = STEPS.indexOf(convertEnhancementTables) + 1

/** 마지막 단계의 번호. */
export const DEVICE_CONVERSION_VERSION = STEPS.length

/** 마친 단계의 번호. 한 번도 돌지 않은 DB 는 줄이 없어 0 이다. */
export async function deviceConversionVersionOf(db: SqliteDbConnection): Promise<number> {
  const { values } = await db.query('SELECT version FROM device_conversion')
  const version = Number((values?.[0] as { version?: unknown } | undefined)?.version)
  return Number.isInteger(version) ? version : 0
}

/**
 * 변환 전 사본의 경로. 같은 폴더에 DB 파일 이름 뒤 `-before-1.0.15` 를 붙인다.
 *
 * @param dbFile `PRAGMA database_list` 의 DB 파일 경로
 */
export function deviceConversionBackupPathOf(dbFile: string): string {
  return `${dbFile.replace(/\.db$/, '')}-before-1.0.15.db`
}

/** 이미 있으면 덮지 않는다. 한 번 실패하고 다시 도는 기기와 단계가 늘어난 개발 빌드에서 첫 사본이 남아야 한다. */
async function backup(db: SqliteDbConnection): Promise<void> {
  const { values } = await db.query('PRAGMA database_list')
  const file = (values ?? []).find((row) => row.name === 'main')?.file
  if (typeof file !== 'string' || file === '') return
  try {
    await db.execute(`VACUUM INTO '${deviceConversionBackupPathOf(file).replace(/'/g, "''")}'`)
  } catch (error: unknown) {
    if (!String(error).includes('already exists')) throw error
  }
}

/** 변환을 돌리는 방법. 새로 설치한 DB 는 바꿀 줄이 없어 사본을 뜨지 않고 맥락도 없다. 단계는 테스트가 갈아 끼울 때만 넘긴다. */
export interface DeviceConversionOptions {
  backup?: boolean
  steps?: readonly DeviceConversionStep[]
  context?: DeviceConversionContext
}

/**
 * 아직 안 돈 단계를 모두 한 트랜잭션으로 돌리고 같은 트랜잭션에 마친 번호를 적는다. 던지면 그 안의 변경과 번호가 함께
 * 되돌아가고 `DeviceConversionError` 로 던진다. 돌 단계가 있으면 먼저 사본을 뜬다. 트랜잭션 안에서는 `VACUUM` 이 돌지 않는다.
 */
export async function runDeviceConversion(db: SqliteDbConnection, options: DeviceConversionOptions = {}): Promise<void> {
  const steps = options.steps ?? STEPS
  const current = await deviceConversionVersionOf(db)
  if (current >= steps.length) return
  if (options.backup !== false) {
    await backup(db).catch((error: unknown) => {
      throw new DeviceConversionError(0, error)
    })
  }
  await inTransaction(db, async () => {
    for (let version = current + 1; version <= steps.length; version += 1) {
      try {
        await steps[version - 1]!(db, options.context ?? {})
      } catch (error: unknown) {
        throw new DeviceConversionError(version, error)
      }
    }
    await db.execute('DELETE FROM device_conversion')
    await db.run('INSERT INTO device_conversion (version) VALUES (?)', [steps.length])
  })
}
