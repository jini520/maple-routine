/**
 * 온보딩 MVP 등급 화면 둘(고르기 · 확인)이 함께 드는 고르던 값. 두 화면이 스택의 다른 자리라 컴포넌트 상태로는 못 나눈다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { create } from 'zustand'

import type { MvpGradeKey } from '../../lib/mvp/grades'

interface MvpOnboardingDraftState {
  grades: Record<string, MvpGradeKey>
  /** ID 마다 적용 시작 주(목요일) */
  starts: Record<string, string>
  weeklyOff: boolean
  /** 어느 ID 들로 채웠나. 같은 ID 들이면 다시 채우지 않아 뒤로 갔다 와도 고르던 값이 남는다 */
  seededFor: string | null
  /** 처음 고르는 값. 등급은 일반, 시작 주는 이번 주, 직접 바꾸기는 저장된 값 */
  seed: (accountIds: readonly string[], thisWeek: string, weeklyOff: boolean) => void
  setGrade: (accountId: string, grade: MvpGradeKey) => void
  setStart: (accountId: string, week: string) => void
  setWeeklyOff: (weeklyOff: boolean) => void
}

export const useMvpOnboardingDraft = create<MvpOnboardingDraftState>()((set, get) => ({
  grades: {},
  starts: {},
  weeklyOff: false,
  seededFor: null,
  seed(accountIds, thisWeek, weeklyOff) {
    const key = accountIds.join(',')
    if (get().seededFor === key) return
    set({
      seededFor: key,
      grades: Object.fromEntries(accountIds.map((id) => [id, 'normal' as const])),
      starts: Object.fromEntries(accountIds.map((id) => [id, thisWeek])),
      weeklyOff,
    })
  },
  setGrade(accountId, grade) {
    set({ grades: { ...get().grades, [accountId]: grade } })
  },
  setStart(accountId, week) {
    set({ starts: { ...get().starts, [accountId]: week } })
  },
  setWeeklyOff(weeklyOff) {
    set({ weeklyOff })
  },
}))
