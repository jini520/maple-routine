/**
 * 화면이 이름·레벨·얼굴을 읽는 표 한 벌. 네트워크를 안 쓴다.
 *
 * 두 곳에서 모은다. 로컬 캐시(`character/basic`)와, 이미 받아 둔 후보 목록. **캐시가 이긴다.**
 * 로스터의 `character/basic` 이 그 캐시를 쓰는 쪽이라 정상 경로에서 둘은 같은 값이고, 로스터가
 * stub 을 먼저 흘리는 구간에서는 캐시 쪽이 덜 비어 있다. 즉 로스터는 캐시가 모르는 자리만 채운다.
 *
 * 후보 목록을 자료구조가 아니라 **행 배열로 받는다**. 로스터의 모양을 받으면 그쪽을 고칠 때 여기가
 * 함께 깨진다.
 *
 * 요청은 하나도 안 는다. 이미 온 응답을 버리지 않을 뿐이다.
 *
 * @example
 * const { knownProfiles, unavailableOcids } = useKnownProfiles({ ocids, fallbackEntries })
 */
import { useEffect, useMemo, useState } from 'react'

import type { KnownCharacterProfile } from '../features/character-manage/derivations'
import {
  getCachedCharacterBasic,
  type CachedCharacterBasicEntry,
} from '../storage/character-basic-cache'
import { getScheduleProbeLedger } from '../storage/schedule-probe-ledger'
import type { CharacterPickerEntry } from '../types'

export interface KnownProfiles {
  /** ocid → 프로필. 값이 `null` 이면 **아직 모른다**. */
  knownProfiles: Map<string, KnownCharacterProfile | null>
  /** 오늘 조회에 실패한 캐릭터. 위 층이 그 사실을 캡션으로 적는다. */
  unavailableOcids: ReadonlySet<string>
}

export function useKnownProfiles(input: {
  /** 표에 있어야 하는 ocid. 화면이 그리는 것 전부다. */
  ocids: string[]
  /** 캐시가 모르는 자리를 채울 행들. 이미 받아 둔 후보 목록이다. */
  fallbackEntries: CharacterPickerEntry[]
}): KnownProfiles {
  const [profiles, setProfiles] = useState<Map<string, CachedCharacterBasicEntry | null>>(new Map())
  const [unavailableOcids, setUnavailableOcids] = useState<ReadonlySet<string>>(new Set())

  // 배열을 그대로 deps 에 넣으면 매 렌더 새 참조라 회차가 끝없이 돈다. 문자열 하나로 접는다.
  const neededKey = [...new Set(input.ocids)].join(',')

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

  const knownProfiles = useMemo(() => {
    const merged = new Map<string, KnownCharacterProfile | null>()
    for (const [ocid, entry] of profiles) merged.set(ocid, entry?.profile ?? null)
    for (const entry of input.fallbackEntries) {
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
    return merged
  }, [profiles, input.fallbackEntries])

  return { knownProfiles, unavailableOcids }
}
