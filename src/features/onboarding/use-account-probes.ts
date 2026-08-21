import { useCallback, useEffect, useState } from 'react'
import { fetchCharacterBasicCached } from '../schedule-sync/character-basic-fetch'
import { toScheduleSyncError } from '../schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { getAuthConfig } from '../../storage/api-key'
import type { MapleAccount, MapleCharacter } from '../../types'
import { pickRepresentativeCharacter } from './representative-character'

/**
 * 계정 하나에 대한 판정. **세 갈래이고 겹치지 않는다**([[ADR-116]] 결정 3).
 *
 * 전에는 `allUnavailable: boolean` 하나라 두 갈래뿐이었고, "확인하지 못했다"를 담을 자리가 없어
 * 003 이 아닌 실패가 조용히 "조회 가능"으로 흡수됐다(이슈 #177 — 위양성이 아니라 **위음성**이다).
 */
export type AccountProbeVerdict =
  /** 캐릭터 하나 이상을 **성공적으로 확인했다** — 이 계정은 고를 수 있다. */
  | { kind: 'queryable' }
  /**
   * 전원이 400 `OPENAPI00003` — 이 계정을 고르면 어떤 캐릭터도 조회할 수 없다(실측 13/13 사례,
   * [foundation/nexon-api.md](../../../docs/foundation/nexon-api.md) "조회 불가 ocid").
   * **003 만이 영구 판정이다**([[ADR-067]] 결정 1).
   */
  | { kind: 'allUnavailable' }
  /**
   * 003 이 아닌 실패가 있어 **확인하지 못한 캐릭터가 남았다**. 영구가 아니라 "모른다"이고,
   * 모르는 계정은 목록에 서지 않는다([[ADR-116]] 결정 3). `error` 는 그 첫 원인이다 —
   * 화면이 문구와 출구를 원인별로 고른다(429 는 키 교체, 그 외는 재시도).
   */
  | { kind: 'undetermined'; error: ScheduleSyncError }

export interface AccountProbe {
  /**
   * **성공적으로 확인된** 캐릭터 중 최고 레벨(동레벨은 이름순 — `pickRepresentativeCharacter`).
   * `null` 이면 확인된 캐릭터가 하나도 없어 대표로 세울 캐릭터가 없다.
   *
   * 후보를 "003 이 아닌 캐릭터"가 아니라 **확인된 캐릭터**로 좁히는 것이 요점이다 — 429 로
   * 아무것도 못 본 캐릭터가 후보로 남으면 [[ADR-068]] 결정 4 가 전수 프로브로 없앤 문제
   * (조회 불가 캐릭터가 계정 표기가 된다)가 그 경로로 되살아난다.
   */
  representative: MapleCharacter | null
  portraitUrl: string | null
  verdict: AccountProbeVerdict
}

export interface AccountProbesState {
  probes: Record<string, AccountProbe>
  /** 전수 프로브가 **settle** 했는가 — "성공"이 아니다([[ADR-113]] 결정 4). */
  isSettled: boolean
  /** completed = settle 한 캐릭터 수, total = 전 계정 캐릭터 수의 합. */
  progress: { completed: number; total: number }
  /**
   * 같은 `accounts` 로 프로브를 처음부터 다시 돈다 — 판정 불가에서 화면이 주는 재시도의 실체다.
   * `accounts` 참조가 바뀌었을 때와 똑같이 이전 회차 결과를 버리므로 대기 표시부터 다시 시작한다.
   */
  retry: () => void
}

/**
 * 한 `accounts` 참조 · 한 시도(`attempt`)에 대한 프로브 1회분. 세 값이 함께 태어나고 함께
 * 버려진다 — 그래서 한 state 다. `source`·`attempt` 가 그 세대를 가르는 기준이다.
 */
interface ProbeRun {
  source: MapleAccount[]
  attempt: number
  probes: Record<string, AccountProbe>
  isSettled: boolean
  completed: number
}

function emptyRun(source: MapleAccount[], attempt: number): ProbeRun {
  return { source, attempt, probes: {}, isSettled: false, completed: 0 }
}

/**
 * 계정 선택 화면에서 각 계정의 **전체 캐릭터**에 `character/basic` 을 프로브한다([[ADR-068]] 결정 4).
 *
 * 전에는 대표 캐릭터 1명만 조회해 초상화만 채웠다. 두 가지가 문제였다:
 *  1. `character/list` 의 최고 레벨 캐릭터가 **조회 불가일 수 있다**(실측) — 그러면 계정 표기 자체가
 *     조회 불가 캐릭터의 이름·레벨이 된다.
 *  2. 계정 전원이 조회 불가인 경우를 **고른 뒤에야** 알 수 있었다. 그때는 피커가 빈 목록이 되고
 *     아무 설명도 없다(이슈 #78, onboarding.md 열린 질문).
 *
 * 전수 프로브라 판정이 확정적이다 — 표본 1명으로는 "이 계정 전체"를 단정할 수 없다(월드 리프는
 * 캐릭터 1~2개 단위가 흔하다, [[ADR-067]] 트레이드오프). 호출은 계정의 캐릭터 수만큼 늘고, 사용자가
 * 그 지연을 감수하기로 했다(2026-07-31).
 *
 * **결과를 각 계정의 `accountId` 로 `character-basic-cache` 에 쓴다**([[ADR-113]] 결정 2). 전에는
 * 쓰지 않았고 그 이유가 "고르지 않은 계정의 캐릭터까지 캐시에 들어가면 피커의 stub 단계가 다른 계정
 * 캐릭터를 보여준다"였는데, **그 근거는 이미 무효다** — 그 우려는 캐시 인덱스가 **전역**이던 시절
 * ([[ADR-068]] 결정 4, 2026-07-31)의 것이고, [[ADR-086]] 결정 9(2026-08-03)가 인덱스를 계정별로
 * 쪼갠 뒤로는(`characterBasicCacheIndexKey(accountId)`, stub 은
 * `getAllCachedCharacterBasicOcids(accountId)`) 누출이 **구조적으로 불가능**하다. 안 고른 계정 몫은
 * 그 계정의 인덱스에만 들어가고, 나중에 그 계정으로 바꾸면 따뜻한 캐시로 되살아난다.
 * 캐시를 채우는 것은 5분 TTL 가드([[ADR-113]] 결정 1)와 짝이다 — 프로브가 채워야 뒤따르는 예열·피커가
 * 그 캐시를 만나 같은 요청을 다시 내지 않는다. 둘 중 하나만 하면 절감이 성립하지 않는다.
 *
 * 자격 스윕(`resolveCharacterEligibility`)은 여기서 부르지 않는다([[ADR-113]] 결정 6) — `basic` 은
 * 어차피 전 계정을 부르고 있어 캐싱이 공짜지만 `scheduler/character-state` 는 선택 계정만 부르므로,
 * 당기면 안 고를 계정 몫이 **새 호출로 순증**한다. 그리고 003 판별에 스윕은 필요 없다.
 *
 * 조회 불가(`OPENAPI00003`)만 영구로 다룬다 — 네트워크·429 등 그 외 실패는 원인을 모르므로 영구로
 * 단정하지 않는다([[ADR-113]] 결정 7 의 원칙). 다만 **"모른다"와 "괜찮다"를 같은 화면으로 그리지는
 * 않는다** — 그런 계정은 `undetermined` 로 표시되고 화면이 목록 자체를 미룬다([[ADR-116]] 결정 3).
 */
export function useAccountProbes(accounts: MapleAccount[]): AccountProbesState {
  const [attempt, setAttempt] = useState(0)
  const [run, setRun] = useState<ProbeRun>(() => emptyRun(accounts, 0))

  // `accounts` 참조가 바뀌면(또는 재시도로 세대가 넘어가면) **렌더 시점에** 이전 실행의 결과를
  // 버린다. effect 안에서 되돌리면 effect 는 페인트 뒤에 도니 한 프레임 동안 이전 계정 목록의
  // 프로브가(그리고 `isSettled: true` 가) 새 목록에 얹히는데, 그것이 [[ADR-113]] 결정 3 이
  // 없애려는 바로 그 장면이다.
  const current =
    run.source === accounts && run.attempt === attempt ? run : emptyRun(accounts, attempt)

  // total 은 state 가 아니라 `accounts` 에서 파생한다 — 첫 렌더부터 분모가 정확해야 진행률이
  // 0/0 으로 시작하지 않는다([[ADR-113]] 결정 5).
  const total = accounts.reduce((sum, account) => sum + account.characters.length, 0)

  useEffect(() => {
    let cancelled = false

    function patch(apply: (previous: ProbeRun) => ProbeRun): void {
      if (cancelled) return
      setRun((previous) =>
        apply(
          previous.source === accounts && previous.attempt === attempt
            ? previous
            : emptyRun(accounts, attempt),
        ),
      )
    }

    async function load(): Promise<void> {
      // 라운드 전체가 같은 `now` 를 공유한다 — 캐릭터마다 만들면 같은 한 바퀴 안에서 TTL 기준이
      // 흔들린다.
      const now = new Date()

      try {
        const authConfig = await getAuthConfig()
        if (authConfig === null) return

        await Promise.all(
          accounts.map(async (account) => {
            const unavailableOcids = new Set<string>()
            const confirmedOcids = new Set<string>()
            // 003 이 아닌 **첫** 실패. 나중 것으로 덮지 않는다 — 화면 문구가 원인별로 갈리는데
            // 응답이 도착하는 순서에 따라 뒤바뀌면 같은 상황이 회차마다 다르게 읽힌다.
            let undetermined: ScheduleSyncError | null = null
            const portraitByOcid = new Map<string, string>()

            await Promise.all(
              account.characters.map(async (character) => {
                try {
                  // `accountId` 는 반드시 **그 캐릭터가 속한 계정**의 것이다 — 여기는 전 계정을
                  // 훑으므로 틀리면 다른 계정 인덱스가 오염된다([[ADR-086]] 결정 9가 막은 문제).
                  const profile = await fetchCharacterBasicCached(
                    authConfig.apiKey,
                    account.accountId,
                    character.ocid,
                    now,
                    character.jobClass,
                  )
                  confirmedOcids.add(character.ocid)
                  portraitByOcid.set(character.ocid, profile.imageUrl)
                } catch (error) {
                  const failure = toScheduleSyncError(error)
                  if (failure.kind === 'characterUnavailable') {
                    // 400 `OPENAPI00003` — 이 ocid 는 언제 물어도 같은 400 이다([[ADR-067]] 결정 1).
                    // 실패지만 **확인이 끝난** 실패라 판정을 막지 않는다.
                    unavailableOcids.add(character.ocid)
                  } else {
                    // 그 외(429·네트워크·401…)는 이 캐릭터에 대해 알아낸 것이 없다는 뜻이다.
                    // 하나라도 있으면 이 계정은 판정 불가다([[ADR-116]] 결정 3) — 전에는 여기서
                    // 그냥 버려서 못 본 캐릭터가 "조회 가능"으로 분류됐다(이슈 #177).
                    undetermined ??= failure
                  }
                }

                // 성공이든 실패든 이 캐릭터에 대해 알아낼 것은 끝났다. 진행률은 계정이 아니라
                // 캐릭터 단위다 — 분모(`total`)가 캐릭터 수의 합이므로 분자도 같은 단위여야 한다.
                patch((previous) => ({ ...previous, completed: previous.completed + 1 }))
              }),
            )

            if (cancelled) return

            // 대표 후보는 **확인된** 캐릭터뿐이다 — 못 본 캐릭터를 후보로 남기면 그 캐릭터가
            // 계정 표기가 될 수 있다([[ADR-068]] 결정 4 가 없앤 문제).
            const confirmed = account.characters.filter((character) => confirmedOcids.has(character.ocid))
            const representative = confirmed.length > 0 ? pickRepresentativeCharacter(confirmed) : null

            patch((previous) => ({
              ...previous,
              probes: {
                ...previous.probes,
                [account.accountId]: {
                  representative,
                  portraitUrl: representative === null ? null : portraitByOcid.get(representative.ocid) ?? null,
                  // 판정 불가가 먼저다 — 못 본 캐릭터가 남았으면 "전원 003"을 단정할 수 없다.
                  verdict:
                    undetermined !== null
                      ? { kind: 'undetermined', error: undetermined }
                      : account.characters.length > 0 &&
                          unavailableOcids.size === account.characters.length
                        ? { kind: 'allUnavailable' }
                        : { kind: 'queryable' },
                },
              },
            }))
          }),
        )
      } finally {
        // 완료 판정은 "성공"이 아니라 **settle** 이다([[ADR-113]] 결정 4). 키가 없어 조기 return 하는
        // 경로·계정 0개·개별 프로브 실패가 전부 여기로 모인다 — 성공 기준으로 두면 결정 3이 목록을
        // 이 플래그 뒤로 미룬 뒤 그 경로에서 화면이 **영원히 로딩**이 된다.
        patch((previous) => ({ ...previous, isSettled: true }))
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accounts, attempt])

  const retry = useCallback(() => {
    setAttempt((previous) => previous + 1)
  }, [])

  return {
    probes: current.probes,
    isSettled: current.isSettled,
    progress: { completed: current.completed, total },
    retry,
  }
}
