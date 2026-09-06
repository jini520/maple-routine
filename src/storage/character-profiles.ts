/**
 * 캐릭터 이름·초상의 **지워지지 않는 스냅샷**. 캐릭터 하나당 한 행.
 *
 * `character-basic-cache` 와 값이 같고 수명이 다르다. 그쪽은 5분 TTL 캐시이고 설정의 캐시
 * 비우기 `일반` 그룹이 통째로 지운다. 이름이 사라지면 기록에서 행을 만드는 자리가 그 `ocid` 를
 * 건너뛰어(`ocid` 는 사용자에게 아무 뜻도 없어 대신 안 적는다) **기록이 있어도 화면에서
 * 사라진다**. 그래서 이 표는 `RECORD_TABLE_NAMES` 에 들어 `기록` 그룹에서만 지워진다.
 *
 * 쓰는 자리는 `fetchCharacterBasicCached` 하나다. 앱 전체의 `character/basic` 통과 지점이라,
 * 한 번이라도 조회된 캐릭터는 추적을 해제해도 이름과 얼굴을 갖는다.
 *
 * @see docs/persistence/sqlite.md `character_profiles`
 */
import { getBossProfitDb } from './sqlite/db'

export interface CharacterProfileSnapshot {
  ocid: string
  name: string
  /** `character/basic` 의 `character_image`. 넥슨 정적 주소이고 API 키가 필요 없다. */
  imageUrl: string
  /** 모르면 `null`. 0 이나 빈 문자열로 채우지 않는다. */
  world: string | null
  level: number | null
  updatedAt: string
}

const UPSERT_SQL = `
  INSERT INTO character_profiles (ocid, name, image_url, world, level, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid) DO UPDATE SET
    name = excluded.name,
    image_url = excluded.image_url,
    -- 아는 값이 있을 때만 덮는다. 모르는 채로 부르는 경로가 이미 박아 둔 값을 지우면 안 된다.
    world = COALESCE(excluded.world, character_profiles.world),
    level = COALESCE(excluded.level, character_profiles.level),
    updated_at = excluded.updated_at
`

/**
 * 이름이 빈 스냅샷은 **안 쓴다**. 심으면 화면에 이름 없는 행이 서고, 그때 캐시에서 되찾을 길이
 * 사라진다(표에 있으니 캐시를 안 읽는다).
 */
export async function saveCharacterProfile(snapshot: CharacterProfileSnapshot): Promise<void> {
  if (snapshot.name === '') {
    return
  }

  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    snapshot.ocid,
    snapshot.name,
    snapshot.imageUrl,
    snapshot.world,
    snapshot.level,
    snapshot.updatedAt,
  ])
}

/**
 * `IN` 한 번으로 읽는다. `ocid` 마다 왕복하지 않는 것이 이 표를 쓰는 이유 절반이다.
 * 캐시는 `ocid` 하나가 네이티브 호출 하나라 목록이 길어질수록 왕복이 그만큼 는다.
 *
 * 표에 없는 `ocid` 는 결과에 **안 든다**. 부르는 쪽이 그 부재를 보고 캐시를 찾는다.
 */
export async function getCharacterProfiles(
  ocids: readonly string[],
): Promise<Map<string, CharacterProfileSnapshot>> {
  const profiles = new Map<string, CharacterProfileSnapshot>()
  if (ocids.length === 0) {
    return profiles
  }

  const db = await getBossProfitDb()
  const placeholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM character_profiles WHERE ocid IN (${placeholders})`,
    [...ocids],
  )

  for (const row of values ?? []) {
    const ocid = row.ocid as string
    profiles.set(ocid, {
      ocid,
      name: row.name as string,
      imageUrl: row.image_url as string,
      // 컬럼이 nullable 이다. 0 이나 빈 문자열로 채우면 모름 이 값으로 둔갑한다.
      world: (row.world as string | null | undefined) ?? null,
      level: (row.level as number | null | undefined) ?? null,
      updatedAt: row.updated_at as string,
    })
  }
  return profiles
}
