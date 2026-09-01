// 셸 승계 카드([[ADR-061]] 결정 2) — 로딩이 끝나면 그 자리를 채울 카드와 같은 껍데기를 미리 그린다.
// 결과가 들어와도 배경이 바뀌지 않으므로, 스켈레톤을 도입하지 않고도 "자리를 미리 잡는" 효용을 얻는다.
//   page   — 스케줄러 3화면 콜드 스타트, 컨텐츠·보스 관리 화면 최초 진입(목록 자리 전체)
//   inline — 보스 수익 과거 기간 백필(카드 한 장 자리)
//
// 목록·카드가 들어올 자리에만 쓴다. 모달 안(캐릭터 관리 피커)이나 화면 전체 대기(온보딩 시드·예열)는
// 이미 자기 껍데기가 있거나 뒤에 카드가 오지 않으므로 카드 없이 스피너 + 문구만 둔다.
// 캐시가 남아 있는 재검증(SWR) 중에도 쓰지 않는다 — 기존 내용을 가리지 않는다([[ADR-016]]).
//
// ── RN 으로 옮기며 바뀐 것 셋 ─────────────────────────────────────────────────────
//
// ① 껍데기가 `Card` atom 이 됐다. 웹은 같은 네 유틸리티(`rounded-[14px] border border-border
//    bg-surface`)를 인라인으로 적었는데, 그것이 정확히 `Card` 가 한곳에 모으기로 한 값이다
//    ([[ADR-094]] 결정 3). 나오는 클래스 집합이 같으므로 모습이 바뀌지 않는다.
// ② `flex flex-col` 을 뺐다 — RN 의 기본 방향이 이미 column 이라 적을 것이 없다.
// ③ `text-center` 가 상자에서 **글자로** 내려왔다. RN 은 `textAlign` 이 상자에서 상속되지 않는다
//    (`atoms/Button/variants.ts` 의 같은 사정).
//
// **스피너는 움직인다** — step 7 이 `maple-sweep` 을 Reanimated 로 옮겼고, 그 띠가 실제로 보이게 된
// 것은 [[ADR-061]] 정정 1 이다(그때까지는 마스크가 띠를 통째로 지우고 있어 «0프레임» 만 보였다 —
// 그 atom 주석 ①-b). 크기 규칙(page 32 / inline 24, [[ADR-061]] 결정 1·2)은 그대로다.

import { Card, MapleSweepSpinner, Text } from '../../atoms'

export interface LoadingStateProps {
  message: string
  size?: 'page' | 'inline'
}

export function LoadingState(props: LoadingStateProps): React.JSX.Element {
  const isPage = (props.size ?? 'inline') === 'page'

  return (
    <Card
      testID="loading-state"
      role="status"
      aria-busy
      className={`items-center justify-center gap-3 p-6${isPage ? ' min-h-[132px]' : ''}`}
    >
      <MapleSweepSpinner size={isPage ? 32 : 24} className="text-primary" />
      <Text className={isPage ? 'text-center text-sm text-text-muted' : 'text-center text-xs text-text-muted'}>
        {props.message}
      </Text>
    </Card>
  )
}
