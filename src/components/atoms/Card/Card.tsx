// 카드 atom — `design-system.md` `기본 컴포넌트`절의 카드 정의를 코드로 승격한 것
// . 실측(2026-08-05)에서 `rounded-[14px]` 를 쓰는 21곳의 **공통 토큰이
// 정확히 이 넷**이었다.
//
// 코어가 얇아 보이지만 `rounded-[14px]` 를 한곳에 모으는 것이 요점이다 — 디자인 원칙 2가
// "컴포넌트 성격별로 라운딩을 다르게"(카드 14px · 버튼 pill · 인풋 10px)라고 정해 뒀는데,
// 21곳에 흩어진 값은 조용히 어긋난다.
//
// 여백(`p-6`·`px-6`)·간격·미디어 클리핑(`media-scope relative h-20 overflow-hidden`)은
// **레이아웃이라 호출부에 남긴다** — Button 과 같은 기준이다.
//
// RN 으로 옮기며 바뀐 것은 `<div>` → `<View>` 뿐이고 클래스 문자열은 그대로다. 웹에서 붙던
// `space-y-*`·`divide-y` 같은 자식 간격 유틸은 NativeWind 에 없으므로(형제 선택자가 필요하다)
// 그 자리를 쓰던 호출부는 step 4~6 에서 `gap-*` 로 바꾼다 — 카드가 아니라 호출부의 일이다.
import { View, type ViewProps } from 'react-native'

const CARD_CLASS = 'rounded-[14px] border border-border bg-surface'

export type CardProps = ViewProps

export function Card({ className, ...rest }: CardProps): React.JSX.Element {
  return (
    <View className={className === undefined ? CARD_CLASS : `${CARD_CLASS} ${className}`} {...rest} />
  )
}
