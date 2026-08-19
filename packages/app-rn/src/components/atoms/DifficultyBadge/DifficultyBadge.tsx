// 난이도 뱃지 — 게임 안의 난이도 색을 그대로 쓰는 캡슐. 값(그라디언트·테두리·글자색·그림자)은
// 웹의 `DIFFICULTY_BADGE_STYLES` 를 **한 색도 바꾸지 않고** 옮겼다.
//
// ── RN 으로 옮기며 바뀐 것 ────────────────────────────────────────────────────────
//
// 웹은 이 전부를 `<span>` 하나의 CSS 로 냈다(`background: linear-gradient(...)` · `border` 축약 ·
// `textShadow`). RN 에는 배경 그라디언트가 없어 상자가 `expo-linear-gradient` 의 `LinearGradient`
// 가 되고, 글자 스타일이 상속되지 않으므로(`Button/variants.ts` 참고) 글자가 안쪽 `Text` 로
// 내려온다 — **요소가 하나에서 둘로 늘어난 유일한 atom** 이다.
//
// 값의 변환은 기계적이다.
//   `linear-gradient(180deg, A, B)` → `colors={[A, B]}` + `start`/`end` 세로(둘 다 명시 — 기본값에
//                                     기대지 않는다, 뒤집히면 그림이 조용히 달라진다)
//   `border: 1px solid X`          → `borderWidth: 1` + `borderColor: X`
//   `textShadow: 0 1px 1px rgba()` → `textShadowOffset`/`textShadowRadius`/`textShadowColor`
//   `height: 20px` `padding: 0 10px` → `h-5` `px-2.5` (같은 값의 유틸리티. 웹이 인라인 style 로 둔
//                                     것은 뱃지 자체가 style 표를 이미 받고 있어서였다)
//
// `inline-flex` 는 RN 에 없다 — 이 뱃지는 부모가 잡아 주는 줄 안에 놓이므로 `flex-row items-center`
// 로 안쪽 정렬만 옮긴다(줄 안에서의 배치는 호출부 몫이고, 웹에서도 그랬다).
import type { BossDifficulty } from '@core/types'
import { type TextStyle, type ViewStyle } from 'react-native'

import { LinearGradient } from '../../../lib/nativewind-interop'
import { Text } from '../Text/Text'

interface DifficultyBadgeStyle {
  /** 위 → 아래. 웹의 `linear-gradient(180deg, …)` 와 같은 순서다. */
  gradient: readonly [string, string]
  border: Pick<ViewStyle, 'borderWidth' | 'borderColor'>
  /** 글자색 + (있으면) 그림자. 그림자가 없는 난이도는 아예 키를 두지 않는다. */
  text: TextStyle
}

/** `0 1px 1px rgba(0,0,0,α)` — 웹 그림자 셋이 색만 다르고 오프셋·번짐이 같다. */
function dropShadow(color: string): TextStyle {
  return { textShadowColor: color, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }
}

const DIFFICULTY_BADGE_STYLES: Record<BossDifficulty, DifficultyBadgeStyle> = {
  이지: {
    gradient: ['#aab4bc', '#7d8891'],
    border: { borderWidth: 1, borderColor: '#67717a' },
    text: { color: '#f5f6f7', ...dropShadow('rgba(0,0,0,0.3)') },
  },
  노멀: {
    gradient: ['#5cc2dd', '#2b93b0'],
    border: { borderWidth: 1, borderColor: '#1f7690' },
    text: { color: '#ffffff', ...dropShadow('rgba(0,0,0,0.25)') },
  },
  하드: {
    gradient: ['#e784a6', '#c04b74'],
    border: { borderWidth: 1, borderColor: '#9c3a5c' },
    text: { color: '#ffffff', ...dropShadow('rgba(0,0,0,0.25)') },
  },
  카오스: {
    gradient: ['#3c3c3c', '#221f1f'],
    border: { borderWidth: 1, borderColor: '#caa87f' },
    text: { color: '#f0d8b8' },
  },
  익스트림: {
    gradient: ['#3c3c3c', '#1c1414'],
    border: { borderWidth: 1.5, borderColor: '#ef5d78' },
    text: { color: '#f4794f' },
  },
}

/**
 * 크기 둘 — **색은 한 값도 안 갈린다**([[ADR-147]] 정정 40).
 *
 * `'small'` 은 today 아코디언처럼 **이름과 한 줄에 서는** 자리를 위한 것이다. 20px 배지가 줄 높이를
 * 혼자 정해 버려 목록이 성기게 보였다. 색·테두리·그림자를 함께 줄이지 않는 이유는 그 표가 웹에서
 * 그대로 옮겨 온 값이고, **같은 난이도가 화면마다 다른 색이면 같은 값인 줄 모르기** 때문이다.
 */
const SIZE = {
  default: { box: 'h-5 px-2.5', text: 'text-[10px]' },
  small: { box: 'h-4 px-1.5', text: 'text-[9px]' },
} as const

export function DifficultyBadge(props: {
  difficulty: BossDifficulty
  size?: keyof typeof SIZE
}): React.JSX.Element {
  const style = DIFFICULTY_BADGE_STYLES[props.difficulty]
  const size = SIZE[props.size ?? 'default']

  return (
    <LinearGradient
      colors={style.gradient}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className={`flex-row items-center rounded-full ${size.box}`}
      style={style.border}
    >
      {/* 상자가 `h-5`/`h-4` 로 **고정**이라 글자만 커지면 잘린다 — 시스템 글자 크기를 안 따르는
          자리다([[ADR-152]] 결정 5). 배지의 크기 둘은 [[ADR-147]] 정정 40 이 정한 값이다. */}
      <Text fixed className={`font-extrabold tracking-[.03em] ${size.text}`} style={style.text}>
        {props.difficulty}
      </Text>
    </LinearGradient>
  )
}
