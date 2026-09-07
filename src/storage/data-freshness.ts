/**
 * 마지막 데이터 호출 시각. **여기 적는 페이지는 자기 데이터에 시각이 없는 것뿐이다.**
 *
 * 스케줄러 캐시의 `syncedAt` 은 조회가 **실제로 돈 회차**에만 적히고 영속된다. 그 값을 가진
 * 페이지는 여기 안 적고 그것을 읽는다. 화면이 자기 시계로 지금 을 적으면 TTL 에 막혀 한 번도
 * 안 나간 진입에도 시각이 갱신되어, 같은 조회로 그린 데이터인데 페이지마다 값이 갈린다.
 *
 * 남는 것이 가계부 하나다. 그 화면의 데이터는 원장 층에서 오는데 그 층이 조회 시각을 안 든다.
 *
 * **영속한다.** 앱을 다시 켜도 화면이 그리는 것은 캐시에 있던 그 데이터인데, 시각만 비우면
 * 그 데이터가 언제 것인지 말할 방법이 사라진다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 여기 적는 페이지. 자기 데이터에 시각이 없는 것만 든다. */
export const FRESHNESS_PAGES = ['cashbook'] as const

export type FreshnessPage = (typeof FRESHNESS_PAGES)[number]

export type FreshnessMap = Readonly<Partial<Record<FreshnessPage, string>>>

const PAGES: readonly string[] = FRESHNESS_PAGES

/** 저장된 것이 없거나 깨졌으면 빈 맵. 모르는 키와 문자열 아닌 값은 버린다. */
export async function getDataFetchedAt(): Promise<FreshnessMap> {
  const raw = await preferences.get(STORAGE_KEYS.dataFetchedAt)
  if (raw === null) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([page, at]) => PAGES.includes(page) && typeof at === 'string',
      ),
    ) as FreshnessMap
  } catch {
    // 깨진 값 때문에 화면이 서지 않느니 줄 하나를 안 그리는 편이 낫다.
    return {}
  }
}

/** 한 페이지의 시각을 적는다. 나머지 페이지는 그대로 둔다. */
export async function setDataFetchedAt(page: FreshnessPage, fetchedAt: string): Promise<void> {
  const next = { ...(await getDataFetchedAt()), [page]: fetchedAt }
  await preferences.set(STORAGE_KEYS.dataFetchedAt, JSON.stringify(next))
}
