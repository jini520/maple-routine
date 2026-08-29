/**
 * 사냥 계산기가 쓰는 **메소 획득량**의 오케스트레이션([[ADR-177]] 결정 7·9).
 *
 * 화면은 `nexon/` 도 `storage/` 도 직접 안 부른다(CLAUDE.md CRITICAL · [[ADR-003]]·[[ADR-005]]).
 * 여기서 하는 일은 셋이다 — **키를 꺼내고 · 다섯을 부르고 · 성공하면 캐시에 남긴다**.
 *
 * **부르는 계기는 시트에서 캐릭터를 고를 때 하나**다([[ADR-175]] 결정 9 가 레벨을 갈아 끼우는
 * 그 자리). 수정으로 열 때는 **안 부른다** — 그 행에 적힌 그때의 값이 있고, 지금 값으로 다시
 * 재면 옛 기록의 금액이 열 때마다 달라진다(결정 8).
 */
import { fetchMesoRate } from '../../nexon/meso-rate'
import { getAuthConfig } from '../../storage/api-key'
import { getCachedMesoRate, setCachedMesoRate } from '../../storage/meso-rate-cache'

/**
 * 읽었나 못 읽었나 — 화면이 **줄의 모양을 가르는** 값이다.
 *
 * `read` 면 자동값이라 못 치고, `fallback` 이면 치는 칸이 되며 `percent` 는 그 칸의 기본값
 * (마지막 성공값, 없으면 `null` 이라 빈 칸)이다. **`read` 의 0 과 `fallback` 의 0 은 다르다** —
 * 앞은 «메획을 안 두른 캐릭터» 이고 뒤는 «못 읽었으니 사람이 적어라» 다.
 */
export type MesoRateLoad =
  | { kind: 'read'; percent: number }
  | { kind: 'fallback'; percent: number | null }

export async function loadMesoRate(ocid: string): Promise<MesoRateLoad> {
  const auth = await getAuthConfig()
  // 키가 없으면 **부르지도 않는다** — 401 을 만들면 그 사슬이 저장된 키를 지운다([[ADR-116]] 결정 1).
  if (auth === null) return { kind: 'fallback', percent: await getCachedMesoRate(ocid) }

  try {
    const percent = await fetchMesoRate(auth.apiKey, ocid)
    // 캐시 쓰기 실패로 **읽은 값을 버리지 않는다** — 캐시는 폴백의 기본값일 뿐이다.
    await setCachedMesoRate(ocid, percent).catch(() => undefined)
    return { kind: 'read', percent }
  } catch {
    // 실패한 값으로 캐시를 덮지 않는다 — 마지막 성공값이 사라지면 폴백 칸이 빈다.
    return { kind: 'fallback', percent: await getCachedMesoRate(ocid) }
  }
}
