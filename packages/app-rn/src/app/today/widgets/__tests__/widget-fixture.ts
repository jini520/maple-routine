// 위젯 테스트가 공유하는 **빈 뷰모델**. 테스트 파일이 아니라 보조 파일이라 `*.test.ts` 가 아니고
// (`jest.config.js` 의 `testMatch` 가 이름으로 거른다), `components/__tests__/render-atom.tsx` 와 같은
// 자리에 있다.
//
// 위젯은 스토어를 모르고 `TodayViewModel` 만 받으므로([[ADR-146]] 결정 4) **목이 필요 없다** — 값
// 조합이 곧 테스트 입력이다. 그 이득을 실제로 회수하려면 «전부 빈 상태» 하나가 있어야 하고, 각
// 테스트는 자기가 보는 필드만 덮어쓴다.

import type {
  RepresentativeView,
  ScheduleRowView,
  TodayViewModel,
} from '../../view-model'

export const 빈_뷰모델: TodayViewModel = {
  representative: null,
  schedule: [],
  scheduleTotal: 0,
  profit: { totalMeso: 0, hasRecords: false, topCharacters: [] },
  topItem: null,
  unpricedCount: 0,
  crystalLimits: [],
  drought: null,
  resets: {
    daily: { atMs: 0, remainingMs: 0 },
    weekly: { atMs: 0, remainingMs: 0 },
    monthly: { atMs: 0, remainingMs: 0 },
  },
}

export function 뷰모델(부분: Partial<TodayViewModel>): TodayViewModel {
  return { ...빈_뷰모델, ...부분 }
}

/** 모든 줄이 채워진 대표 캐릭터 — 없는 것을 지우는 테스트가 여기서 하나씩 뺀다. */
export const 대표_캐릭터: RepresentativeView = {
  ocid: 'ocid-대표',
  name: '단풍루틴',
  level: 291,
  imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
  world: '스카니아',
  jobClass: '아크메이지(불,독)',
  guildName: '백호단',
  expRate: 80.3,
}

/** 남은 것이 넷 다 있는 행. 수치는 **서로 다른 값**이라 테스트가 글자로 집을 수 있다. */
export function 스케줄행(부분: Partial<ScheduleRowView> = {}): ScheduleRowView {
  const base: ScheduleRowView = {
    ocid: 'ocid-1',
    characterName: '야간비행',
    imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/one',
    dailyQuest: 4,
    weeklyQuest: 3,
    weeklyBoss: 2,
    monthlyBoss: 1,
    remainingTotal: 10,
    hasSyncIssue: false,
  }
  const merged = { ...base, ...부분 }

  // 합계를 손으로 적게 하면 테스트마다 어긋난다 — 명시적으로 준 경우만 그 값을 쓴다.
  return 부분.remainingTotal === undefined
    ? {
        ...merged,
        remainingTotal:
          merged.dailyQuest + merged.weeklyQuest + merged.weeklyBoss + merged.monthlyBoss,
      }
    : merged
}

/** n명짜리 목록 — 이름·ocid 만 갈린다(스냅샷이 캐릭터 수만 다르게 찍힌다). */
export function 스케줄목록(n: number): ScheduleRowView[] {
  return Array.from({ length: n }, (_, index) =>
    스케줄행({
      ocid: `ocid-${index + 1}`,
      characterName: `캐릭터${index + 1}`,
      imageUrl: `https://open.api.nexon.com/static/maplestory/character/look/${index + 1}`,
    }),
  )
}
