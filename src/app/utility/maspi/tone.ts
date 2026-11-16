/**
 * 시세 등락의 색. 오르면 빨강(`rise-ink`) · 내리면 파랑(`fall-ink`) · 같으면 회색이다. 수입 · 지출의 두 색과 같다.
 */
import type { MarketTone } from '../../../features/market/format'
import type { ThemeTokens } from '../../../types/theme'

/** 글자 클래스. */
export const TONE_TEXT: Readonly<Record<MarketTone, string>> = {
  rise: 'text-rise-ink',
  fall: 'text-fall-ink',
  flat: 'text-text-muted',
}

/** 상세 머리의 전일 대비 칩. `Badge` 의 variant 다. */
export const TONE_BADGE = { rise: 'rise', fall: 'fall', flat: 'muted' } as const satisfies Record<MarketTone, string>

/** 꺾은선 색. Skia 는 클래스를 못 읽어 테마의 값을 그대로 준다. */
export function toneColor(tone: MarketTone, theme: Pick<ThemeTokens, 'riseInk' | 'fallInk' | 'textMuted'>): string {
  return tone === 'rise' ? theme.riseInk : tone === 'fall' ? theme.fallInk : theme.textMuted
}
