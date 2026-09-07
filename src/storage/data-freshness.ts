/**
 * 페이지별 마지막 데이터 호출 시각.
 *
 * **영속한다.** 앱을 다시 켜도 화면이 그리는 것은 캐시에 있던 그 데이터인데, 시각만 비우면
 * 그 데이터가 언제 것인지 말할 방법이 사라진다.
 *
 * 한 칸에 맵으로 적는다. 읽는 쪽이 언제나 다섯을 한 번에 필요로 한다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 당김을 가진 화면 다섯. 늘어나면 여기부터 늘린다. */
export const FRESHNESS_PAGES = ['today', 'content', 'boss', 'profit', 'cashbook'] as const

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
