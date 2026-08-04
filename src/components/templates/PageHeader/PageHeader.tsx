import { ThemeHeaderBackdrop } from '../ThemeHeaderBackdrop/ThemeHeaderBackdrop'

// 화면 상단 sticky 헤더 셸(ADR-094 4단계). 스케줄러 계열 4화면이 **글자 하나까지 같은**
// 마크업을 복붙하고 있었다 — 셸 클래스, 테마 배경 조각, 하단 페이드(마스크 스타일 포함)까지.
//
// 왜 묶는가 — 결정 1의 두 번째 조건이다. 이건 취약 구조다: `sticky top-0` 의 흡착은 조상
// 체인과 스크롤 컨텍스트에 걸리고, `z-10` 은 스태킹 순서를 정하며, 페이드는 `top-full` 로
// 셸 높이에 매여 있다. 복붙된 채로는 한 곳을 고쳐도 나머지 셋이 안 고쳐진다 —
// [[ADR-085]] 가 보스 수익 헤더를 `fixed` 로 바꿀 때 실제로 겪은 종류의 문제다.
//
// **보스 수익 화면은 여기 포함하지 않는다.** [[ADR-085]] 결정 1이 그 화면만 `fixed` + spacer 로
// 바꾸고 *"다른 4개 화면은 공용 sticky 레시피 그대로"* 라고 명시했다 — 그 화면만 문서 최상단
// 첫 요소라 `fixed` 로 바꿔도 보이는 모습이 같았기 때문이다. 나머지를 `fixed` 로 통일하는 것은
// 그 ADR 을 따르는 것이 아니라 어기는 것이다.
//
// 드랍 히스토리도 제외한다 — sticky 셸만 쓰고 배경 조각·페이드가 없는 오버레이 서브 화면이라
// 여기 넣으면 없던 DOM 이 생긴다.

export interface PageHeaderProps {
  /** 헤더 내용. 안에서 `space-y-4` 로 세로 간격이 잡힌다. */
  children: React.ReactNode
  /**
   * 헤더 **바로 아래 띠**(`top-full`)에 겹쳐 그릴 것 — 현재는 당겨서 새로고침 인디케이터
   * 하나다(스케줄러 2화면).
   *
   * 프롭으로 받는 이유 — 그 인디케이터는 `absolute inset-x-0 top-full` 이라 **이 셸이
   * positioned ancestor 여야** 하고, 자기 주석도 "sticky 헤더 블록의 마지막 자식"이라고
   * 못박고 있다. `children` 에 섞으면 `space-y-4` 안으로 들어가 흐름 자식이 되어 위치가
   * 완전히 달라진다.
   */
  below?: React.ReactNode
}

export function PageHeader(props: PageHeaderProps): React.JSX.Element {
  // 상단 안전영역(상태바·노치)만큼 더 내려 그 아래로 텍스트만 보이게 하고, 바깥 AppShell 의
  // padding-top 과 중복되지 않게 한다. z-10 으로 항상 목록 위에 그려진다.
  return (
    <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
      {/* ADR-088 결정 5-1: 헤더 자리의 테마 배경 조각(배경 없는 테마에선 렌더 안 됨).
          형제보다 먼저 놓는다 — z-index:-1 이라 순서가 그림에 영향을 주진 않지만, 읽는
          사람에게 이것이 배경임을 알리는 자리다. */}
      <ThemeHeaderBackdrop />
      <div className="space-y-4">{props.children}</div>
      {/* 헤더 아래에 살짝 겹쳐 그라데이션+블러로 항목이 잘려 보이지 않고 자연스럽게
          사라지도록 한다 — 배경(bg-bg → transparent)과 블러 강도를 같은 마스크로 함께
          줄여서, 색만 옅어지고 블러는 그대로인 부자연스러운 경계가 생기지 않게 한다. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
        style={{
          maskImage: 'linear-gradient(to bottom, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
        aria-hidden="true"
      />
      {props.below}
    </div>
  )
}
