/**
 * 캐릭터마다의 메이플 ID 와 메이플 ID 의 차례를 읽는 훅. 읽기 전에는 `null` 이다.
 *
 * 추적 목록이 바뀌면 다시 읽는다. 부계정 캐릭터를 더하면 그 소속이 목록과 함께 생긴다.
 *
 * @example
 * const mapleIds = useMapleIdOwners(orderedOcids)
 */
import { useEffect, useState } from 'react'

import { loadMapleIdOwners, type MapleIdOwners } from '../features/maple-id/owners'

export function useMapleIdOwners(trackedOcids: readonly string[]): MapleIdOwners | null {
  const [owners, setOwners] = useState<MapleIdOwners | null>(null)
  // 의존성 배열에 배열을 그대로 넣으면 렌더마다 새 배열이라 끝없이 다시 읽는다. 내용으로 견준다.
  const ocidsKey = trackedOcids.join(',')

  useEffect(() => {
    let alive = true
    loadMapleIdOwners(ocidsKey === '' ? [] : ocidsKey.split(',')).then(
      (next) => {
        if (alive) setOwners(next)
      },
      // 못 읽으면 직전 값을 둔다. 위젯은 메이플 ID 를 가르지 않은 모양으로 선다.
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [ocidsKey])

  return owners
}
