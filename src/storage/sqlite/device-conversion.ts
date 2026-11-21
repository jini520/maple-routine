/**
 * 1.0.15 기기 변환의 단계 목록과 돌리는 함수. 기기의 기록 표를 서버 표와 같은 모양으로 한 번 바꾼다.
 *
 * DB 버전 이관(`migrations.ts`)과 따로 두는 이유는 단계가 새 게임 데이터의 줄 id 를 읽기 때문이다. DB 를 열 때는 게임 데이터가
 * 아직 없다. 마친 단계의 번호는 한 줄짜리 표 `device_conversion` 에 적는다.
 */
import type { SqliteDbConnection } from '../ports'
import { inTransaction } from './transaction'

/** 변환 단계 하나. 앞 단계가 바꾼 표를 받아 다음 모양으로 바꾼다. */
export type DeviceConversionStep = (db: SqliteDbConnection) => Promise<unknown>

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

/** 단계는 뒤에만 더한다. 차례를 바꾸거나 빼면 이미 그 번호까지 돈 기기가 다른 단계를 건너뛴다. */
const STEPS: readonly DeviceConversionStep[] = [dropLeftoverBossProfitPeriodChecks]

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

/**
 * 아직 안 돈 단계를 모두 한 트랜잭션으로 돌리고 같은 트랜잭션에 마친 번호를 적는다. 던지면 그 안의 변경과 번호가 함께
 * 되돌아가고 `DeviceConversionError` 로 던진다. 돌 단계가 있으면 먼저 사본을 뜬다. 트랜잭션 안에서는 `VACUUM` 이 돌지 않는다.
 *
 * @param steps 테스트가 단계를 갈아 끼울 때만 넘긴다
 */
export async function runDeviceConversion(
  db: SqliteDbConnection,
  steps: readonly DeviceConversionStep[] = STEPS,
): Promise<void> {
  const current = await deviceConversionVersionOf(db)
  if (current >= steps.length) return
  await backup(db).catch((error: unknown) => {
    throw new DeviceConversionError(0, error)
  })
  await inTransaction(db, async () => {
    for (let version = current + 1; version <= steps.length; version += 1) {
      try {
        await steps[version - 1]!(db)
      } catch (error: unknown) {
        throw new DeviceConversionError(version, error)
      }
    }
    await db.execute('DELETE FROM device_conversion')
    await db.run('INSERT INTO device_conversion (version) VALUES (?)', [steps.length])
  })
}
