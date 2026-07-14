import { useEffect, useState } from 'react'
import { fetchCharacterBasic } from '../../nexon/character'
import { getAuthConfig } from '../../storage/api-key'
import type { MapleAccount } from '../../types'
import { pickRepresentativeCharacter } from './representative-character'

// 계정 선택 화면에서 각 계정의 대표 캐릭터 초상화를 미리 보여주기 위해, 예열(ADR-016)을
// 기다리지 않고 이 화면 진입 시점에 곧바로 character/basic을 조회한다. 계정 수만큼만
// 호출되므로(대개 1~2개) 예열 설계와 별개로 허용한다. 실패한 계정은 null로 표시해
// 컴포넌트가 '?' 대체 UI를 그리도록 한다.
export function useRepresentativePortraits(accounts: MapleAccount[]): Record<string, string | null> {
  const [portraits, setPortraits] = useState<Record<string, string | null>>({})

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      const authConfig = await getAuthConfig()
      if (authConfig === null) return

      await Promise.all(
        accounts.map(async (account) => {
          const representative = pickRepresentativeCharacter(account.characters)
          try {
            const profile = await fetchCharacterBasic(authConfig.apiKey, representative.ocid)
            if (!cancelled) {
              setPortraits((prev) => ({ ...prev, [account.accountId]: profile.imageUrl }))
            }
          } catch {
            if (!cancelled) {
              setPortraits((prev) => ({ ...prev, [account.accountId]: null }))
            }
          }
        }),
      )
    }

    load()

    return () => {
      cancelled = true
    }
  }, [accounts])

  return portraits
}
