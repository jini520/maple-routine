// 캐릭터 관리 화면의 **상태 한 벌**. 설정 하위 페이지와 온보딩 단계가 함께 쓴다.
//
// 화면이 갈리는 것은 머리와 CTA 뿐이라(결정 1), 두 층·드롭다운·조회·TTL 은 여기 모여 있고
// `CharacterManageBody` 가 그것을 그리기만 한다.
//
// ── 값 규칙은 여기 없다 ─────────────────────────────────────────────────────────────
//
// 드롭다운 행의 계정 요약 · `선택됨` 층의 행 · 저장된 대표의 유효성은
// `src/features/character-manage/derivations` 의 순수 함수가 갖는다(머리
// **값 규칙의 자리**). 여기서 다시 계산하면 그 규칙을 테스트가 직접 물 수 없다.
//
// ── 조회 넷과 그 자리 ───────────────────────────────────────────────────────────────
//
// | 무엇 | 언제 | 네트워크 |
// |---|---|---|
// | 계정 목록(`character/list`) | 마운트 1회 | ○ — 드롭다운이 계정 전체를 알아야 한다 |
// | 계정별 후보(`getCharacterPickerRoster`) | 계정을 **처음 열 때** | ○ — TTL 안이면 0 |
// | `선택됨` 층 프로필 | 목록에 새 ocid 가 생길 때 | ✕ 로컬 캐시만(결정 2 표) |
// | 조회 불가 여부 | 위와 같은 자리 | ✕ 조회 원장 |
//
// **계정 목록을 따로 부르는 대가**: `getCharacterPickerRoster` 도 안에서 `character/list` 를
// 부르므로 화면을 처음 열면 그 응답이 두 번 온다. 로스터가 그 목록을 밖에서 받는 구조가 아니고
// (`resolveRegisteredCharacters` 가 자기 안에서 부른다) 이 phase 는 core 를 건드리지 않는다.
//
// **`src/nexon` 을 화면 층에서 직접 부르는 자리다.** core 에 **계정 목록만 주는** 함수가 없고
// (`features/settings/store` 의 것은 계정 변경 플로우에 묶여 있는데 RN 에는 그 플로우가 없다 —
// ) 이 phase 에서는 core 를 못 고친다. 저장소는 그대로 `storage/` 어댑터를
// 거친다(CLAUDE.md CRITICAL).
//
// ── 계정 전환 TTL ──────────────────────────────────────────────
//
// 한 번 **성공으로** 끝난 계정은 5분(`CHARACTER_BASIC_TTL_MS`. 새 상수를 만들지 않는다) 동안
// 회차를 다시 시작하지 않는다. 조회 원장·`character/basic` 5분 가드는 **네트워크가 나가는가** 를
// 접지만 `character/list` 와 판정 루프 자체는 못 접는다.
//
// - **성공에만 도장을 찍는다**(`settledAt`). 실패는 캐싱하지 않는다. SWR 이 stub 을 흘린 뒤
//   실패하면 항목은 남고(스탈 배너 자리) 도장은 안 찍혀 다음에 다시 돈다.
// - **다시 시도는 TTL 을 무시한다**(`force`). 그러지 않으면 5분 동안 같은 실패 화면에 갇힌다.
// - **수명은 이 훅이다.** 화면을 나가면 사라진다. 영속화하면 **`character/list` 는 캐싱하지
//  않는다** 를 저장소 층에서 뒤집는 것이 된다(정정).
//
// ── 회차를 **effect 가 아니라 사건이 시작한다** ─────────────────────────────────────
//
// 후보 조회를 `useEffect([selectedAccountId])` 로 걸면 **회차를 시작한다** 를 알리는
// `setIsRosterLoading(true)` 가 effect 본문에 직접 앉아 `react-hooks/set-state-in-effect` 에
// 걸린다. 그것을 비동기 안으로 미루면 **모르는 사실을 그리는 프레임**이 한 장 생긴다(항목 0건 +
// 로딩 아님 = **모두 조회할 수 없어요** 이 없앤 바로 그 얼굴).
//
// 그래서 회차를 여는 자리를 **그것을 일으키는 사건**으로 옮겼다. 계정 목록이 첫 계정을 정하는
// 순간 · 드롭다운 선택 · `다시 시도` 셋뿐이고, 전부 effect 밖이라 시작과 표시가 같은 커밋에서
// 일어난다.
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
  /** 이 계정에서 **아직 안 고른** 후보. 고른 것은 위로 옮겨간다(결정 3). */
  candidates: CharacterPickerEntry[]
  /** 이 계정에서 고를 수 있는 캐릭터 수 — {전체}개 중 {표시}개 표시 의 앞자리. */
  selectableCount: number
  isRosterLoading: boolean
  rosterError: ScheduleSyncError | null

  /** 저장 활성 조건 — 집합 ∪ 순서 ∪ 대표 중 하나라도 다르면 참(결정 7). */
  isDirty: boolean

  selectAccount: (accountId: string) => void
  addCharacter: (ocid: string) => void
  removeCharacter: (ocid: string) => void
  /** 끌어 놓았을 때·접근성 액션일 때 — 둘 다 `moveOcid` 하나를 통과한다. */
  moveCharacter: (fromIndex: number, toIndex: number) => void
  setRepresentative: (ocid: string) => void
  retryAccounts: () => void
  retryRoster: () => void
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function useCharacterManage(): CharacterManageController {
  // 추적 목록의 진실은 컨텐츠 스케줄러 스토어 하나다(— 사본을 만들지 않는다).
  const { trackedOcids } = useContentSchedulerStore()

  const [accounts, setAccounts] = useState<AccountSummaryView[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isAccountsLoading, setIsAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<ScheduleSyncError | null>(null)
  const [accountsNonce, setAccountsNonce] = useState(0)

  const [rosters, setRosters] = useState<Record<string, AccountRoster>>({})
  const [isRosterLoading, setIsRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)

  // **편집하기 전에는 저장된 목록이 그대로 보인다**(`null` = 아직 손대지 않았다). 늦게 도착하는
  // `trackedOcids` 를 effect 로 **심으면** 그 setState 가 effect 본문에 직접 앉는다. 파생이 답이다.
  const [editedOcids, setEditedOcids] = useState<string[] | null>(null)
  // 같은 이유로 **아직 안 골랐다**(`undefined`)와 **없음으로 골랐다**(`null`)를 값으로 가른다.
  const [pickedRepresentative, setPickedRepresentative] = useState<string | null | undefined>(undefined)
  const [storedRepresentative, setStoredRepresentative] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<Map<string, CachedCharacterBasicEntry | null>>(new Map())
  const [unavailableOcids, setUnavailableOcids] = useState<ReadonlySet<string>>(new Set())

  // TTL 판정은 **지금 들고 있는 것** 을 봐야 하는데 그 읽기가 렌더 밖(사건 핸들러·비동기)에서
  // 일어난다. **쓰기도 전부 그 자리에서만** 하므로 렌더 중에 ref 를 만지지 않는다.
  const rostersRef = useRef<Record<string, AccountRoster>>({})
  /** 지금 열려 있는 계정 — 늦게 도착한 회차의 결과를 버릴 기준이다. */
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

  // ── 로컬 프로필·조회 불가 ────────────────────────────────────────────────────────
  //
  // `선택됨` 층은 네트워크 없이 그린다(결정 2 표). 드롭다운 행의 얼굴도 **캐시에 있을 때만**
  // 쓰므로(결정 6) 같은 자리에서 함께 읽는다. 얼굴 하나 때문에 프로브를 돌리지 않는다.
  // `useMemo` 인 것은 **값이 비싸서** 가 아니라 **아래 두 `useMemo` 의 deps 가 매 렌더 갈리지
  // 않게** 하기 위해서다(`??` 는 같은 내용이라도 새 배열을 만든다).
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
      // **miss 는 적지 않는다**. 적으면 `has(ocid)` 가 참이 되어 위
      // `missing` 이 그 ocid 를 영영 거르고, **아직 모른다** 가 **그런 것은 없다** 로 굳는다. 온보딩에서
      // 이 회차는 로스터가 캐시를 **쓰기 전에** 돌므로 대표 캐릭터가 정확히 그 창에서 굳었다.
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
   * 위 층과 대표 얼굴이 실제로 읽는 표 — **캐시 위에 이미 받은 로스터를 얹는다**
   *
   *
   * 아래 층은 같은 순간에 이름·레벨·초상화를 **이미 들고 있다**(`rosters`). 그 값이 위로 흐르지 않아
   * 화면 한 장 안에서 같은 캐릭터가 한쪽만 비어 있었다. 캐시가 빈 신규 설치에서만 나는 얼굴이라
   * 온보딩을 통과하는 모든 사용자가 겪었다.
   *
   * **캐시가 있으면 캐시가 이긴다.** 로스터의 `character/basic` 이 그 캐시를 쓰는 쪽이라 정상 경로에서
   * 둘은 같은 값이고, 로스터가 stub 을 먼저 흘리는 구간(SWR)에서는 캐시 쪽이 덜 비어
   * 있다. 즉 로스터는 **캐시가 모르는 자리만** 채운다.
   *
   * **요청은 하나도 늘지 않는다**. 결정 2 표의 네트워크 없다 가 금지한 것은 위 층을 그리려고
   * 요청을 새로 내는 것이고, 여기서는 이미 온 응답을 버리지 않을 뿐이다(결정 6 의 얼굴 하나 때문에
   * 프로브를 돌리지 않는다 도 그대로다).
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
  // 조회 불가는 아래 층에 서지 않는다. 고를 수 없는 것을 고르라고 두지 않는다.
  // 그래서 **빼면 어디에도 안 선다**(결정 3)가 필터 하나로 성립한다.
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

  // 새로 고른 캐릭터는 **배열 끝**이다(— 레벨로 끼워 넣지 않는다).
  const addCharacter = useCallback(
    (ocid: string): void => {
      editSelection((previous) => (previous.includes(ocid) ? previous : [...previous, ocid]))
    },
    [editSelection],
  )

  // 놓은 자리가 곧 배열 순서다. **저장 시점에 다시 정렬하지 않는다** —
  // 레벨 내림차순은 **아직 순서를 정하지 않았을 때의 초기값** 으로 내려갔다.
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

  // 라디오다. 채워진 별을 다시 눌러도 같은 값이라 바뀌는 것이 없다(결정 4: **여럿 고를 수 없다**).
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
