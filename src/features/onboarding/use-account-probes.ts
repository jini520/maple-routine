import { useEffect, useState } from 'react'
import { fetchCharacterBasic } from '../../nexon/character'
import { toScheduleSyncError } from '../schedule-sync/schedule-sync'
import { getAuthConfig } from '../../storage/api-key'
import type { MapleAccount, MapleCharacter } from '../../types'
import { pickRepresentativeCharacter } from './representative-character'

export interface AccountProbe {
  /**
   * **조회 가능한** 캐릭터 중 최고 레벨(동레벨은 이름순 — `pickRepresentativeCharacter`).
   * `null` 이면 그 계정의 모든 캐릭터가 조회 불가라 대표로 세울 캐릭터가 없다.
   */
  representative: MapleCharacter | null
  portraitUrl: string | null
  /**
   * 전원이 400 `OPENAPI00003` — 이 계정을 고르면 어떤 캐릭터도 조회할 수 없다(실측 13/13 사례,
   * [foundation/nexon-api.md](../../../docs/foundation/nexon-api.md) "조회 불가 ocid").
   */
  allUnavailable: boolean
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
 * **결과를 character-basic-cache에 쓰지 않는다.** 고르지 않은 계정의 캐릭터까지 캐시에 들어가면
 * 피커의 stub 단계(캐시 인덱스 전체를 훑는다, [[ADR-017]] 결정 6)가 **다른 계정 캐릭터를 보여준다**.
 * 예열([[ADR-016]])이 선택된 계정만 캐싱하는 지금 구조를 유지한다.
 *
 * 조회 불가(`OPENAPI00003`)만 영구로 다룬다 — 네트워크 등 그 외 실패는 원인을 모르므로 후보 자격을
 * 유지하고 초상화만 비운다("모르는 실패를 영구로 단정하지 않는다").
 */
export function useAccountProbes(accounts: MapleAccount[]): Record<string, AccountProbe> {
  const [probes, setProbes] = useState<Record<string, AccountProbe>>({})

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      const authConfig = await getAuthConfig()
      if (authConfig === null) return

      await Promise.all(
        accounts.map(async (account) => {
          const unavailableOcids = new Set<string>()
          const portraitByOcid = new Map<string, string>()

          await Promise.all(
            account.characters.map(async (character) => {
              try {
                const profile = await fetchCharacterBasic(authConfig.apiKey, character.ocid)
                portraitByOcid.set(character.ocid, profile.imageUrl)
              } catch (error) {
                if (toScheduleSyncError(error).kind === 'characterUnavailable') {
                  unavailableOcids.add(character.ocid)
                }
              }
            }),
          )

          if (cancelled) return

          const queryable = account.characters.filter((character) => !unavailableOcids.has(character.ocid))
          const representative = queryable.length > 0 ? pickRepresentativeCharacter(queryable) : null

          setProbes((previous) => ({
            ...previous,
            [account.accountId]: {
              representative,
              portraitUrl: representative === null ? null : portraitByOcid.get(representative.ocid) ?? null,
              allUnavailable: account.characters.length > 0 && queryable.length === 0,
            },
          }))
        }),
      )
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [accounts])

  return probes
}
