import accessoryBoxesData from '../data/accessory-boxes.json'
import bossRingBoxesData from '../data/boss-ring-boxes.json'
import itemDropTableData from '../data/item-drop-table.json'
import { DROP_CATEGORIES, type DropCandidate, type DropCategory } from '../types/drops'

// item-drop-table.json / boss-ring-boxes.json / accessory-boxes.json 조회 헬퍼(ADR-038). 게임
// 수치 데이터는 여기서 읽기만 하고 추정하지 않는다([[ADR-006]]).

interface RawRewardItem {
  name: string
  amount?: string
  slot?: string
  set?: string
  note?: string
}
interface RawRewardEntry {
  boss: string
  difficulty: string
  rewards: Partial<Record<DropCategory, RawRewardItem[]>>
}

const rewardEntries = itemDropTableData.rewards as RawRewardEntry[]

function nfc(value: string): string {
  return value.normalize('NFC')
}

// 보스+난이도의 드롭 후보를 고정→장비→소비 순서로 평탄화해 반환한다(ADR-038 결정 1).
export function getBossDropCandidates(boss: string, difficulty: string): DropCandidate[] {
  const entry = rewardEntries.find(
    (candidate) => nfc(candidate.boss) === nfc(boss) && nfc(candidate.difficulty) === nfc(difficulty),
  )
  if (entry === undefined) return []

  const candidates: DropCandidate[] = []
  for (const category of DROP_CATEGORIES) {
    for (const item of entry.rewards[category] ?? []) {
      candidates.push({
        name: item.name,
        category,
        amount: item.amount,
        slot: item.slot,
        set: item.set,
        note: item.note,
      })
    }
  }
  return candidates
}

interface RawRingBox {
  name: string
  levelProbabilities: { level: number }[]
  itemProbabilities: { name: string; iconFile: string | null }[]
}
const ringBoxes = bossRingBoxesData.boxes as RawRingBox[]

interface RawAccessoryBox {
  name: string
  itemProbabilities: { name: string }[]
}
const accessoryBoxes = accessoryBoxesData.boxes as RawAccessoryBox[]

const ringBoxNames = new Set(ringBoxes.map((box) => nfc(box.name)))
const accessoryBoxNames = new Set(accessoryBoxes.map((box) => nfc(box.name)))

// 개봉 결과를 직접 선택해야 하는 랜덤 상자인지(반지 상자 또는 칠흑 장신구 상자).
export function isBoxItem(name: string): boolean {
  const key = nfc(name)
  return ringBoxNames.has(key) || accessoryBoxNames.has(key)
}

export interface RingBoxContents {
  levels: number[]
  rings: { name: string; iconFile: string | null }[]
}

// 반지 상자의 등급 후보와 반지 후보(상자마다 다름). 반지 상자가 아니면 null.
export function getRingBoxContents(boxName: string): RingBoxContents | null {
  const box = ringBoxes.find((candidate) => nfc(candidate.name) === nfc(boxName))
  if (box === undefined) return null

  return {
    levels: box.levelProbabilities.map((entry) => entry.level),
    rings: box.itemProbabilities.map((entry) => ({ name: entry.name, iconFile: entry.iconFile })),
  }
}

// 칠흑 장신구 상자의 후보 장신구 목록(등급 없음). 장신구 상자가 아니면 null.
export function getAccessoryBoxContents(boxName: string): { name: string }[] | null {
  const box = accessoryBoxes.find((candidate) => nfc(candidate.name) === nfc(boxName))
  if (box === undefined) return null

  return box.itemProbabilities.map((entry) => ({ name: entry.name }))
}
