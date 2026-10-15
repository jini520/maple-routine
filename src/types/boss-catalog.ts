/**
 * 보스 표. 우리 서버 `GET /v1/bosses` 의 응답이고, 번들 `src/data/bosses.json` 과 기기 사본도 같은 모양이다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 한쪽만 바꾸면 타입 검사가 못 잡으므로
 * 필드를 더할 때 양쪽을 함께 볼 것.
 */
import type { BossDifficulty } from './scheduler'

/** 보스의 주기. `event_weekly` 는 시즌 보스라 주간 12마리 한도에서 빠진다. */
export const BOSS_CATALOG_CYCLES = ['weekly', 'event_weekly', 'monthly'] as const
export type BossCatalogCycle = (typeof BOSS_CATALOG_CYCLES)[number]

export interface BossCatalogDifficulty {
  difficulty: BossDifficulty
  requiredLevel: number
}

export interface BossCatalogBoss {
  /** 보스 key. 기기 기록이 이 값을 든다. */
  key: string
  /** Nexon API `content_name` 표기. 화면에 보이는 이름이다. */
  name: string
  /** 좁은 자리의 이름. */
  alias: string
  cycle: BossCatalogCycle
  /** `assets/bosses/{portraitSlug}.webp` 의 파일명. */
  portraitSlug: string
  /** 줄의 차례가 곧 난이도 정렬 순서다. */
  difficulties: BossCatalogDifficulty[]
}

export interface BossCatalogRules {
  /** 캐릭터당 주간 보스 등록 · 처치 한도. */
  weeklyBossSelectionLimit: number
  /** 월드당 주간 결정석 판매 한도. */
  weeklyCrystalSaleLimit: number
}

export interface BossCatalog {
  /** 서버가 가장 최근에 넣은 시각. `null` 은 서버에서 받은 적이 없는 사본이다. */
  updatedAt: string | null
  rules: BossCatalogRules
  /** 배열의 차례가 곧 앱 전체의 보스 순서다. */
  bosses: BossCatalogBoss[]
}
