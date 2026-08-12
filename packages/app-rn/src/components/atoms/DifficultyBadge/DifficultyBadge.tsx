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
import { Text, type TextStyle, type ViewStyle } from 'react-native'

import { LinearGradient } from '../../../lib/nativewind-interop'

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

export function DifficultyBadge(props: { difficulty: BossDifficulty }): React.JSX.Element {
  const style = DIFFICULTY_BADGE_STYLES[props.difficulty]

  return (
    <LinearGradient
      colors={style.gradient}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="h-5 flex-row items-center rounded-full px-2.5"
      style={style.border}
    >
      <Text className="text-[10px] font-extrabold tracking-[.03em]" style={style.text}>
        {props.difficulty}
      </Text>
    </LinearGradient>
  )
}
