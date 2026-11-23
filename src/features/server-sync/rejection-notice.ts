/**
 * 올리기의 두 거절(`duplicate_record` · `record_deleted`)을 알리는 문구와 기록 이름.
 *
 * 오프라인에서 적은 기록은 연결된 뒤에 거절이 와서, 이름이 없으면 무엇이 바뀌었는지 알 수 없다. 넥슨에서 받아 기기가 스스로 적는
 * 기록은 사용자가 친 값이 아니라 막힌 입력이 없어 알리지 않는다.
 *
 * @see docs/foundation/server-sync.md `거절 알림`
 */
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { bossDifficultyOfId, bossNameOf } from '../../lib/boss/bosses'
import { findCashbookCategoryById } from '../../lib/cashbook/categories'
import { findItemById, ringLevelOf, withRingLevel } from '../../lib/item-catalog'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { ERROR_CODES } from '../../server/error-codes'

export type RejectionCode = typeof ERROR_CODES.duplicateRecord | typeof ERROR_CODES.recordDeleted

/** 알리는 거절 한 건. 이름을 모르면 `null` 이다 */
export interface Rejection {
  code: RejectionCode
  name: string | null
}

/** 거절마다 문구의 뒷말. 이름이 모두 받침으로 끝나 앞말 뒤에 `은` 이 붙는다. */
const TAILS: Record<RejectionCode, string> = {
  [ERROR_CODES.duplicateRecord]: '다른 기기에서 먼저 적어, 그 기록으로 바꿨습니다',
  [ERROR_CODES.recordDeleted]: '다른 기기에서 지워, 고친 내용을 저장하지 못했습니다',
}

/** 알리는 거절 코드인가. */
export function isRejectionCode(code: string | null): code is RejectionCode {
  return code === ERROR_CODES.duplicateRecord || code === ERROR_CODES.recordDeleted
}

/** 넥슨에서 받아 기기가 스스로 적는 기록의 표. 알리지 않는다. */
const SILENT_TABLES: readonly string[] = ['enhancementTotals', 'sharedContentProgress', 'rememberedLevels']

const WEEKDAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/** 기록 이름을 짓는 데 기기에서 더 읽어야 하는 것. */
export interface RecordNameDeps {
  characterNameOf(ocid: string): Promise<string | null>
}

/** `11월 20일`. 날짜 key 가 아니면 `null` 이다. */
function monthDayOf(dateKey: unknown): string | null {
  const match = typeof dateKey === 'string' ? /^\d{4}-(\d{2})-(\d{2})$/.exec(dateKey) : null
  return match === null ? null : `${Number(match[1])}월 ${Number(match[2])}일`
}

/**
 * `루시드 하드`. 처치를 적는 보스 수익 화면과 같은 정식 이름이라야 어느 줄인지 찾는다. 게임 데이터에 없는 난이도 줄이면 `null` 이다.
 */
function bossDifficultyNameOf(id: unknown): string | null {
  const owner = typeof id === 'string' ? bossDifficultyOfId(id) : null
  return owner === null ? null : `${bossNameOf(owner.bossKey, owner.bossKey)} ${DIFFICULTY_NAME[owner.difficulty]}`
}

/** 아이템 표의 이름. 특수스킬 반지의 레벨 줄은 레벨을 붙인다. */
function itemNameOf(id: unknown): string | null {
  const item = typeof id === 'string' ? findItemById(id) : null
  if (item === null) return null
  const ring = ringLevelOf(item)
  return ring === null ? item.name : withRingLevel(ring.ring.name, ring.ringLevel)
}

function named(prefix: string | null, suffix: string): string | null {
  return prefix === null ? null : `${prefix} ${suffix}`
}

/**
 * 거절된 기록의 이름. 알리지 않는 기록이면 `silent`, 이름의 재료가 기기에 없거나 이름을 정하지 않은 기록이면 `null` 이다.
 *
 * @param source 보낼 때 읽은 원본. 거절을 받으면 기기 줄을 지우므로 지우기 전에 짓는다
 */
export async function recordNameOf(
  table: string,
  source: Record<string, unknown> | null,
  deps: RecordNameDeps,
): Promise<string | null | 'silent'> {
  if (SILENT_TABLES.includes(table)) return 'silent'
  if (source === null) return null
  switch (table) {
    case 'bossProfitEntries':
      // 자동으로 적은 처치는 넥슨이 준 것이다. 처치 전 수익 건은 그 주의 분배만 든 줄이라 분배 설정으로 부른다.
      if (source.clear_recorded_by === 'auto') return 'silent'
      return named(
        bossDifficultyNameOf(source.boss_difficulty_id),
        source.clear_recorded_by === 'manual' ? '처치 기록' : '분배 설정',
      )
    case 'bossDrops':
      return named(itemNameOf(source.item_id), '드롭 기록')
    case 'bossSplitSettings':
      return named(bossDifficultyNameOf(source.boss_difficulty_id), '분배 설정')
    case 'inventoryItems':
      return named(itemNameOf(source.item_id), '인벤토리 기록')
    case 'mvpGradeHistory':
      return 'MVP 등급 기록'
    case 'characterWorldLeaps':
      return named(typeof source.ocid === 'string' ? await deps.characterNameOf(source.ocid) : null, '월드 리프 연결')
    case 'cashbookEntries': {
      const category = typeof source.category_id === 'string' ? findCashbookCategoryById(source.category_id) : null
      const day = monthDayOf(source.date)
      return day === null || category === null ? null : `${day} ${category.name} 기록`
    }
    case 'partyAppointments': {
      const schedule = (source.schedule ?? {}) as { type?: unknown; weekday?: unknown; date?: unknown }
      const when =
        schedule.type === 'weekly'
          ? (WEEKDAY_NAMES[Number(schedule.weekday)] ?? null)
          : schedule.type === 'once'
            ? monthDayOf(schedule.date)
            : null
      return when === null || typeof source.time !== 'string' ? null : `${when} ${source.time} 파티 약속`
    }
    case 'bossProfitCalculatorRecords': {
      const time = typeof source.savedAt === 'string' ? new Date(source.savedAt) : null
      const day = time === null || Number.isNaN(time.getTime()) ? null : monthDayOf(getCurrentKstDateKey(time))
      return named(day, '보스 수익 계산 기록')
    }
    default:
      return null
  }
}

/**
 * 거절마다 한 문구. 한 건이면 기록 이름을 넣고, 여러 건이거나 이름을 모르면 `기록 N건은` 으로 쓴다. 새 문구를 만들지 않으려고 이름을
 * 모르는 한 건도 건수로 쓴다.
 */
export function rejectionMessagesOf(rejections: readonly Rejection[]): string[] {
  return (Object.keys(TAILS) as RejectionCode[]).flatMap((code) => {
    const same = rejections.filter((one) => one.code === code)
    if (same.length === 0) return []
    const only = same.length === 1 ? same[0]!.name : null
    return [`${only ?? `기록 ${same.length}건`}은 ${TAILS[code]}`]
  })
}
