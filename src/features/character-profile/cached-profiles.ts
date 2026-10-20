/**
 * `character-basic-cache` 에서 캐릭터 프로필을 읽는 함수 둘. 네트워크는 없다.
 *
 * 오늘 화면이 대표 캐릭터의 EXP·레벨과 드롭 위젯의 캐릭터 이름을 여기서 얻는다.
 *
 * @see resolve.ts 기록에 붙일 이름·얼굴은 스냅샷 표를 먼저 보는 그쪽이 맡는다
 */
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import type { CharacterBasicProfile } from '../../types'
import { resolveDisplayRepresentative } from '../character-manage/derivations'

/**
 * 추적 캐릭터 전원의 프로필 맵.
 *
 * 캐시에 없는 캐릭터는 **항목을 만들지 않는다**. 이름 없이 카드를 그릴 수 없고, ocid 는
 * 사용자에게 뜻이 없는 값이라 대신 넣지 않는다(`drop-history-store` 와 같은 규칙).
 *
 * @param ocids 읽을 캐릭터
 */
export async function readCharacterProfiles(
  ocids: string[],
): Promise<Readonly<Record<string, CharacterBasicProfile>>> {
  const entries = await Promise.all(
    ocids.map(async (ocid) => [ocid, await getCachedCharacterBasic(ocid).catch(() => null)] as const),
  )

  return Object.fromEntries(
    entries.flatMap(([ocid, entry]) => (entry === null ? [] : [[ocid, entry.profile] as const])),
  )
}

/**
 * **대표 하나**의 프로필. 재조회가 끝난 자리에서 쓴다.
 *
 * 전원을 다시 읽지 않는다. 저장소 읽기 하나가 네이티브 호출 하나라 추적 45명이면 당길 때마다
 * 45번이 되는데, 오늘 화면이 나머지 항목에서 꺼내는 것은 드롭 위젯의 캐릭터 **이름** 하나뿐이라
 * 개명이 아니면 값이 안 바뀐다. 그 이름은 다음 마운트가 읽어도 늦지 않다.
 *
 * @param ocids 추적 캐릭터
 * @param representative 선택 스토어의 대표 표식. 저장소에서 다시 읽으면 늦게 온 읽기가 방금 바꾼 대표를 되돌린다.
 */
export async function readRepresentativeProfile(
  ocids: string[],
  representative: string | null,
): Promise<{ ocid: string; profile: CharacterBasicProfile } | null> {
  // 화면이 대표 자리에 세우는 캐릭터를 그대로 고른다. 미지정이면 목록의 첫 번째다.
  const ocid = resolveDisplayRepresentative(ocids, representative)
  if (ocid === null) return null

  const entry = await getCachedCharacterBasic(ocid).catch(() => null)
  return entry === null ? null : { ocid, profile: entry.profile }
}
