/**
 * 내비게이터 밖에서 연 계정 관리. 429 모달 · 무효 키 모달은 내비게이터 밖에 떠서 화면을 밀 수 없어, 요청을 두면 내비게이션이 밀고
 * 비운다.
 */
import { create } from 'zustand'

import { getAuthConfig } from '../../storage/api-key'

export interface AccountManageOpenRequest {
  /** 열 계정의 상세. `null` 이면 목록을 연다 */
  accountKey: string | null
  /** 열자마자 `API 키 변경` 시트를 띄운다 */
  openKeySheet: boolean
}

interface AccountManageOpenState {
  request: AccountManageOpenRequest | null
  open: (request: AccountManageOpenRequest) => void
  clear: () => void
}

export const useAccountManageOpenStore = create<AccountManageOpenState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  clear: () => set({ request: null }),
}))

/** 저장된 키의 계정 상세 `key`(넥슨 계정 id). 저장된 키가 아니면 `null`. */
export async function accountKeyOfApiKey(apiKey: string): Promise<string | null> {
  const config = await getAuthConfig().catch(() => null)
  return config?.apiKeys.find((one) => one.value === apiKey)?.id ?? null
}
