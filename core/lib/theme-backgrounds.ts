/**
 * 테마 배경 이미지 에셋 해석 ([[ADR-088]] 결정 3).
 *
 * `job-themes.json` 은 번들 경로가 아니라 **슬러그**만 적는다(`"image": "hontail-background"`) —
 * 파일을 `packages/core/src/assets/themes/` 에 넣고 슬러그를 적으면 붙는다. 목록은 커밋 시점에
 * 생성돼 있고([[ADR-129]]) 해석 방식은 일일 퀘스트 지역 배경(`lib/daily-quest-backgrounds.ts`)과
 * 같다. 확장자가 섞일 수 있는 것과 macOS 한글 파일명 NFD 문제도 같은 이유로 같은 처리를 한다.
 */

import { THEME_BACKGROUND_ASSETS } from '../assets/generated/themes'
import type { ImageAssetRef } from '../types/image-asset'

/** 슬러그에 해당하는 파일이 없으면 `null` — 배경만 사라지고 테마는 그대로 산다. */
export function getThemeBackgroundUrl(slug: string): ImageAssetRef | null {
  return THEME_BACKGROUND_ASSETS[slug.normalize('NFC')] ?? null
}
