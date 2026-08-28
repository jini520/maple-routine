/**
 * 아케인/어센틱 포스 배지의 그림([[ADR-175]] 결정 10).
 *
 * 어느 그림인지는 **지역이 안다**(`HuntingRegion.forceType`) — 사냥터마다 다시 적지 않는다.
 * 목록은 커밋 시점에 생성돼 있다([[ADR-129]] — `npm run assets:gen`).
 */
import { FORCE_ASSETS } from '../assets/generated/force'
import type { ForceType } from '../types/hunting-grounds'
import type { ImageAssetRef } from '../types/image-asset'

/** 배지에 적히는 이름 — 그림 옆에 글자로도 서야 읽어 주는 이름이 성립한다. */
export const FORCE_LABELS: Record<ForceType, string> = {
  arcane: '아케인 포스',
  authentic: '어센틱 포스',
}

const FORCE_SLUGS: Record<ForceType, string> = {
  arcane: 'arcane-force',
  authentic: 'authentic-force',
}

/**
 * 포스 그림. 없으면 `null` 이고 **배지는 글자만으로 선다** — 비슷한 그림을 갖다 붙이지 않는다
 * ([[ADR-170]] 정정 16 이 지출 타일에 세운 규칙과 같다).
 */
export function forceIconOf(forceType: ForceType): ImageAssetRef | null {
  return FORCE_ASSETS[FORCE_SLUGS[forceType]] ?? null
}
