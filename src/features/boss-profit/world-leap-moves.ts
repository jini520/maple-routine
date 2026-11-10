/**
 * 월드 리프로 이어진 옛 ocid 의 기록을 새 ocid 로 옮기는 회차. 리프 중복 정리(`cleanUpWorldLeapDuplicates`) 바로 뒤에 부른다.
 *
 * 리프한 기간의 같은 처치를 먼저 짝지어야 옮긴 옛 기록이 새 기록과 부딪치지 않는다. 연결마다 매 회차 돌아, 이 기능 전에 이어 둔
 * 연결의 기록도 옮기고 중간에 실패한 옮기기를 다음 회차가 마저 한다. 다 옮긴 연결은 옮길 것이 없어 바로 끝난다.
 *
 * 새 ocid 에 같은 자리의 값이 있으면 새 것을 두는 규칙은 저장소마다의 옮기기 함수가 갖는다.
 */
import { moveBossProfitCalculatorRecordsToOcid } from '../../storage/boss-profit-calculator-records'
import { moveBossRecordsToOcid } from '../../storage/boss-profit'
import { getCharacterWorldLeaps } from '../../storage/character-world-leaps'
import { moveIncomeRecordsToOcid } from '../../storage/income'
import { moveLastHuntToOcid } from '../../storage/last-hunts'
import { moveManualTrackedContentToOcid } from '../../storage/manual-tracked-content'
import { movePartyAppointmentsToOcid } from '../../storage/party-appointments'
import { moveRememberedLevelsToOcid } from '../../storage/remembered-levels'
import { moveSpendRecordsToOcid } from '../../storage/spend'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

const ignore = (): undefined => undefined

/** 한 연결의 기록을 옮기고 옮긴 보스 기간 수를 돌려준다. 쓰기는 차례로 한다. 단일 공유 커넥션이라 겹치면 트랜잭션이 던진다. */
async function moveLink(fromOcid: string, toOcid: string): Promise<number> {
  // 한 기록의 실패가 다른 기록을 막으면 안 된다. 다음 회차가 마저 옮긴다.
  const bossPeriods = await moveBossRecordsToOcid(fromOcid, toOcid).catch(() => 0)
  await moveIncomeRecordsToOcid(fromOcid, toOcid).catch(ignore)
  await moveSpendRecordsToOcid(fromOcid, toOcid).catch(ignore)
  await moveRememberedLevelsToOcid(fromOcid, toOcid).catch(ignore)
  await moveManualTrackedContentToOcid(fromOcid, toOcid).catch(ignore)
  await moveLastHuntToOcid(fromOcid, toOcid).catch(ignore)
  await moveBossProfitCalculatorRecordsToOcid(fromOcid, toOcid).catch(ignore)
  if (await movePartyAppointmentsToOcid(fromOcid, toOcid).catch(() => false)) {
    // 약속 화면은 캐시만 그린다. 낡은 캐시를 다시 저장하면 옮긴 ocid 가 옛 ocid 로 돌아간다.
    void queryClient.invalidateQueries({ queryKey: queryKeys.partyAppointments() })
  }
  return bossPeriods
}

/**
 * 이어진 연결마다 옛 ocid 의 기록을 새 ocid 로 옮기는 회차.
 *
 * @returns 옮긴 보스 기간 수. 회차가 기록을 다시 읽을지 이것으로 가른다
 */
export async function moveWorldLeapRecords(): Promise<number> {
  const links = await getCharacterWorldLeaps().catch(() => [])
  let moved = 0
  for (const link of links) {
    moved += await moveLink(link.fromOcid, link.toOcid)
  }
  return moved
}
