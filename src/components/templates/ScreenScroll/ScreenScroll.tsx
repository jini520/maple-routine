// 화면 스크롤 셸([[ADR-099]]). **스크롤의 소유자를 문서가 아니라 화면으로 옮긴다** — 스크롤 상태가
// 이 DOM 요소에 붙으므로 화면과 함께 태어나고 함께 죽고, 그래서 다른 탭이 오프셋을 물려받을 길이
// 없다(네 탭이 문서 스크롤 하나를 공유하던 것이 [[ADR-098]] 이동 프레임의 원인 ①이었다).
//
// **박스를 "실제로 보이는 영역"에 맞추는 것이 이 셸의 전부다.** 스크롤 인디케이터는 페이지 콘텐츠가
// 아니라 스크롤포트 위에 겹쳐 그려지므로, 상자가 화면 끝까지 닿으면 인디케이터가 노치를 침범하고
// 탭바 뒤로 사라진다(둘 다 실기기 관측). 문서 스크롤일 때 WKWebView 가 메인 스크롤뷰에 자동으로
// 넣어주던 인셋을 여기서 우리가 준다.
//
//   위: `top-[var(--sa-top)]`      — 안쪽 래퍼의 `-mt-[var(--sa-top)]` 이 같은 양을 되돌린다
//   아래: `bottom-[var(--tab-bar-h)]` — 탭바 **실측**([[ADR-099]] 결정 7, `BottomTabBar` 가 쓴다).
//                                      `4rem` 으로 가정했더니 실제 높이와 어긋나 띠가 생겼다
//
// 콘텐츠에서 같은 양을 되돌리므로 **최대 스크롤(= 콘텐츠 − 스크롤포트)은 인셋 전과 같다.** 잘려나가는
// 구간은 헤더·탭바가 덮는 자리라 보이지 않는다.
//
// **모달·오버레이는 이 셸 안에 넣지 말 것** — `position: fixed` 는 스태킹 컨텍스트를 만들어 안쪽
// `z-50` 이 바깥 `z-30` 탭바보다 아래로 그려진다([[ADR-077]] 결정 3과 같은 함정). 화면은
// `<><ScreenScroll>…</ScreenScroll>{모달}</>` 형태로 쓴다.
//
// 배경색도 칠하지 않는다 — 불투명 배경은 [[ADR-088]] 테마 배경 이미지(`z-index: -1` 백드롭)를 가린다.

export interface ScreenScrollProps {
  children: React.ReactNode
  /**
   * 당겨서 새로고침이 최상단 판정에 쓸 스크롤 루트([[ADR-099]] 결정 2 — `usePullToRefresh` 의
   * `scrollRoot` 에 같은 ref 를 넘긴다). 제스처가 없는 화면(관리 페이지)은 생략한다.
   *
   * React 19 부터 `ref` 는 평범한 프롭이라 `forwardRef` 가 필요 없다.
   */
  ref?: React.Ref<HTMLDivElement>
  /**
   * 하단을 탭바 실측(`--tab-bar-h`)만큼 비울지. **하위 페이지는 `false` 다** — 스택 오버레이에는
   * 탭바가 없어(아래 화면과 함께 밀려 나간다, [[ADR-120]] 결정 4) 그만큼 비우면 바닥에 빈 띠가
   * 남는다.
   *
   * `false` 일 때 하단 인셋을 **두 조각으로 나눠 다르게 다룬다**([[ADR-120]] 결정 16·19):
   *
   * - `--nav-solid-bottom`(안드로이드 3버튼 내비가 차지하는 높이, 제스처 내비는 0) — **콘텐츠가
   *   그 뒤로 지나가면 안 된다.** 불투명한 버튼 사이로 글자가 비쳐 지저분하다. 스크롤포트를 그
   *   위에서 끝낸다.
   * - 나머지(홈 인디케이터·제스처 핸들) — **지나가도 된다.** 그게 네이티브 앱의 모습이다. 대신
   *   스크롤 끝에 그만큼 여백을 남긴다. 스크롤포트를 줄이지 않고 안쪽 래퍼의 `padding-bottom`
   *   으로 넣어야 스크롤 가능한 높이가 그만큼 늘어난다.
   *
   * 탭 화면(`true`)은 탭바가 그 자리를 차지하고 자기 `pb-[var(--sa-bottom)]` 로 처리하므로 둘 다
   * 필요 없다.
   */
  hasTabBar?: boolean
}

export function ScreenScroll({
  children,
  ref,
  hasTabBar = true,
}: ScreenScrollProps): React.JSX.Element {
  return (
    <div
      ref={ref}
      data-testid="screen-scroll"
      className={
        hasTabBar
          ? 'fixed inset-x-0 top-[var(--sa-top)] bottom-[var(--tab-bar-h)] overflow-y-auto overscroll-y-none'
          : 'fixed inset-x-0 top-[var(--sa-top)] bottom-[var(--nav-solid-bottom,0px)] overflow-y-auto overscroll-y-none'
      }
    >
      <div
        className={
          hasTabBar
            ? '-mt-[var(--sa-top)] space-y-4'
            : '-mt-[var(--sa-top)] space-y-4 pb-[calc(var(--sa-bottom)-var(--nav-solid-bottom,0px))]'
        }
      >
        {children}
      </div>
    </div>
  )
}
