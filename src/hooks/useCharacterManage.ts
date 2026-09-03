/**
 * 캐릭터 관리 화면의 상태 한 벌. 설정 하위 페이지와 온보딩 단계가 함께 쓰는 훅.
 *
 * 이 파일은 **조립만** 한다. 일은 셋으로 갈려 있다.
 *
 * - `useAccountRosters` · 메이플 ID 목록과 열어 본 계정의 후보. 네트워크가 전부 그쪽에 있다
 * - `useSelectionDraft` · 저장 전의 목록 순서와 대표
 * - `useKnownProfiles` · 이름·레벨·얼굴 표. 캐시와 이미 받은 후보에서 모은다
 *
 * 여기 남는 것은 **둘 이상에서 나오는 값**이다. 선택된 것과 프로필이 만나 `selectedViews` 가 되고,
 * 후보와 선택된 것이 만나 `candidates` 가 된다.
 *
 * 값 규칙은 `features/character-manage/derivations` 의 순수 함수가 갖는다. 여기서 다시 계산하면
 * 그 규칙을 테스트가 직접 못 문다.
 */
import { useMemo } from 'react'

import {
  buildSelectedCharacterViews,
  type AccountSummaryView,
  type SelectedCharacterView,
} from '../features/character-manage/derivations'
import { useContentSchedulerStore } from '../features/content-scheduler/store'
import type { ScheduleSyncError } from '../features/schedule-sync/schedule-sync'
import type { CharacterPickerEntry } from '../types'

import { useAccountRosters } from './useAccountRosters'
import { useKnownProfiles } from './useKnownProfiles'
import { useSelectionDraft } from './useSelectionDraft'

export interface CharacterManageController {
  // 아래 층의 머리
  accounts: AccountSummaryView[]
  portraitByAccountId: Record<string, string | null>
  selectedAccountId: string | null
  isAccountsLoading: boolean
  accountsError: ScheduleSyncError | null

  // 위 층
  selectedOcids: string[]
  selectedViews: SelectedCharacterView[]
  representativeOcid: string | null

  // 아래 층
  /** 이 계정에서 아직 안 고른 후보. 고른 것은 위로 옮겨간다. */
  candidates: CharacterPickerEntry[]
  /** 이 계정에서 고를 수 있는 캐릭터 수. {전체}개 중 {표시}개 표시 의 앞자리. */
  selectableCount: number
  isRosterLoading: boolean
  rosterError: ScheduleSyncError | null

  /** 저장 활성 조건. 집합 ∪ 순서 ∪ 대표 중 하나라도 다르면 참. */
  isDirty: boolean

  selectAccount: (accountId: string) => void
  addCharacter: (ocid: string) => void
  removeCharacter: (ocid: string) => void
  /** 끌어 놓았을 때·접근성 액션일 때. 둘 다 `moveOcid` 하나를 통과한다. */
  moveCharacter: (fromIndex: number, toIndex: number) => void
  setRepresentative: (ocid: string) => void
  retryAccounts: () => void
  retryRoster: () => void
}

export function useCharacterManage(): CharacterManageController {
  // 추적 목록의 진실은 컨텐츠 스케줄러 스토어 하나다(사본을 만들지 않는다).
  const { trackedOcids } = useContentSchedulerStore()
  const draft = useSelectionDraft(trackedOcids)
  const roster = useAccountRosters()

  // 표에 있어야 하는 것은 위 층이 그리는 캐릭터와 드롭다운 행의 얼굴 둘이다. 얼굴 하나 때문에
  // 프로브를 돌리지는 않는다.
  const needed = useMemo(
    () => [
      ...draft.selectedOcids,
      ...roster.accounts.map((account) => account.representative.ocid),
    ],
    [draft.selectedOcids, roster.accounts],
  )
  const { knownProfiles, unavailableOcids } = useKnownProfiles({
    ocids: needed,
    fallbackEntries: roster.loadedEntries,
  })

  const selectedViews = useMemo(
    () => buildSelectedCharacterViews(draft.selectedOcids, knownProfiles, unavailableOcids),
    [draft.selectedOcids, knownProfiles, unavailableOcids],
  )

  const candidates = useMemo(() => {
    const chosen = new Set(draft.selectedOcids)
    return roster.selectable.filter((entry) => !chosen.has(entry.ocid))
  }, [roster.selectable, draft.selectedOcids])

  const portraitByAccountId = useMemo(
    () =>
      Object.fromEntries(
        roster.accounts.map((account) => [
          account.accountId,
          knownProfiles.get(account.representative.ocid)?.imageUrl ?? null,
        ]),
      ),
    [roster.accounts, knownProfiles],
  )

  return {
    accounts: roster.accounts,
    portraitByAccountId,
    selectedAccountId: roster.selectedAccountId,
    isAccountsLoading: roster.isAccountsLoading,
    accountsError: roster.accountsError,
    selectedOcids: draft.selectedOcids,
    selectedViews,
    representativeOcid: draft.representativeOcid,
    candidates,
    selectableCount: roster.selectable.length,
    isRosterLoading: roster.isRosterLoading,
    rosterError: roster.rosterError,
    isDirty: draft.isDirty,
    selectAccount: roster.selectAccount,
    addCharacter: draft.addCharacter,
    removeCharacter: draft.removeCharacter,
    moveCharacter: draft.moveCharacter,
    setRepresentative: draft.setRepresentative,
    retryAccounts: roster.retryAccounts,
    retryRoster: roster.retryRoster,
  }
}
