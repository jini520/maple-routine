// 고가 아이템 드롭 연출 프레임(ADR-038). 검은배경 최적화본(`packages/core/src/assets/drop-effect/*`)의
// 목록은 커밋 시점에 생성돼 있고([[ADR-129]]) **숫자 순으로 정렬돼 있다**(파일명 렉시코 정렬 함정
// 방지: 10 < 2). 정렬은 생성기가 하므로 여기서 다시 하지 않는다.
//
// 확장자를 둘 다 받는다 — 프레임은 JPEG 였다가 WebP 로 바꿨고([[ADR-093]] 결정 2 정정),
// 정렬 기준인 앞자리 숫자는 확장자와 무관하다.

import { DROP_EFFECT_ASSETS } from '../assets/generated/drop-effect'
import type { ImageAssetRef } from '../types/image-asset'
import type { DropEffectPhase } from './drop-effect-layout'

export const DROP_EFFECT_FRAMES: Record<DropEffectPhase | 'screen', ImageAssetRef[]> =
  DROP_EFFECT_ASSETS
