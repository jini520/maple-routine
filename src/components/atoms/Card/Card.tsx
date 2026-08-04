// 카드 atom — `design-system.md` 「기본 컴포넌트」절의 카드 정의를 코드로 승격한 것
// (ADR-094 결정 3). 실측(2026-08-05)에서 `rounded-[14px]` 를 쓰는 21곳의 **공통 토큰이
// 정확히 이 넷**이었다.
//
// 코어가 얇아 보이지만 `rounded-[14px]` 를 한곳에 모으는 것이 요점이다 — 디자인 원칙 2가
// "컴포넌트 성격별로 라운딩을 다르게"(카드 14px · 버튼 pill · 인풋 10px)라고 정해 뒀는데,
// 21곳에 흩어진 값은 조용히 어긋난다.
//
// 여백(`p-6`·`px-6`)·간격(`space-y-*`·`divide-y`)·미디어 클리핑(`media-scope relative h-20
// overflow-hidden`)은 **레이아웃이라 호출부에 남긴다** — Button 과 같은 기준이다.

const CARD_CLASS = 'rounded-[14px] border border-border bg-surface'

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...rest }: CardProps): React.JSX.Element {
  return (
    <div className={className === undefined ? CARD_CLASS : `${CARD_CLASS} ${className}`} {...rest} />
  )
}
