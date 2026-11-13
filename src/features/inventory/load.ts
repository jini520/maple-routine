/**
 * 인벤토리 격자가 읽는 값. 미입력 보스 드롭은 기간을 가리지 않고 모은다.
 */
import { accountOfOcid } from '../../lib/mvp/membership'
import { getAllBossDropRecords } from '../../storage/boss-drops'
import { getRecordedCharacterOcids } from '../../storage/boss-profit'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import { getHuntFragmentTotal } from '../../storage/income'
import { getInventoryItems } from '../../storage/inventory'
import { getScheduleProbeLedger } from '../../storage/schedule-probe-ledger'
import { readCharacterBasic } from '../schedule-sync/read-schedule'
import { buildInventoryCells, type InventoryCell } from './cells'
import { ownerFaceOcid, type OwnerCharacter } from './owner-face'

/**
 * 격자의 칸 전부. 미입력 드롭은 추적 캐릭터와 기록이 있는 캐릭터의 것이다. 캐릭터를 관리 목록에서 빼도 그 캐릭터의 미입력
 * 드롭은 `아이템 가격 입력` 화면처럼 계속 선다.
 *
 * @param todayDateKey 사냥 조각을 세는 날
 */
export async function loadInventoryCells(todayDateKey: string, now: Date): Promise<InventoryCell[]> {
  const tracked = (await getTrackedCharacterOcids()) ?? []
  const recorded = await getRecordedCharacterOcids().catch(() => [])
  const [drops, huntFragments, items, sightings, representativeOcid] = await Promise.all([
    getAllBossDropRecords([...new Set([...tracked, ...recorded])]),
    getHuntFragmentTotal(todayDateKey),
    getInventoryItems(),
    getCharacterAccountSightings(),
    getRepresentativeCharacter(),
  ])
  const characters: OwnerCharacter[] = await Promise.all(
    tracked.map(async (ocid) => {
      const profile = readCharacterBasic(ocid)?.profile
      return {
        ocid,
        name: profile?.name ?? '',
        level: profile?.level ?? 0,
        accountId: accountOfOcid(sightings, ocid),
        worldKey: profile?.worldKey ?? null,
        unavailable: (await getScheduleProbeLedger(ocid, now)).unavailable,
      }
    }),
  )
  return buildInventoryCells({
    pendingDrops: drops.filter((drop) => drop.priceState === null),
    huntFragments,
    items,
    faceOf: (accountId, worldKey) => ownerFaceOcid({ accountId, worldKey }, characters, representativeOcid),
  })
}
