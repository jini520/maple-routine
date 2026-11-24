/**
 * 보스 관리 화면의 초안. 저장하기 전에 바꾼 추적 난이도와 파티 설정을 든다.
 *
 * 화면은 저장된 값에 초안을 얹어 그리고, 저장 함수는 저장소의 지금 배열에 같은 함수로 초안을 얹어 쓴다. 두 곳이 같은 함수를 써야
 * 화면에 보인 목록이 그대로 저장된다.
 */
import type { BossPartyShareColumns } from '../../storage/boss-party-settings'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'
import type { BossDifficulty } from '../../types'

/** 파티 모달의 `적용` 이 넣은 값 하나. */
export interface BossPartyDraft {
  bossKey: string
  difficulty: BossDifficulty
  partySize: number
  shares: BossPartyShareColumns
}

export interface BossManageDraft {
  /** 보스 key 마다 추적 난이도. `null` 은 추적 안 함 */
  tracking: Partial<Record<string, BossDifficulty | null>>
  /** `partySizeKey` 마다 파티 설정. 스토어의 `partySizes` 와 같은 키라 저장된 값을 같은 키로 찾는다 */
  party: Partial<Record<string, BossPartyDraft>>
}

export const EMPTY_BOSS_MANAGE_DRAFT: BossManageDraft = { tracking: {}, party: {} }

/** 비율을 안 쓰는 파티. 설정이 없는 조합이 이 값이다. */
const NO_PARTY_SHARES: BossPartyShareColumns = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
}

/** 저장된 목록에서 그 보스의 추적 난이도. 같은 보스가 둘이면 앞의 것이고, 추적하지 않으면 `null` 이다. */
export function trackedBossDifficulty(items: readonly ManualTrackedItem[], bossKey: string): BossDifficulty | null {
  for (const item of items) {
    if (item.kind === 'boss' && item.bossKey === bossKey) return item.difficulty
  }
  return null
}

/**
 * 저장된 추적 목록에 초안을 얹은 목록.
 *
 * 바꾼 보스는 처음 자리에서 난이도만 바뀌고 같은 보스의 다른 항목은 빠진다. 지우고 다시 넣으면 순서가 끝으로 밀린다. 새로 켠
 * 보스는 끝에 붙는다.
 */
export function applyBossTrackingDraft(
  items: readonly ManualTrackedItem[],
  tracking: BossManageDraft['tracking'],
): ManualTrackedItem[] {
  const placed = new Set<string>()
  const next = items.flatMap((item): ManualTrackedItem[] => {
    if (item.kind !== 'boss') return [item]
    const difficulty = tracking[item.bossKey]
    if (difficulty === undefined) return [item]
    if (difficulty === null || placed.has(item.bossKey)) return []
    placed.add(item.bossKey)
    return [{ ...item, difficulty }]
  })
  for (const [bossKey, difficulty] of Object.entries(tracking)) {
    if (difficulty !== undefined && difficulty !== null && !placed.has(bossKey)) {
      next.push({ kind: 'boss', bossKey, difficulty })
    }
  }
  return next
}

/**
 * 파티 설정 둘이 같은 약속인가.
 *
 * 등급을 따르는 송금 수수료는 요율 칸을 보지 않는다. 저장소는 그 칸을 비우고 모달은 그 등급의 요율을 채워 내보내서, 같은 약속이
 * 다른 값으로 온다. `제외` 는 다른 칸을 모두 비우므로 인원만 본다.
 */
export function samePartySetting(
  a: { partySize: number; shares: BossPartyShareColumns },
  b: { partySize: number; shares: BossPartyShareColumns },
): boolean {
  if (a.partySize !== b.partySize) return false
  const excluded = a.shares.crystalExcluded === true
  if (excluded !== (b.shares.crystalExcluded === true)) return false
  if (excluded) return true
  const feeAuto = a.shares.splitFeeAuto === true
  return (
    a.shares.crystalMyShare === b.shares.crystalMyShare &&
    a.shares.crystalSharesTotal === b.shares.crystalSharesTotal &&
    feeAuto === (b.shares.splitFeeAuto === true) &&
    (feeAuto || a.shares.splitFeePercent === b.shares.splitFeePercent)
  )
}

/** 저장된 값. 파티 설정이 없는 조합은 솔로이고 비율이 없다. */
export interface BossManageStored {
  items: readonly ManualTrackedItem[]
  partySizes: Readonly<Record<string, number>>
  partyShares: Readonly<Record<string, BossPartyShareColumns>>
}

/** 저장된 파티 설정. 없으면 솔로다. */
export function storedPartySetting(
  stored: BossManageStored,
  key: string,
): { partySize: number; shares: BossPartyShareColumns } {
  return { partySize: stored.partySizes[key] ?? 1, shares: stored.partyShares[key] ?? NO_PARTY_SHARES }
}

/**
 * 저장된 값과 다른 것만 남긴 초안. 저장 버튼과 저장 함수가 이것을 본다.
 *
 * 화면을 연 동안 받기가 저장된 값을 초안과 같게 바꾸면 그 항목은 바꾼 것이 아니다.
 */
export function changedBossManageDraft(draft: BossManageDraft, stored: BossManageStored): BossManageDraft {
  const tracking: BossManageDraft['tracking'] = {}
  for (const [bossKey, difficulty] of Object.entries(draft.tracking)) {
    if (difficulty !== undefined && difficulty !== trackedBossDifficulty(stored.items, bossKey)) {
      tracking[bossKey] = difficulty
    }
  }
  const party: BossManageDraft['party'] = {}
  for (const [key, setting] of Object.entries(draft.party)) {
    if (setting !== undefined && !samePartySetting(setting, storedPartySetting(stored, key))) party[key] = setting
  }
  return { tracking, party }
}

/** 초안에 든 것이 있는가. */
export function hasBossManageChanges(draft: BossManageDraft): boolean {
  return Object.keys(draft.tracking).length > 0 || Object.keys(draft.party).length > 0
}

/**
 * 저장한 항목을 뺀 초안.
 *
 * 저장하는 동안 다시 고친 항목은 남긴다. 저장한 값과 지금 초안의 값이 다르기 때문이다. 파티 설정은 `적용` 마다 새 객체라 같은 객체인지로 본다.
 */
export function withoutSavedBossManageDraft(
  draft: BossManageDraft,
  saved: { tracking: BossManageDraft['tracking']; party: BossManageDraft['party'] },
): BossManageDraft {
  const tracking = { ...draft.tracking }
  for (const [bossKey, difficulty] of Object.entries(saved.tracking)) {
    if (tracking[bossKey] === difficulty) delete tracking[bossKey]
  }
  const party = { ...draft.party }
  for (const [key, setting] of Object.entries(saved.party)) {
    if (party[key] === setting) delete party[key]
  }
  return { tracking, party }
}
