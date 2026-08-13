import worldEmblems from '@core/data/world-emblems.json'

import { WORLD_EMBLEM_ASSETS } from '../assets/generated/worlds'
import type { ImageAssetRef } from '../types/image-asset'

const basenameByWorld = worldEmblems as Record<string, string>

// 한글 월드명 → 엠블럼 이미지. 매핑에 없거나 파일이 없으면 null(폴백: 엠블럼 생략).
export function worldEmblemUrl(world: string): ImageAssetRef | null {
  const basename = basenameByWorld[world]
  if (basename === undefined) return null
  return WORLD_EMBLEM_ASSETS[basename] ?? null
}

// 챌린저스/챌린저스2/챌린저스3/챌린저스4 판정([[ADR-031]]) — world-emblems.json에서 이미
// challengers 엠블럼으로 매핑된 월드 집합을 그대로 재사용해, 새 챌린저스 월드가 생겨도
// 그 파일만 갱신하면 이 판정도 함께 갱신되게 한다.
export function isChallengersWorld(world: string): boolean {
  return basenameByWorld[world] === 'challengers'
}
