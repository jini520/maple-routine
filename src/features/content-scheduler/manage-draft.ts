/**
 * 컨텐츠 관리 화면의 초안. 저장하기 전에 켜고 끈 컨텐츠를 일일 · 주간마다, 공유 탭은 메이플 ID 하나에 든다.
 *
 * 화면은 저장된 값에 초안을 얹어 그리고, 저장 함수는 저장소의 지금 배열에 같은 함수로 초안을 얹어 쓴다. 두 곳이 같은 함수를 써야
 * 화면에 보인 목록이 그대로 저장된다.
 */
import { contentSectionOf } from '../../lib/scheduler/contents'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'

/** 일일 · 주간마다 컨텐츠 key 의 추적 여부. */
export type ContentManageDraft = Record<'daily' | 'weekly', Partial<Record<string, boolean>>>

export const EMPTY_CONTENT_MANAGE_DRAFT: ContentManageDraft = { daily: {}, weekly: {} }

const KINDS = ['daily', 'weekly'] as const

/** 저장된 목록에서 그 컨텐츠를 추적하나. */
export function isContentTracked(items: readonly ManualTrackedItem[], kind: 'daily' | 'weekly', contentKey: string): boolean {
  return items.some((item) => item.kind === kind && item.contentKey === contentKey)
}

/** 저장된 추적 목록에 초안을 얹은 목록. 끈 항목은 빠지고, 켠 항목은 끝에 붙는다. 보스 항목은 그대로다. */
export function applyContentManageDraft(items: readonly ManualTrackedItem[], draft: ContentManageDraft): ManualTrackedItem[] {
  const next = items.filter((item) => item.kind === 'boss' || draft[item.kind][item.contentKey] !== false)
  for (const kind of KINDS) {
    for (const [contentKey, tracked] of Object.entries(draft[kind])) {
      if (tracked === true && !isContentTracked(next, kind, contentKey)) next.push({ contentKey, kind })
    }
  }
  return next
}

/**
 * 저장된 값과 다른 것만 남긴 초안. 저장 버튼과 저장 함수가 이것을 본다.
 *
 * 화면을 연 동안 받기가 저장된 값을 초안과 같게 바꾸면 그 항목은 바꾼 것이 아니다.
 */
export function changedContentManageDraft(draft: ContentManageDraft, items: readonly ManualTrackedItem[]): ContentManageDraft {
  const changed: ContentManageDraft = { daily: {}, weekly: {} }
  for (const kind of KINDS) {
    for (const [contentKey, tracked] of Object.entries(draft[kind])) {
      if (tracked !== undefined && tracked !== isContentTracked(items, kind, contentKey)) changed[kind][contentKey] = tracked
    }
  }
  return changed
}

/** 초안에 든 것이 있는가. */
export function hasContentManageChanges(draft: ContentManageDraft): boolean {
  return KINDS.some((kind) => Object.keys(draft[kind]).length > 0)
}

/** 저장한 항목을 뺀 초안. 저장하는 동안 다시 고친 항목은 값이 달라 남는다. */
export function withoutSavedContentManageDraft(draft: ContentManageDraft, saved: ContentManageDraft): ContentManageDraft {
  const next: ContentManageDraft = { daily: { ...draft.daily }, weekly: { ...draft.weekly } }
  for (const kind of KINDS) {
    for (const [contentKey, tracked] of Object.entries(saved[kind])) {
      if (next[kind][contentKey] === tracked) delete next[kind][contentKey]
    }
  }
  return next
}

/** 공유 탭의 초안. 컨텐츠 key 의 추적 여부이고, 종류(`daily` · `weekly`)는 컨텐츠의 주기에서 정한다. */
export type SharedManageDraft = Partial<Record<string, boolean>>

/**
 * 공유 탭의 행이 켜져 있나. 그 메이플 ID 의 추적 캐릭터 가운데 하나라도 추적하면 켜져 있다. 공유 탭이 항목을 보이는 기준과 같다.
 *
 * @param lists 그 메이플 ID 의 추적 캐릭터마다의 저장된 목록
 */
export function isSharedContentTracked(lists: readonly (readonly ManualTrackedItem[])[], contentKey: string): boolean {
  return lists.some((items) => items.some((item) => item.kind !== 'boss' && item.contentKey === contentKey))
}

/**
 * 캐릭터 한 명의 저장된 목록에 공유 탭 초안을 얹은 목록. 켠 항목은 컨텐츠의 주기로 끝에 붙고, 끈 항목은 빠진다.
 *
 * 저장은 이것을 그 메이플 ID 의 추적 캐릭터 모두에 적는다. 한 명에게만 남아 있으면 끈 항목이 공유 탭에 계속 보인다.
 */
export function applySharedManageDraft(items: readonly ManualTrackedItem[], draft: SharedManageDraft): ManualTrackedItem[] {
  const next = items.filter((item) => item.kind === 'boss' || draft[item.contentKey] !== false)
  for (const [contentKey, tracked] of Object.entries(draft)) {
    const kind = contentSectionOf(contentKey)
    if (tracked === true && kind !== null && !isContentTracked(next, kind, contentKey)) next.push({ contentKey, kind })
  }
  return next
}

/** 저장된 값(`하나라도` 기준)과 다른 것만 남긴 공유 탭 초안. */
export function changedSharedManageDraft(
  draft: SharedManageDraft,
  lists: readonly (readonly ManualTrackedItem[])[],
): SharedManageDraft {
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([contentKey, tracked]) => tracked !== undefined && tracked !== isSharedContentTracked(lists, contentKey),
    ),
  )
}
