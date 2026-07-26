import accessoryBoxesData from '../data/accessory-boxes.json'
import bossRingBoxesData from '../data/boss-ring-boxes.json'
import itemDropTableData from '../data/item-drop-table.json'
import {
  SELECTABLE_DROP_CATEGORIES,
  type DropCandidate,
  type DropCategory,
  type FixedDropGroup,
} from '../types/drops'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../types/scheduler'

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

// BOSS_DIFFICULTIES 정규 순서 인덱스(미상 난이도는 뒤로).
function difficultyOrder(difficulty: string): number {
  const index = (BOSS_DIFFICULTIES as readonly string[]).indexOf(difficulty)
  return index === -1 ? BOSS_DIFFICULTIES.length : index
}

// 보스의 전 난이도 엔트리를 난이도 정규 순서로 반환한다.
function entriesForBoss(boss: string): RawRewardEntry[] {
  return rewardEntries
    .filter((entry) => nfc(entry.boss) === nfc(boss))
    .slice()
    .sort((a, b) => difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty))
}

// 보스의 선택 가능한 드롭 후보(장비·소비)를 난이도 무관하게 통합해 반환한다(ADR-040 결정 1).
// 같은 아이템은 name+slot으로 dedupe하고, 등장하는 난이도를 difficulties에 정규 순서로 담는다.
// 고정 드롭은 값이 난이도마다 달라 여기서 제외하고 getBossFixedDrops로 별도 표시한다.
export function getBossDropCandidates(boss: string): DropCandidate[] {
  const byKey = new Map<string, DropCandidate>()
  const order: string[] = []

  for (const entry of entriesForBoss(boss)) {
    const difficulty = entry.difficulty as BossDifficulty
    for (const category of SELECTABLE_DROP_CATEGORIES) {
      for (const item of entry.rewards[category] ?? []) {
        const key = `${category}|${nfc(item.name)}|${nfc(item.slot ?? '')}`
        const existing = byKey.get(key)
        if (existing === undefined) {
          byKey.set(key, {
            name: item.name,
            category,
            slot: item.slot,
            set: item.set,
            note: item.note,
            difficulties: [difficulty],
          })
          order.push(key)
        } else if (!existing.difficulties.includes(difficulty)) {
          existing.difficulties.push(difficulty)
        }
      }
    }
  }
  return order.map((key) => byKey.get(key) as DropCandidate)
}

// 보스의 고정 드롭을 난이도별 그룹(정규 순서)으로 반환한다(ADR-040 결정 3). 읽기 전용 표시용.
export function getBossFixedDrops(boss: string): FixedDropGroup[] {
  const groups: FixedDropGroup[] = []
  for (const entry of entriesForBoss(boss)) {
    const items = (entry.rewards.fixed ?? []).map((item) => ({
      name: item.name,
      amount: item.amount,
      slot: item.slot,
    }))
    if (items.length > 0) {
      groups.push({ difficulty: entry.difficulty as BossDifficulty, items })
    }
  }
  return groups
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

export interface RingOption {
  name: string
  iconFile: string | null
  hasLevel: boolean
}

export interface RingBoxContents {
  levels: number[]
  rings: RingOption[]
}

// '기타'(ADR-041): 백옥 반지 상자 목록 밖의 저가치 반지들을 한 칸으로 묶는 UI 전용 항목.
const OTHER_RING_NAME = '기타'
const OTHER_RING_ICON = 'Level_Jump_Ring.png' // 레벨퍼프 링 아이콘 재사용

// 명명 반지 기준(baseline) = 백옥 상자 반지 집합. 데이터에서 동적 산출(하드코딩·추정 없음, ADR-041/ADR-006).
const baselineRingNames = new Set(
  (
    ringBoxes.find((box) => nfc(box.name) === nfc('백옥의 보스 반지 상자'))?.itemProbabilities ?? []
  ).map((ring) => nfc(ring.name)),
)

// 연마석(생명의 연마석 등)은 반지가 아니라 등급(레벨) 개념이 없다.
function isWhetstone(name: string): boolean {
  return name.includes('연마석')
}

// 반지 상자의 등급 후보와 반지 후보. 백옥 목록을 기준으로 명명 반지만 개별 노출하고, 그 밖 반지는
// 단일 '기타'로 묶는다. 연마석은 별도(레벨 없음). 정렬: 명명 → 연마석 → 기타(ADR-041). 아니면 null.
export function getRingBoxContents(boxName: string): RingBoxContents | null {
  const box = ringBoxes.find((candidate) => nfc(candidate.name) === nfc(boxName))
  if (box === undefined) return null

  const named: RingOption[] = []
  const whetstones: RingOption[] = []
  let hasOther = false

  for (const entry of box.itemProbabilities) {
    if (isWhetstone(entry.name)) {
      whetstones.push({ name: entry.name, iconFile: entry.iconFile, hasLevel: false })
    } else if (baselineRingNames.has(nfc(entry.name))) {
      named.push({ name: entry.name, iconFile: entry.iconFile, hasLevel: true })
    } else {
      hasOther = true
    }
  }

  const rings: RingOption[] = [...named, ...whetstones]
  if (hasOther) {
    rings.push({ name: OTHER_RING_NAME, iconFile: OTHER_RING_ICON, hasLevel: true })
  }

  return {
    levels: box.levelProbabilities.map((entry) => entry.level),
    rings,
  }
}

// 칠흑 장신구 상자의 후보 장신구 목록(등급 없음). 장신구 상자가 아니면 null.
export function getAccessoryBoxContents(boxName: string): { name: string }[] | null {
  const box = accessoryBoxes.find((candidate) => nfc(candidate.name) === nfc(boxName))
  if (box === undefined) return null

  return box.itemProbabilities.map((entry) => ({ name: entry.name }))
}
