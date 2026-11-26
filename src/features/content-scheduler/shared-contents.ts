/**
 * 컨텐츠 스케줄러 공유 탭의 판정. 공유 범위가 캐릭터가 아닌 컨텐츠(몬스터파크 · 에픽 던전 · 메이플 유니온)를 메이플 ID 마다 하나씩
 * 모은다.
 *
 * 진행을 월드나 메이플 ID 가 함께 쓰므로 캐릭터마다 세면 같은 일이 캐릭터 수만큼 부푼다. 메이플 ID 로 묶는 것은 에픽 던전 주간
 * 한도가 메이플 ID 마다 따로라서다. 월드로는 묶지 않는다. 넥슨이 월드 공유 항목을 마지막으로 접속한 월드 기준으로 준다.
 */
import { compareByName } from '../../lib/character-order'
import { mapleIdNameOf } from '../../lib/maple-id-name'
import { categorizeContentEntries } from '../../lib/scheduler/content-category'
import { contentSectionOf, type ContentEntry } from '../../lib/scheduler/contents'
import { mergeManualContentList } from '../../lib/scheduler/manual-content-merge'
import { getShareScope, sharedCategoryOrder } from '../../lib/scheduler/scheduler-content-scope'
import { contentTemplate, effectiveTemplateEntries } from '../../lib/scheduler/scheduler-content-template'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { DailyContent, WeeklyContent } from '../../types'
import type { ContentSection } from '../../types/game-data'
import type { MapleIdOwners } from '../maple-id/owners'
import { weeklyLimitClosedKeys } from './content-completion'
import type { ContentCharacterView } from './views'

/** 공유 탭 레일의 칸 하나. */
export interface SharedMapleIdEntry {
  mapleId: string
  /** 별칭. 바꾼 이름이 없으면 기본 이름이다 */
  name: string
  /** 칸의 얼굴. 그 메이플 ID 의 추적 캐릭터 가운데 레벨이 가장 높은 캐릭터다 */
  representative: ContentCharacterView
}

/**
 * 공유 탭 레일의 칸. 추적 캐릭터가 있는 메이플 ID 만 메이플 ID 차례로 선다. 소속을 모르는 캐릭터는 어느 칸에도 들지 않는다.
 *
 * 대표는 `pickRepresentativeCharacter` 와 같은 차례(레벨이 높은 순, 같으면 이름 순)의 첫째다. 얼굴 그림은 추적 캐릭터만 스케줄
 * 캐시에 있어서 추적 캐릭터 가운데에서 고른다.
 */
export function sharedMapleIdsOf(
  characters: readonly ContentCharacterView[],
  mapleIds: MapleIdOwners | null,
  names: Readonly<Record<string, string>> | undefined,
): SharedMapleIdEntry[] {
  if (mapleIds === null) return []
  return mapleIds.order.flatMap((mapleId) => {
    const members = characters.filter((character) => mapleIds.ofOcid[character.ocid] === mapleId)
    if (members.length === 0) return []
    const [representative] = [...members].sort(
      (a, b) => (b.level ?? 0) - (a.level ?? 0) || compareByName(a.characterName, b.characterName),
    )
    return [{ mapleId, name: mapleIdNameOf(mapleId, names), representative }]
  })
}

/**
 * 공유 탭이 보여 줄 메이플 ID. 고른 값이 레일에 있으면 그것이고, 없으면 지금 고른 캐릭터의 메이플 ID, 그것도 없으면 첫 칸이다.
 *
 * @param selectedOcid 지금 고른 캐릭터. 처음 여는 공유 탭이 보던 캐릭터의 메이플 ID 로 열리게 한다
 */
export function resolveSelectedMapleId(
  selectedMapleId: string | null,
  entries: readonly SharedMapleIdEntry[],
  selectedOcid: string | null,
  mapleIds: MapleIdOwners | null,
): string | null {
  const has = (mapleId: string | null | undefined): mapleId is string =>
    mapleId != null && entries.some((entry) => entry.mapleId === mapleId)
  if (has(selectedMapleId)) return selectedMapleId
  const ofSelected = selectedOcid === null ? undefined : mapleIds?.ofOcid[selectedOcid]
  if (has(ofSelected)) return ofSelected
  return entries[0]?.mapleId ?? null
}

/** 그 메이플 ID 의 추적 캐릭터 ocid. 저장과 관리 화면의 켜짐이 이 캐릭터들을 본다. */
export function ocidsOfMapleId(characters: readonly ContentCharacterView[], ofOcid: Readonly<Record<string, string>>, mapleId: string): string[] {
  return characters.filter((character) => ofOcid[character.ocid] === mapleId).map((character) => character.ocid)
}

/** 공유 범위가 캐릭터가 아닌 템플릿 줄. 공유 분류 차례로 묶은 뒤 편 순서다. 관리 화면의 공유 탭과 공유 탭의 차례가 이것이다. */
export function sharedTemplate(): ContentEntry[] {
  const template = contentTemplate()
  const entries = [...template.daily, ...template.weekly].filter((entry) => getShareScope(entry.key) !== 'character')
  return categorizeContentEntries(entries, sharedCategoryOrder()).flatMap((group) => group.items.map((item) => item.entry))
}

/** 공유 탭이 그리는 목록 하나. 한도는 그 메이플 ID 의 캐릭터 목록 전체로 센 마감 key 다. */
export interface SharedContents {
  daily: DailyContent[]
  weekly: WeeklyContent[]
  closedKeys: ReadonlySet<string>
}

export interface SharedContentsInput {
  /** 추적 캐릭터 */
  characters: readonly ContentCharacterView[]
  /** ocid → 메이플 ID. 소속을 모르는 캐릭터는 빠져 있다 */
  ofOcid: Readonly<Record<string, string>>
  manualTrackedByOcid: Readonly<Record<string, ManualTrackedItem[]>>
}

/**
 * 같은 공유 컨텐츠 여러 벌을 가장 앞선 값 하나로 합친 것. 주기 안에서 진행은 줄지 않아서 가장 큰 값이 가장 최근 값이다.
 * 동기화 시각이 다른 캐릭터가 낮은 값을 들고 있을 수 있다. today 공유 위젯과 공유 탭이 같은 값을 그리게 하는 한 곳이다.
 *
 * @param matches 비어 있지 않은 목록
 */
export function mergeSharedProgress<T extends DailyContent | WeeklyContent>(matches: readonly T[]): T {
  // 퀘스트 상태는 0 → 1 → 2 로만 간다. 상태가 없는(`null`) 벌은 가장 뒤로 본다.
  const states = matches.flatMap((item) => (item.questState === null ? [] : [item.questState]))
  const questState = states.length === 0 ? null : (Math.max(...states) as 0 | 1 | 2)
  return {
    ...matches[0],
    isRegistered: matches.some((item) => item.isRegistered),
    nowCount: Math.max(...matches.map((item) => item.nowCount)),
    maxCount: Math.max(...matches.map((item) => item.maxCount)),
    questState,
  }
}

/**
 * 그 메이플 ID 의 공유 컨텐츠. 자동은 캐릭터 가운데 하나라도 게임에 등록한 항목, 수동은 하나라도 추적 목록에 넣은 항목이다.
 * 시작 기간 전인 줄은 두 모드 모두 그리지 않는다.
 *
 * @param weeklyPeriodKey 지금 주간 기간 키
 */
export function sharedContentsOf(
  input: SharedContentsInput,
  mapleId: string,
  mode: TrackingMode,
  weeklyPeriodKey: string,
): SharedContents {
  const members = input.characters.filter((character) => input.ofOcid[character.ocid] === mapleId)
  const template = effectiveTemplateEntries(sharedTemplate(), weeklyPeriodKey)
  const tracked = new Set(
    members.flatMap((character) =>
      (input.manualTrackedByOcid[character.ocid] ?? []).flatMap((item) => (item.kind === 'boss' ? [] : [`${item.kind}:${item.contentKey}`])),
    ),
  )

  function listOf<T extends DailyContent | WeeklyContent>(section: ContentSection, of: (character: ContentCharacterView) => T[]): T[] {
    const all = members.flatMap(of)
    const entries = template.filter((entry) => contentSectionOf(entry.key) === section)
    return entries.flatMap((entry): T[] => {
      const matches = all.filter((item) => item.contentKey === entry.key)
      if (mode === 'manual') {
        if (!tracked.has(`${section}:${entry.key}`)) return []
        // 응답에 없는 항목은 템플릿 기본값으로 채운다. 수동 모드의 일일 · 주간 목록과 같은 규칙이다.
        if (matches.length === 0) return mergeManualContentList([{ contentKey: entry.key, kind: section }], [], [entry]) as T[]
        return [{ ...mergeSharedProgress(matches), isRegistered: true }]
      }
      return matches.some((item) => item.isRegistered) ? [mergeSharedProgress(matches)] : []
    })
  }

  return {
    daily: listOf('daily', (character) => character.dailyContents),
    weekly: listOf('weekly', (character) => character.weeklyContents),
    // 한도는 표시 목록이 아니라 그 메이플 ID 의 캐릭터 목록 전체로 센다. 등록 안 한 던전의 완료도 한도를 채운다.
    closedKeys: weeklyLimitClosedKeys(members.flatMap((character) => character.weeklyContents)),
  }
}
