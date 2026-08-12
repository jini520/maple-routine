/**
 * className 으로 낼 수 없어 **스타일 값으로 남는** 글자 속성.
 *
 * ## `tabular-nums`
 *
 * 웹은 `tabular-nums` 한 클래스로 숫자 폭을 고정한다(`font-variant-numeric`). NativeWind 는 그
 * 클래스를 **아무 스타일도 없이 통과시킨다**(실측 2026-08-12 — 렌더 트리에 `fontVariant` 가 없다).
 * RN 에는 짝이 되는 스타일(`fontVariant`)이 있으므로 없는 기능이 아니라 **매핑이 없는 것**이고,
 * 그래서 클래스를 지우는 대신 여기서 값으로 준다.
 *
 * 지키는 것은 폭이다 — 이 속성이 빠지면 `1` ↔ `6` 처럼 자릿수가 같은 값에서도 글리프 폭이 달라
 * 스테퍼의 −/+ 가 흔들리고, 금액이 카운트업으로 굴러가는 자리([[ADR-087]])는 매 프레임 폭이 변한다.
 * **에러가 나지 않는 종류의 실패**라 쓰는 자리마다 이 상수를 통과시킨다.
 */
import type { TextStyle } from 'react-native'

export const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] }
