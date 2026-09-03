/**
 * 메이플 ID 목록과, 그중 열어 본 계정의 후보 목록. 이 화면의 네트워크가 전부 여기 있다.
 *
 * 계정과 후보를 한 훅에 두는 것은 **`openAccountRef` 를 함께 보기 때문**이다. 계정을 고르는 것이
 * 곧 그 계정의 회차를 여는 일이고, 늦게 온 회차를 버릴 기준도 그 ref 다. 가르면 같은 ref 가 두 곳에
 * 생기고, 둘이 어긋나는 순간 직전 계정의 실패가 새 계정 자리에 남는다.
 *
 * 지키는 것 셋.
 *
 * ① 계정 전환 TTL 은 **성공에만 도장을 찍는다**(`settledAt`). 실패를 캐싱하면 5분 동안 같은 실패
 *    화면에 갇힌다. `retryRoster` 는 TTL 을 무시한다.
 * ② TTL 의 수명은 이 훅이다. 영속화하면 `character/list` 를 캐싱하지 않는다는 저장소 규칙을 화면
 *    층에서 뒤집는 것이 된다.
 * ③ 회차를 effect 가 아니라 **사건**이 연다. effect 로 걸면 로딩 표시가 한 프레임 늦어 항목 0건 +
 *    로딩 아님, 즉 `모두 조회할 수 없어요` 화면이 한 장 스친다.
 *
 * @example
 * const roster = useAccountRosters()
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  sortAccountSummaries,
  summarizeAccount,
  type AccountSummaryView,
} from '../features/character-manage/derivations'
import { CHARACTER_BASIC_TTL_MS } from '../features/schedule-sync/character-basic-fetch'
import {
  getCharacterPickerRoster,
  toScheduleSyncError,
  type ScheduleSyncError,
} from '../features/schedule-sync/schedule-sync'
import { fetchCharacterList } from '../nexon/character'
import { getAuthConfig } from '../storage/api-key'
import type { CharacterPickerEntry } from '../types'

/** 계정 하나의 후보 목록 + **성공 도장**. 도장이 없으면 TTL 판정에서 아직 이다. */
interface AccountRoster {
  entries: CharacterPickerEntry[]
  settledAt: number | null
}

export interface AccountRosters {
  accounts: AccountSummaryView[]
  selectedAccountId: string | null
  isAccountsLoading: boolean
  accountsError: ScheduleSyncError | null

  /** 열어 본 계정 전부의 후보. 캐시가 모르는 얼굴을 여기서 채운다. */
  loadedEntries: CharacterPickerEntry[]
  /** 지금 계정에서 **고를 수 있는** 후보. 조회 불가는 빠져 있다. */
  selectable: CharacterPickerEntry[]
  isRosterLoading: boolean
  rosterError: ScheduleSyncError | null

  selectAccount: (accountId: string) => void
  retryAccounts: () => void
  retryRoster: () => void
}

export function useAccountRosters(): AccountRosters {
  const [accounts, setAccounts] = useState<AccountSummaryView[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isAccountsLoading, setIsAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<ScheduleSyncError | null>(null)
  const [accountsNonce, setAccountsNonce] = useState(0)

  const [rosters, setRosters] = useState<Record<string, AccountRoster>>({})
  const [isRosterLoading, setIsRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)

  // TTL 판정은 **지금 들고 있는 것** 을 봐야 하는데 그 읽기가 렌더 밖(사건 핸들러·비동기)에서
  // 일어난다. **쓰기도 전부 그 자리에서만** 하므로 렌더 중에 ref 를 만지지 않는다.
  const rostersRef = useRef<Record<string, AccountRoster>>({})
  /** 지금 열려 있는 계정. 늦게 도착한 회차의 결과를 버릴 기준이다. */
  const openAccountRef = useRef<string | null>(null)

  function commitRosters(next: Record<string, AccountRoster>): void {
    rostersRef.current = next
    setRosters(next)
  }

  /**
   * 한 계정의 후보 회차. **TTL 안이면 아무것도 시작하지 않는다**. 그때 로딩 아님·실패 아님 을
   * 함께 확정해야 직전 계정의 실패가 이 계정 자리에 남지 않는다.
   */
  const loadRoster = useCallback((accountId: string, options?: { force?: boolean }): void => {
    const known = rostersRef.current[accountId]
    const isFresh =
      known !== undefined &&
      known.settledAt !== null &&
      Date.now() - known.settledAt < CHARACTER_BASIC_TTL_MS
    if (options?.force !== true && isFresh) {
      setIsRosterLoading(false)
      setRosterError(null)
      return
    }

    setIsRosterLoading(true)
    setRosterError(null)
    getCharacterPickerRoster(
      (entries) => {
        // 늦게 온 회차라도 **자기 계정 칸에는 쓴다**. 버리면 그 계정을 다시 열 때 빈 채로 뜬다.
        const previous = rostersRef.current[accountId]
        commitRosters({
          ...rostersRef.current,
          [accountId]: { entries, settledAt: previous?.settledAt ?? null },
        })
      },
      { accountId },
    )
      .then(() => {
        const previous = rostersRef.current[accountId]
        commitRosters({
          ...rostersRef.current,
          [accountId]: { entries: previous?.entries ?? [], settledAt: Date.now() },
        })
        if (openAccountRef.current === accountId) setIsRosterLoading(false)
      })
      .catch((error: unknown) => {
        if (openAccountRef.current !== accountId) return
        setRosterError(toScheduleSyncError(error))
        setIsRosterLoading(false)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const authConfig = await getAuthConfig()
        if (authConfig === null) {
          throw new Error('useAccountRosters: API 키가 없습니다')
        }
        const list = await fetchCharacterList(authConfig.apiKey)
        if (cancelled) return
        // 캐릭터 0명 계정은 `normalizeCharacterList` 가 이미 걸렀고,
        // `summarizeAccount` 의 `null` 은 그 규칙이 뚫렸을 때의 안전망이다. 렌더 중에 던지지 않는다.
        // 차례는 **대표 레벨이 높은 계정이 먼저** 다(`sortAccountSummaries`). 그래서 아래 `[0]` 이
        // 고르는 첫 계정도 주력 ID 가 된다.
        const summaries = sortAccountSummaries(
          list
            .map(summarizeAccount)
            .filter((summary): summary is AccountSummaryView => summary !== null),
        )
        const open = openAccountRef.current
        const next =
          open !== null && summaries.some((summary) => summary.accountId === open)
            ? open
            : (summaries[0]?.accountId ?? null)
        setAccounts(summaries)
        setSelectedAccountId(next)
        openAccountRef.current = next
        setIsAccountsLoading(false)
        if (next !== null) loadRoster(next)
      } catch (error: unknown) {
        if (cancelled) return
        setAccountsError(toScheduleSyncError(error))
        setIsAccountsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accountsNonce, loadRoster])

  const loadedEntries = useMemo(
    () => Object.values(rosters).flatMap((roster) => roster.entries),
    [rosters],
  )

  // 조회 불가는 아래 층에 서지 않는다. 고를 수 없는 것을 고르라고 두지 않는다. 그래서 빼면
  // 어디에도 안 선다 가 필터 하나로 성립한다.
  const selectable = useMemo(() => {
    const roster = selectedAccountId === null ? undefined : rosters[selectedAccountId]
    return (roster?.entries ?? []).filter((entry) => entry.unavailable !== true)
  }, [rosters, selectedAccountId])

  const selectAccount = useCallback(
    (accountId: string): void => {
      openAccountRef.current = accountId
      setSelectedAccountId(accountId)
      loadRoster(accountId)
    },
    [loadRoster],
  )

  const retryAccounts = useCallback((): void => {
    setIsAccountsLoading(true)
    setAccountsError(null)
    setAccountsNonce((nonce) => nonce + 1)
  }, [])

  const retryRoster = useCallback((): void => {
    const accountId = openAccountRef.current
    if (accountId === null) return
    loadRoster(accountId, { force: true })
  }, [loadRoster])

  return {
    accounts,
    selectedAccountId,
    isAccountsLoading,
    accountsError,
    loadedEntries,
    selectable,
    isRosterLoading,
    rosterError,
    selectAccount,
    retryAccounts,
    retryRoster,
  }
}
