import type { BossDifficulty } from '../../../types'
import { Pressable, View } from 'react-native'

import { Badge } from '../../atoms/Badge/Badge'

// 난이도 세그먼트 — 보스 관리 페이지 행과 파티 인원 모달이 공유한다(ADR-121 결정 4).
//
// 미선택은 **같은 뱃지 + opacity-40** 이다. 색 없는 고스트 칩(2026-07-24)으로 갔다가 되돌아온
// 것이고, 근거는 "메이플 유저는 난이도를 색과 실루엣으로 안다"는 판단이다 — 흐린 뱃지 안 글자
// 대비는 1.43~3.15로 낮지만(6테마 실측) 이 화면의 이 요소에 한정해 감수한다. opacity는
// 스크린리더에 영향이 없어 글자와 선택 상태는 그대로 전달된다.
//
// 흐림은 버튼에 건다(뱃지가 아니라) — 뱃지는 게임 UI 고정 색을 그리는 일만 하고, "선택 안 됨"은
// 세그먼트의 상태이기 때문이다.
//
// ── RN 으로 옮기며 바뀐 것 셋 ─────────────────────────────────────────────────────
//
// ① **`aria-pressed` → `aria-selected`.** RN 의 접근성 상태에는 *pressed* 가 없다(`selected`·
//    `checked`·`disabled`·`busy`·`expanded`). 토글 버튼의 선택 여부를 담을 수 있는 것은 `selected`
//    뿐이라 그리로 옮긴다 — **전달되는 사실은 같다**(이 난이도가 지금 골라져 있는가).
// ② `border-0 p-0 leading-none` 을 뺐다. 웹 `<button>` 의 UA 기본값을 지우는 리셋이고 RN 의
//    `Pressable` 에는 그 기본값이 없다 — 남겨 두면 "무엇을 지우는지" 없는 코드가 된다.
// ③ `inline-flex` → 없음, `flex flex-wrap` → `flex-row flex-wrap`(RN 기본 방향이 column 이다).
export function DifficultySegment(props: {
  difficulties: BossDifficulty[]
  selected: BossDifficulty | null
  onSelect: (difficulty: BossDifficulty) => void
  /** 자동 모드에서 난이도를 못 바꾸는 자리처럼, 표시만 하고 편집을 막을 때. */
  disabled?: boolean
}): React.JSX.Element {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {props.difficulties.map((difficulty) => {
        const isSelected = props.selected === difficulty
        return (
          <Pressable
            key={difficulty}
            role="button"
            aria-selected={isSelected}
            disabled={props.disabled === true}
            // 이미 선택된 것을 다시 눌러도 아무 일이 없어야 한다 — 수동 모드에서는 이 호출이
            // 멤버십 쓰기로 이어지므로, 같은 값으로 저장소를 건드리지 않는다.
            onPress={() => {
              if (!isSelected) props.onSelect(difficulty)
            }}
            className={`rounded-full${isSelected ? '' : ' opacity-40'}`}
          >
            <Badge variant={difficulty}>
              {difficulty}
            </Badge>
          </Pressable>
        )
      })}
    </View>
  )
}
