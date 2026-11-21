/**
 * 보스 표. 우리 서버 `GET /v1/game-data` 의 `bosses` 칸이고, 기기 사본과 테스트 fixture 도 같은 모양이다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 한쪽만 바꾸면 타입 검사가 못 잡으므로
 * 필드를 더할 때 양쪽을 함께 볼 것.
 */
import type { BossDifficulty } from './scheduler'

/** 난이도 줄의 주기. 시즌 보스도 주간이고, 시즌 여부는 보스 줄의 `isSeasonBoss` 가 든다. */
export const BOSS_CATALOG_CYCLES = ['weekly', 'monthly'] as const
export type BossCatalogCycle = (typeof BOSS_CATALOG_CYCLES)[number]

export interface BossRow {
  id: string
  /** 보스 key. 기기 기록이 이 값을 든다. */
  key: string
  /** Nexon API `content_name` 표기. 화면에 보이는 이름이다. */
  name: string
  /** 좁은 자리의 이름. */
  shortName: string
  /** 시즌 보스는 주간 12마리 한도와 결정석 판매 수에서 빠진다. */
  isSeasonBoss: boolean
  /** 초상 그림 id(`assets` 칸). 크롭도 이 id 로 찾는다. */
  portraitAssetId: string
  /** 유효 기간. KST `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm`. 없으면 처음부터 · 끝없이. 시즌 보스가 끝을 든다. */
  validFrom?: string
  validUntil?: string
}

/** 보스 난이도 한 줄. 한 보스의 줄 차례가 곧 난이도 정렬 순서다. */
export interface BossDifficultyRow {
  id: string
  bossId: string
  difficulty: BossDifficulty
  cycle: BossCatalogCycle
  requiredLevel: number
  /** 파티 인원 상한. 없으면 `gameRules` 칸의 `defaultMaxPartySize` 다. 스우 익스트림 2 · 메이린 1 같은 예외만 든다. */
  maxPartySize?: number
  /** 난이도의 유효 기간. 없으면 보스의 기간 그대로. 새로 생긴 난이도가 시작을 든다. */
  validFrom?: string
  validUntil?: string
}

export interface BossCatalog {
  /** 서버가 가장 최근에 넣은 시각. `null` 은 서버에서 받은 적이 없는 사본이다. */
  updatedAt: string | null
  /** 배열의 차례가 곧 앱 전체의 보스 순서다. */
  bosses: BossRow[]
  bossDifficulties: BossDifficultyRow[]
}
