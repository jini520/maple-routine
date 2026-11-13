/**
 * 인벤토리 격자가 읽는 값. 미입력 보스 드롭은 기간을 가리지 않고 모은다.
 */
import { mapleIdNameOf } from '../../lib/maple-id-name'
import { accountOfOcid } from '../../lib/mvp/membership'
import { worldNameOf } from '../../lib/world/worlds'
import { getAllBossDropRecords } from '../../storage/boss-drops'
import { getRecordedCharacterOcids } from '../../storage/boss-profit'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import { getHuntFragmentTotal } from '../../storage/income'
import { getInventoryItems } from '../../storage/inventory'
import { getMapleIdNames } from '../../storage/maple-id-names'
import { getScheduleProbeLedger } from '../../storage/schedule-probe-ledger'
import { resolveDisplayProfiles } from '../character-profile/resolve'
import { readCharacterBasic } from '../schedule-sync/read-schedule'
import { buildInventoryCells, type InventoryCell } from './cells'
import { ownerFaceOcid, type OwnerCharacter } from './owner-face'

/** 칸 오른쪽 위에 서는 얼굴 하나. */
export interface InventoryFace {
  name: string
  imageUrl: string | null
  unavailable: boolean
}

export interface InventoryView {
  cells: InventoryCell[]
  /** 칸의 `faceOcid` → 얼굴. 프로필을 못 찾은 캐릭터는 들지 않는다 */
  faces: Readonly<Record<string, InventoryFace>>
  /** 넣은 아이템 줄 id → `메이플 ID 이름 · 월드`. 판매 · 수정 시트와 삭제 확인이 주인을 적는다 */
  owners: Readonly<Record<string, string>>
}

/**
 * 격자의 칸 전부. 미입력 드롭은 추적 캐릭터와 기록이 있는 캐릭터의 것이다. 캐릭터를 관리 목록에서 빼도 그 캐릭터의 미입력
 * 드롭은 `아이템 가격 입력` 화면처럼 계속 선다.
 *
 * @param todayDateKey 사냥 조각을 세는 날
 */
export async function loadInventory(todayDateKey: string, now: Date): Promise<InventoryView> {
  const tracked = (await getTrackedCharacterOcids()) ?? []
  const recorded = await getRecordedCharacterOcids().catch(() => [])
  const [drops, huntFragments, items, sightings, representativeOcid, mapleIdNames] = await Promise.all([
    getAllBossDropRecords([...new Set([...tracked, ...recorded])]),
    getHuntFragmentTotal(todayDateKey),
    getInventoryItems(),
    getCharacterAccountSightings(),
    getRepresentativeCharacter(),
    getMapleIdNames().catch(() => ({})),
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
  const cells = buildInventoryCells({
    pendingDrops: drops.filter((drop) => drop.priceState === null),
    huntFragments,
    items,
    faceOf: (accountId, worldKey) => ownerFaceOcid({ accountId, worldKey }, characters, representativeOcid),
  })
  const faceOcids = [...new Set(cells.flatMap((cell) => (cell.faceOcid === null ? [] : [cell.faceOcid])))]
  const profiles = await resolveDisplayProfiles(faceOcids)
  const faces: Record<string, InventoryFace> = {}
  for (const ocid of faceOcids) {
    const profile = profiles.get(ocid)
    if (profile === undefined) continue
    faces[ocid] = {
      name: profile.name,
      imageUrl: profile.imageUrl === '' ? null : profile.imageUrl,
      unavailable: characters.find((each) => each.ocid === ocid)?.unavailable ?? (await getScheduleProbeLedger(ocid, now)).unavailable,
    }
  }
  const owners: Record<string, string> = {}
  for (const item of items) {
    owners[item.id] = `${mapleIdNameOf(item.accountId, mapleIdNames)} · ${worldNameOf(item.worldKey, item.worldKey)}`
  }
  return { cells, faces, owners }
}

/** 넣기 시트의 메이플 ID · 월드 보기 하나. */
export interface InventoryOwner {
  accountId: string
  worldKey: string
  label: string
}

/**
 * 넣기 시트의 메이플 ID · 월드 보기. 추적 캐릭터가 있는 메이플 ID · 월드이고, 차례는 그 메이플 ID · 월드의 캐릭터 가운데
 * 캐릭터 관리에서 가장 앞선 캐릭터의 자리다.
 */
export async function loadInventoryOwners(): Promise<InventoryOwner[]> {
  const [tracked, sightings, mapleIdNames] = await Promise.all([
    getTrackedCharacterOcids().then((ocids) => ocids ?? []),
    getCharacterAccountSightings(),
    getMapleIdNames().catch(() => ({})),
  ])
  const owners: InventoryOwner[] = []
  for (const ocid of tracked) {
    const accountId = accountOfOcid(sightings, ocid)
    const worldKey = readCharacterBasic(ocid)?.profile?.worldKey ?? null
    if (accountId === null || worldKey === null) continue
    if (owners.some((each) => each.accountId === accountId && each.worldKey === worldKey)) continue
    owners.push({ accountId, worldKey, label: `${mapleIdNameOf(accountId, mapleIdNames)} · ${worldNameOf(worldKey, worldKey)}` })
  }
  return owners
}
