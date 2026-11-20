/**
 * 사용자가 바꾼 메이플 ID 이름. 계정 관리의 상세 페이지가 바꾸고, 메이플 ID 를 보여 주는 화면이 모두 읽는다.
 *
 * 바꾼 이름만 든다. 기본 이름은 `mapleIdNameOf` 가 그릴 때 짓는다.
 */
import { useCallback } from 'react'
import { create } from 'zustand'

import { mapleIdNameOf } from '../../lib/maple-id-name'
import { getMapleIdNames, setMapleIdNames } from '../../storage/maple-id-names'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

/** 사용자가 짓는 이름의 최대 바이트(한글 8자 · 영문 16자). 가장 좁은 폭의 위젯 드롭다운 버튼에 들어가는 길이다 */
export const MAPLE_ID_NAME_MAX_BYTES = 16

export interface MapleIdNamesStore {
  /** 메이플 ID → 사용자가 바꾼 이름 */
  names: Readonly<Record<string, string>>
  restoreFromStorage(): Promise<void>
  /**
   * 고친 이름을 저장한다. 앞뒤 공백을 떼고, 빈 칸이면 저장한 이름을 지워 기본 이름으로 돌아간다.
   *
   * @param changes 메이플 ID → 칸에 적힌 이름. 넘기지 않은 메이플 ID 는 그대로다
   */
  save(changes: Readonly<Record<string, string>>): Promise<void>
}

export const useMapleIdNamesStore = create<MapleIdNamesStore>()((set, get) => ({
  names: {},

  async restoreFromStorage() {
    const saved = await getMapleIdNames().catch(() => ({}))
    set({ names: saved })
  },

  async save(changes) {
    const names: Record<string, string> = { ...get().names }
    for (const [mapleId, typed] of Object.entries(changes)) {
      const name = typed.trim()
      if (name === '') delete names[mapleId]
      else names[mapleId] = name
    }
    await setMapleIdNames(names)
    set({ names })
    // 가계부 · 통계의 줄은 읽을 때 이름을 박아 둔다. 다시 읽지 않으면 옛 이름이 남는다.
    void queryClient.invalidateQueries({ queryKey: queryKeys.allLedgerDays() })
  },
}))

/**
 * 메이플 ID 의 이름을 짓는 함수를 돌려주는 훅. 이름을 바꾸면 이 훅을 쓰는 화면이 다시 그린다.
 *
 * @example
 * const nameOf = useMapleIdNameOf()
 * <Text>{nameOf(account.accountId)}</Text>
 */
export function useMapleIdNameOf(): (accountId: string) => string {
  const names = useMapleIdNamesStore((state) => state.names)
  return useCallback((accountId: string) => mapleIdNameOf(accountId, names), [names])
}
