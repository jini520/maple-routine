/**
 * className 으로 낼 수 없어 **스타일 값으로 남는** 글자 속성.
 *
 * ## `tabular-nums`
 *
 * 웹은 `tabular-nums` 한 클래스로 숫자 폭을 고정한다(`font-variant-numeric`). NativeWind 는 그
 * 클래스를 **아무 스타일도 없이 통과시킨다**(실측 2026-08-12. 렌더 트리에 `fontVariant` 가 없다).
 * RN 에는 짝이 되는 스타일(`fontVariant`)이 있으므로 없는 기능이 아니라 **매핑이 없는 것**이고,
 * 그래서 클래스를 지우는 대신 여기서 값으로 준다.
 *
 * 지키는 것은 폭이다. 이 속성이 빠지면 `1` ↔ `6` 처럼 자릿수가 같은 값에서도 글리프 폭이 달라
 * 스테퍼의 −/+ 가 흔들리고, 금액이 카운트업으로 굴러가는 자리는 매 프레임 폭이 변한다.
 * **에러가 나지 않는 종류의 실패**라 쓰는 자리마다 이 상수를 통과시킨다.
 */
import type { TextStyle } from 'react-native'

export const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] }

/**
 * 일러스트 위 글자의 **가독성 스크림**
 *
 *
 * 테마 토큰이 아니라 검정 고정인 이유는 core 쪽 주석이 갖는다. 무슨 그림이 깔리든 글자가 읽혀야
 * 하므로 `shadow-color`(elevation 용)로 바꾸면 밝은 일러스트 위에서 묻힌다.
 *
 * **웹은 그림자를 둘 겹쳤지만 RN 의 `Text` 는 `textShadow*` 세 프롭으로 하나만 표현할 수 있어**
 * 강한 쪽(`0 1px 3px rgba(0,0,0,.9)`)을 남긴다. 여기 있는 이유는 쓰는 자리가 셋이기 때문이다.
 * 파티 인원 모달 히어로 + 일간 카드 + 주간 카드(의 "호출부 2곳 이상").
 */
export const ILLUSTRATION_TEXT_SHADOW_STYLE: TextStyle = {
  textShadowColor: 'rgba(0,0,0,0.9)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
}
