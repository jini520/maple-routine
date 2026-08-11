// 톤 배지 atom — `bg-*-tint` 배경 위에 `text-*-ink` 글자를 얹는 캡슐형 라벨.
//
// **처음에는 만들지 않기로 했다가 되돌린 결정이다**([[ADR-094]] 결정 3 정정 → 재정정).
// 첫 실측에서 "15곳에 고유 변형 12종"으로 보여 근거 미달로 뺐는데, 그때는 `ml-auto`
// `tabular-nums` `shrink-0` `inline-block` 같은 **레이아웃 유틸까지 조합에 포함**해 센 것이었다.
// 그것들을 걷어내고 외형만 보면 조합이 10종으로 줄고, 그중 둘이 각각 3곳으로 당시 세운
// 기준("같은 조합이 3곳 이상 반복되면 그때 만든다")을 통과한다.
//
// **좁게 만든다** — 이 atom 이 덮는 것은 `*-tint`/`*-ink` 쌍을 `px-2.5 py-1 font-semibold` 로
// 쓰는 6곳뿐이다. 두께가 다르거나(`font-bold` 1곳) 토큰 쌍이 아닌 것(`bg-surface-2` 위의
// `text-text`·`text-text-muted`)은 각각 1~2곳이라 인라인으로 남긴다. 그것까지 프롭으로 삼키면
// 결정 1이 경계한 "호출부마다 예외"가 된다.

const TONE_CLASS = {
  primary: 'bg-primary-tint text-primary-ink',
  third: 'bg-third-tint text-third-ink',
} as const

export type BadgeTone = keyof typeof TONE_CLASS

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone
}

export function Badge({ tone, className, ...rest }: BadgeProps): React.JSX.Element {
  // 라운딩이 pill 로 고정인 것은 디자인 원칙 2(성격별 라운딩 차등 — 카드 14px · 배지 pill)를
  // 지키기 위해서다. 레이아웃(`ml-auto` `tabular-nums` 등)은 Button·Card 와 같은 기준으로
  // 호출부가 소유한다.
  const base = `rounded-full ${TONE_CLASS[tone]} px-2.5 py-1 text-xs font-semibold`
  return <span className={className === undefined ? base : `${base} ${className}`} {...rest} />
}
