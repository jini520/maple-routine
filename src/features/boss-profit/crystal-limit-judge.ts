/**
 * 주간 결정석 판매 한도를 넘긴 처치를 판정해 기간 행에 적는 흐름. 처치 기록을 쓰거나 고친 자리가 그 주를 넘겨 부른다.
 *
 * @see docs/features/boss-profit.md 의 `기록`
 */
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss/bosses'
import { overCrystalLimitIds } from '../../lib/boss/crystal-limit'
import { getCrystalLimitRecords, setOverCrystalLimit } from '../../storage/boss-profit'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { loadMapleIdOwners } from '../maple-id/owners'

/** 앱을 켠 뒤 모든 주를 한 번 판정했나. 업데이트 전 주와 소속 · 추적 순서가 바뀐 주를 그때 맞춘다 */
let judgedAll = false
/** 판정끼리 겹치지 않게 잇는 줄. 겹치면 앞 판정이 읽은 낡은 기록으로 뒤 판정의 결과를 덮는다 */
let queue: Promise<void> = Promise.resolve()

/**
 * 그 주들을 통째로 다시 판정하는 함수. 앱을 켠 뒤 처음 부르면 기록이 있는 모든 주를 판정한다.
 *
 * 던지지 않는다. 메이플 ID 소속을 못 읽거나 쓰기가 실패하면 지난 판정을 그대로 두고, 다음 판정이 다시 맞춘다.
 *
 * @param weekKeys 처치 기록을 쓰거나 고친 주(목요일 `YYYY-MM-DD`). 월간 키는 걸리는 기록이 없다. 어느 주를 고쳤는지 모르면 `'all'`
 * @example await judgeCrystalLimit([row.periodKey])
 */
export function judgeCrystalLimit(weekKeys: readonly string[] | 'all'): Promise<void> {
  const run = queue.then(() => judge(weekKeys)).catch(() => undefined)
  queue = run
  return run
}

async function judge(weekKeys: readonly string[] | 'all'): Promise<void> {
  const weeks = !judgedAll || weekKeys === 'all' ? 'all' : [...new Set(weekKeys)]
  if (weeks !== 'all' && weeks.length === 0) return

  const orderedOcids = (await getTrackedCharacterOcids()) ?? []
  const owners = await loadMapleIdOwners(orderedOcids)
  const records = await getCrystalLimitRecords(weeks)
  const over = overCrystalLimitIds(records, {
    limit: WEEKLY_CRYSTAL_SALE_LIMIT,
    mapleIdOfOcid: owners.ofOcid,
    orderedOcids,
  })
  await setOverCrystalLimit(
    records
      .filter((record) => record.overCrystalLimit !== over.has(record.id))
      .map((record) => ({ id: record.id, over: over.has(record.id) })),
  )
  if (weeks === 'all') judgedAll = true
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다 */
export function resetCrystalLimitJudgeForTests(): void {
  judgedAll = false
  queue = Promise.resolve()
}
