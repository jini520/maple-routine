import { useMeasuredHeight } from '../../../lib/use-measured-height'
import { ThemeHeaderBackdrop } from '../ThemeHeaderBackdrop/ThemeHeaderBackdrop'

// 화면 상단 고정 헤더 셸(ADR-094 4단계). 스케줄러 계열 4화면이 **글자 하나까지 같은**
// 마크업을 복붙하고 있었다 — 셸 클래스, 테마 배경 조각, 하단 페이드(마스크 스타일 포함)까지.
//
// 왜 묶는가 — 결정 1의 두 번째 조건이다. 이건 취약 구조다: 고정 방식은 조상 체인과 스크롤
// 컨텍스트에 걸리고, `z-10` 은 스태킹 순서를 정하며, 페이드는 `top-full` 로 셸 높이에 매여 있다.
// 복붙된 채로는 한 곳을 고쳐도 나머지 셋이 안 고쳐진다 — [[ADR-085]] 가 보스 수익 헤더를 `fixed` 로
// 바꿀 때 실제로 겪은 종류의 문제이고, [[ADR-098]] 이 그 처방을 이 셸로 넓힐 때 실제로 덕을 봤다.
//
// **`sticky top-0` 이 아니라 `fixed` 다**([[ADR-098]] 결정 2). `sticky` 요소의 화면 위치는 스크롤
// 오프셋의 함수라, iOS 스크롤 스레드가 옛 오프셋을 뒤늦게 되돌려 보내는 프레임에 헤더가 화면 밖으로
// 날아간다(사용자 보고 2026-08-06: 탭 복귀 시 헤더 없이 카드가 y=0부터 그려짐). 이 헤더는 화면 루트의
// 첫 요소라 원래도 모든 스크롤 위치에서 뷰포트 상단에 붙어 있었으므로 **보이는 모습은 동일**하고,
// 바뀌는 것은 그 위치를 무엇이 정하느냐뿐이다([[ADR-085]] 결정 1이 보스 수익에 대해 세운 근거가 이
// 화면들에서도 성립함을 확인한 것이다). 짝이 되는 결정은 이동 전 스크롤 리셋(`useScreenNavigate`).
//
// 보스 수익 화면은 여전히 여기 포함하지 않는다 — 같은 `fixed` + spacer 형태지만 페이지 헤더에
// 경계 페이드를 두지 않고([[ADR-047]] 결정 6) 헤드라인 실측을 중첩 sticky 레일에 쓴다.
//
// 드랍 히스토리도 제외한다 — sticky 셸만 쓰고 배경 조각·페이드가 없는 오버레이 서브 화면이라
// 여기 넣으면 없던 DOM 이 생긴다(그 화면은 자기 스크롤 컨테이너를 갖는다 — [[ADR-077]]).

export interface PageHeaderProps {
  /** 헤더 내용. 안에서 `space-y-4` 로 세로 간격이 잡힌다. */
  children: React.ReactNode
  /**
   * 헤더 **바로 아래 띠**(`top-full`)에 겹쳐 그릴 것 — 현재는 당겨서 새로고침 인디케이터
   * 하나다(스케줄러 2화면).
   *
   * 프롭으로 받는 이유 — 그 인디케이터는 `absolute inset-x-0 top-full` 이라 **이 셸이
   * positioned ancestor 여야** 하고, 자기 주석도 "고정 헤더 블록의 마지막 자식"이라고
   * 못박고 있다. `children` 에 섞으면 `space-y-4` 안으로 들어가 흐름 자식이 되어 위치가
   * 완전히 달라진다.
   */
  below?: React.ReactNode
}

export function PageHeader(props: PageHeaderProps): React.JSX.Element {
  // ADR-098 결정 2: 헤더가 `fixed` 라 흐름에서 빠졌고, 목록은 아래 spacer 의 **실측 높이**로 자리를
  // 받는다. 그래서 spacer 는 헤더가 실제로 차지한 높이와 늘 같아야 한다 — 이 셸을 쓰는 네 화면 모두
  // `children` 안에 높이를 바꾸는 조건부 블록(탭 줄·셸 승계 로딩 카드·경고 줄)을 갖고 있고, 셸은
  // 자기 안에 무엇이 들어오는지 모른다.
  //
  // 측정 방식과 두 갱신 경로의 분담은 공용 훅 `lib/use-measured-height.ts` 가 갖는다([[ADR-112]]
  // 결정 2 — 화면별로 재게 만들지 말 것. [[ADR-094]] 가 없앤 복붙이 되살아난다). 실측을
  // `useEffect` 로 되돌리지 말 것: 첫 프레임에 spacer 가 0이라 목록이 위로 튄다([[ADR-085]] 결정 1).
  // 갱신 경로를 `ResizeObserver` 하나로 되돌리지도 말 것: 헤더 높이를 바꾸는 커밋마다 spacer 가 옛
  // 값인 프레임이 한 번 그려진다([[ADR-112]], 이슈 #168).
  const { ref: barRef, height: barHeight } = useMeasuredHeight<HTMLDivElement>()

  // 래퍼 <div> 하나로 [고정 헤더 + spacer] 를 묶는다 — 화면 루트(`space-y-4`)에서 헤더가 차지하던
  // 자리를 그대로 유지하기 위해서다. 프래그먼트로 반환하면 그 유틸리티가 형제인 spacer 에
  // margin-top 을 얹어 목록이 16px 내려간다([[ADR-085]]·[[ADR-077]] 결정 3이 겪은 함정).
  return (
    <div>
      {/* 상단 안전영역(상태바·노치)만큼 더 내려 그 아래로 텍스트만 보이게 하고, 바깥 AppShell 의
          padding-top 과 중복되지 않게 한다. z-10 으로 항상 목록 위에 그려진다. */}
      <div
        ref={barRef}
        className="fixed inset-x-0 top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2"
      >
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
      {/* 고정 헤더가 흐름에서 빠진 자리 — 실측 높이 그대로. */}
      <div aria-hidden="true" style={{ height: barHeight }} />
    </div>
  )
}
