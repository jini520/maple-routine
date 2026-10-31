/**
 * 이벤트 월드(스페셜) 캐릭터 이름.
 *
 * 수집기가 `character/list` 에서 받아 남기고, 지출을 읽는 쪽이 그대로 쓴다. 칸 하나 그릴 때마다
 * 계정 목록을 부를 수는 없어서다.
 *
 * 쿼리에는 배열로 든다. 저장기가 JSON 으로 쓰므로 `Set` 은 `{}` 가 되어 다음 실행에 이름이 사라진다.
 *
 * **없는 것과 빈 집합은 다르다.** 앞은 아직 못 받았다는 뜻이라 `null` 이고, 뒤는 스페셜 캐릭터가
 * 없는 계정이라 답이 난 것이다. 앞을 뒤로 읽으면 스페셜 지출이 그대로 샌다.
 */
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

/** 아직 못 받았으면 `null`. 저장된 캐시를 올리기 전에 읽어도 `null` 이다. */
export function readEventWorldNames(): Set<string> | null {
  const names: unknown = queryClient.getQueryData(queryKeys.eventWorldNames())
  return Array.isArray(names) ? new Set(names.map(String)) : null
}

export function saveEventWorldNames(names: ReadonlySet<string>): void {
  queryClient.setQueryData(queryKeys.eventWorldNames(), [...names])
}
