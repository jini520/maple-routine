/**
 * 기록에 붙일 캐릭터 이름·얼굴을 찾는 **한 문**.
 *
 * 원천이 둘이라 갈라 두면 어긋난다. `character_profiles` 표가 지워지지 않는 스냅샷이고
 * `character-basic-cache` 는 5분 TTL 캐시다. 표를 먼저 보고 없는 것만 캐시를 읽으며, 캐시에서
 * 찾은 것은 표에 심는다.
 *
 * **그 자가 치유가 곧 마이그레이션이다.** 이 표가 생기기 전 설치본은 표가 비어 있고 캐시만 차
 * 있다. 별도 이관 단계를 두면 그때 이미 추적에서 뺀 캐릭터는 그 단계가 훑을 목록에 없어 영영 안
 * 옮겨진다. 읽을 때 옮기면 화면에 뜨는 순간 옮겨진다.
 *
 * @example
 * const profiles = await resolveDisplayProfiles(displayOcids)
 * const name = profiles.get(record.ocid)?.name
 */
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getCharacterProfiles, saveCharacterProfile } from '../../storage/character-profiles'

export interface DisplayProfile {
  name: string
  imageUrl: string
  /** 모르면 `null`. 월드별 결정석 집계가 이 부재를 구분한다. */
  world: string | null
  /** 모르면 `null`. 캐릭터 정렬이 이 부재를 맨 뒤로 보낸다. */
  level: number | null
}

/**
 * 찾은 것만 담아 돌려준다. **못 찾은 `ocid` 는 결과에 안 든다.** `ocid` 는 사용자에게 아무 뜻도
 * 없는 문자열이라 그것을 이름 대신 적지 않고, 부르는 쪽이 그 부재를 보고 행을 안 만든다.
 */
export async function resolveDisplayProfiles(
  ocids: readonly string[],
): Promise<Map<string, DisplayProfile>> {
  const unique = [...new Set(ocids)]
  const profiles = new Map<string, DisplayProfile>()
  if (unique.length === 0) {
    return profiles
  }

  // 표 조회가 죽어도 화면은 서야 한다. 그때는 캐시가 아는 만큼 그린다.
  const snapshots = await getCharacterProfiles(unique).catch(() => new Map())
  for (const [ocid, snapshot] of snapshots) {
    profiles.set(ocid, {
      name: snapshot.name,
      imageUrl: snapshot.imageUrl,
      world: snapshot.world,
      level: snapshot.level,
    })
  }

  const missing = unique.filter((ocid) => !profiles.has(ocid))
  await Promise.all(
    missing.map(async (ocid) => {
      const cached = await getCachedCharacterBasic(ocid).catch(() => null)
      if (cached === null || cached.profile.name === '') {
        return
      }

      const profile: DisplayProfile = {
        name: cached.profile.name,
        imageUrl: cached.profile.imageUrl,
        world: cached.profile.world ?? null,
        level: cached.profile.level,
      }
      profiles.set(ocid, profile)
      // `updatedAt` 은 캐시가 적어 둔 시각이다. 지금 시각으로 쓰면 방금 받은 값처럼 보인다.
      await saveCharacterProfile({ ocid, ...profile, updatedAt: cached.cachedAt }).catch(() => undefined)
    }),
  )

  return profiles
}
