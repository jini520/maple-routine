/**
 * 캐릭터 관리 화면의 상태 한 벌. 설정 하위 페이지와 온보딩 단계가 함께 쓰는 훅.
 *
 * 값 규칙은 `features/character-manage/derivations` 의 순수 함수가 갖는다. 여기서 다시 계산하면
 * 그 규칙을 테스트가 직접 못 문다.
 *
 * 지키는 것 셋.
 *
 * ① 계정 전환 TTL 은 **성공에만 도장을 찍는다**(`settledAt`). 실패를 캐싱하면 5분 동안 같은 실패
 *    화면에 갇힌다. `다시 시도` 는 TTL 을 무시한다.
 * ② TTL 의 수명은 이 훅이다. 영속화하면 `character/list` 를 캐싱하지 않는다는 저장소 규칙을 화면
 *    층에서 뒤집는 것이 된다.
 * ③ 회차를 effect 가 아니라 **사건**이 연다. effect 로 걸면 로딩 표시가 한 프레임 늦어 항목 0건 +
 *    로딩 아님, 즉 `모두 조회할 수 없어요` 화면이 한 장 스친다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildSelectedCharacterViews,
  resolveRepresentative,
  sortAccountSummaries,
  summarizeAccount,
  type AccountSummaryView,
  type KnownCharacterProfile,
  type SelectedCharacterView,
} from '../../../features/character-manage/derivations'
import { useContentSchedulerStore } from '../../../features/content-scheduler/store'
import { CHARACTER_BASIC_TTL_MS } from '../../../features/schedule-sync/character-basic-fetch'
import {
  getCharacterPickerRoster,
  toScheduleSyncError,
  type ScheduleSyncError,
} from '../../../features/schedule-sync/schedule-sync'
import { fetchCharacterList } from '../../../nexon/character'
import { getAuthConfig } from '../../../storage/api-key'
import {
  getCachedCharacterBasic,
  type CachedCharacterBasicEntry,
} from '../../../storage/character-basic-cache'
import { getRepresentativeCharacter } from '../../../storage/character-selection'
import { getScheduleProbeLedger } from '../../../storage/schedule-probe-ledger'
import type { CharacterPickerEntry } from '../../../types'

import { moveOcid } from './reorder'

/** 계정 하나의 후보 목록 + **성공 도장**. 도장이 없으면 TTL 판정에서 아직 이다. */
interface AccountRoster {
  entries: CharacterPickerEntry[]
  settledAt: number | null
}

export interface CharacterManageController {
  // ── 아래 층의 머리 ──
  accounts: AccountSummaryView[]
  portraitByAccountId: Record<string, string | null>
  selectedAccountId: string | null
  isAccountsLoading: boolean
  accountsError: ScheduleSyncError | null

  // ── 위 층 ──
  selectedOcids: string[]
  selectedViews: SelectedCharacterView[]
  representativeOcid: string | null

  // ── 아래 층 ──
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

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function useCharacterManage(): CharacterManageController {
  // 추적 목록의 진실은 컨텐츠 스케줄러 스토어 하나다(사본을 만들지 않는다).
  const { trackedOcids } = useContentSchedulerStore()

  const [accounts, setAccounts] = useState<AccountSummaryView[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isAccountsLoading, setIsAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<ScheduleSyncError | null>(null)
  const [accountsNonce, setAccountsNonce] = useState(0)

  const [rosters, setRosters] = useState<Record<string, AccountRoster>>({})
  const [isRosterLoading, setIsRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)

  // 편집하기 전에는 저장된 목록이 그대로 보인다(`null` = 아직 손대지 않았다). 늦게 도착하는
  // `trackedOcids` 를 effect 로 심으면 그 setState 가 effect 본문에 직접 앉는다. 파생이 답이다.
  const [editedOcids, setEditedOcids] = useState<string[] | null>(null)
  // 같은 이유로 **아직 안 골랐다**(`undefined`)와 **없음으로 골랐다**(`null`)를 값으로 가른다.
  const [pickedRepresentative, setPickedRepresentative] = useState<string | null | undefined>(undefined)
  const [storedRepresentative, setStoredRepresentative] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<Map<string, CachedCharacterBasicEntry | null>>(new Map())
  const [unavailableOcids, setUnavailableOcids] = useState<ReadonlySet<string>>(new Set())

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

  // ── 저장된 대표 ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    getRepresentativeCharacter()
      .then((ocid) => {
        if (!cancelled) setStoredRepresentative(ocid)
      })
      .catch(() => {
        // 대표는 표식뿐이라 못 읽어도 화면이 성립한다. 아무 별도 안 채워진다.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── 계정 목록 ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const authConfig = await getAuthConfig()
        if (authConfig === null) {
          throw new Error('useCharacterManage: API 키가 없습니다')
        }
        const list = await fetchCharacterList(authConfig.apiKey)
        if (cancelled) return
        // 캐릭터 0명 계정은 `normalizeCharacterList` 가 이미 걸렀고,
        // `summarizeAccount` 의 `null` 은 그 규칙이 뚫렸을 때의 안전망이다. 렌더 중에 던지지 않는다.
        // 차례는 **대표 레벨이 높은 계정이 먼저** 다(`sortAccountSummaries`). 그래서 아래 `[0]` 이
        // 고르는 첫 계정도 주력 ID 가 된다.
        const summaries = sortAccountSummaries(
          list.map(summarizeAccount).filter((summary): summary is AccountSummaryView => summary !== null),
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

  // `선택됨` 층은 네트워크 없이 그린다. 드롭다운 행의 얼굴도 캐시에 있을 때만 쓰므로 같은
  // 자리에서 함께 읽는다. 얼굴 하나 때문에 프로브를 돌리지 않는다.
  //
  // `useMemo` 인 것은 값이 비싸서가 아니라 아래 두 `useMemo` 의 deps 가 매 렌더 갈리지 않게
  // 하기 위해서다(`??` 는 같은 내용이라도 새 배열을 만든다).
  const selectedOcids = useMemo(() => editedOcids ?? trackedOcids ?? [], [editedOcids, trackedOcids])
  const neededKey = [
    ...new Set([...selectedOcids, ...accounts.map((account) => account.representative.ocid)]),
  ].join(',')

  useEffect(() => {
    const needed = neededKey === '' ? [] : neededKey.split(',')
    const missing = needed.filter((ocid) => !profiles.has(ocid))
    if (missing.length === 0) return

    let cancelled = false
    const now = new Date()
    void (async () => {
      const loaded = await Promise.all(
        missing.map(async (ocid) => ({
          ocid,
          entry: await getCachedCharacterBasic(ocid).catch(() => null),
          unavailable:
            (await getScheduleProbeLedger(ocid, now).catch(() => null))?.unavailable === true,
        })),
      )
      if (cancelled) return
      // miss 는 적지 않는다. 적으면 `has(ocid)` 가 참이 되어 위 `missing` 이 그 ocid 를 영영
      // 거르고, 아직 모른다 가 그런 것은 없다 로 굳는다. 온보딩에서 이 회차는 로스터가 캐시를
      // 쓰기 전에 돌므로 대표 캐릭터가 정확히 그 창에서 굳는다.
      const found = loaded.filter((item) => item.entry !== null)
      if (found.length > 0) {
        setProfiles((previous) => {
          const next = new Map(previous)
          for (const item of found) next.set(item.ocid, item.entry)
          return next
        })
      }
      setUnavailableOcids((previous) => {
        const flagged = loaded.filter((item) => item.unavailable)
        if (flagged.length === 0) return previous
        const next = new Set(previous)
        for (const item of flagged) next.add(item.ocid)
        return next
      })
    })()
    return () => {
      cancelled = true
    }
    // `profiles` 는 **읽기만** 한다. deps 에 넣으면 자기 갱신으로 다시 돌아 회차가 무한해진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededKey])

  // ── 파생 ─────────────────────────────────────────────────────────────────────────
  /**
   * 위 층과 대표 얼굴이 실제로 읽는 표. 캐시 위에 이미 받은 로스터를 얹는다.
   *
   * 아래 층은 같은 순간에 이름·레벨·초상화를 이미 들고 있다(`rosters`). 그 값이 위로 흐르지
   * 않으면 화면 한 장 안에서 같은 캐릭터가 한쪽만 비어 있다. 캐시가 빈 신규 설치에서만 나는
   * 얼굴이라 온보딩을 통과하는 모든 사용자가 겪는다.
   *
   * 캐시가 있으면 캐시가 이긴다. 로스터의 `character/basic` 이 그 캐시를 쓰는 쪽이라 정상
   * 경로에서 둘은 같은 값이고, 로스터가 stub 을 먼저 흘리는 구간에서는 캐시 쪽이 덜 비어
   * 있다. 즉 로스터는 캐시가 모르는 자리만 채운다.
   *
   * 요청은 하나도 늘지 않는다. 이미 온 응답을 버리지 않을 뿐이다.
   */
  const knownProfiles = useMemo(() => {
    const merged = new Map<string, KnownCharacterProfile | null>()
    for (const [ocid, entry] of profiles) merged.set(ocid, entry?.profile ?? null)
    for (const roster of Object.values(rosters)) {
      for (const entry of roster.entries) {
        if (merged.get(entry.ocid) == null) {
          merged.set(entry.ocid, {
            name: entry.name,
            level: entry.level,
            imageUrl: entry.imageUrl,
            world: entry.world,
            jobClass: entry.jobClass,
          })
        }
      }
    }
    return merged
  }, [profiles, rosters])

  const selectedViews = useMemo(
    () => buildSelectedCharacterViews(selectedOcids, knownProfiles, unavailableOcids),
    [selectedOcids, knownProfiles, unavailableOcids],
  )
  const representativeState =
    pickedRepresentative === undefined ? storedRepresentative : pickedRepresentative
  const representativeOcid = resolveRepresentative(selectedOcids, representativeState)

  const roster = selectedAccountId === null ? undefined : rosters[selectedAccountId]
  // 조회 불가는 아래 층에 서지 않는다. 고를 수 없는 것을 고르라고 두지 않는다. 그래서 빼면
  // 어디에도 안 선다 가 필터 하나로 성립한다.
  const selectable = useMemo(
    () => (roster?.entries ?? []).filter((entry) => entry.unavailable !== true),
    [roster],
  )
  const candidates = useMemo(() => {
    const chosen = new Set(selectedOcids)
    return selectable.filter((entry) => !chosen.has(entry.ocid))
  }, [selectable, selectedOcids])

  const portraitByAccountId = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          account.accountId,
          knownProfiles.get(account.representative.ocid)?.imageUrl ?? null,
        ]),
      ),
    [accounts, knownProfiles],
  )

  const isDirty =
    !sameOrder(selectedOcids, trackedOcids ?? []) || representativeOcid !== storedRepresentative

  // ── 동작 ─────────────────────────────────────────────────────────────────────────
  const editSelection = useCallback(
    (change: (previous: string[]) => string[]): void => {
      setEditedOcids((previous) => change(previous ?? trackedOcids ?? []))
    },
    [trackedOcids],
  )

  const selectAccount = useCallback(
    (accountId: string): void => {
      openAccountRef.current = accountId
      setSelectedAccountId(accountId)
      loadRoster(accountId)
    },
    [loadRoster],
  )

  // 새로 고른 캐릭터는 **배열 끝**이다(레벨로 끼워 넣지 않는다).
  const addCharacter = useCallback(
    (ocid: string): void => {
      editSelection((previous) => (previous.includes(ocid) ? previous : [...previous, ocid]))
    },
    [editSelection],
  )

  // 놓은 자리가 곧 배열 순서다. 저장 시점에 다시 정렬하지 않는다. 레벨 내림차순은 아직 순서를
  // 정하지 않았을 때의 초기값이다.
  const moveCharacter = useCallback(
    (fromIndex: number, toIndex: number): void => {
      editSelection((previous) => moveOcid(previous, fromIndex, toIndex))
    },
    [editSelection],
  )

  // 대표를 지우는 코드는 없다. `resolveRepresentative` 가 **목록에 없으면 null** 로 답한다.
  const removeCharacter = useCallback(
    (ocid: string): void => {
      editSelection((previous) => previous.filter((candidate) => candidate !== ocid))
    },
    [editSelection],
  )

  // 라디오다. 채워진 별을 다시 눌러도 같은 값이라 바뀌는 것이 없다.
  const setRepresentative = useCallback((ocid: string): void => {
    setPickedRepresentative(ocid)
  }, [])

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
    portraitByAccountId,
    selectedAccountId,
    isAccountsLoading,
    accountsError,
    selectedOcids,
    selectedViews,
    representativeOcid,
    candidates,
    selectableCount: selectable.length,
    isRosterLoading,
    rosterError,
    isDirty,
    selectAccount,
    addCharacter,
    removeCharacter,
    moveCharacter,
    setRepresentative,
    retryAccounts,
    retryRoster,
  }
}
