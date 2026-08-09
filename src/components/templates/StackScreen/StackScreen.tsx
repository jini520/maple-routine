import { createContext, useContext, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { useScreenStackStore } from '../../../features/screen-stack/store'
import {
  resolveLayerAboveProgress,
  resolveLayerTransform,
  resolveScrimOpacity,
  resolveTransitionMs,
  STACK_EASING,
  STACK_EDGE_ZONE_PX,
} from '../../../lib/stack-transition'
import { useStackBack } from '../../../lib/use-stack-back'
import { useSwipeBack } from '../../../lib/use-swipe-back'
import { ScreenScroll } from '../ScreenScroll/ScreenScroll'

// 하위 페이지의 공용 셸([[ADR-120]] 결정 2). **하위 페이지 전부가 이것을 쓴다** — 화면마다 오버레이를
// 짜면 같은 코드를 일곱 번 쓰는 일이고, 그렇게 갈라진 셸은 [[ADR-094]] 가 `PageHeader` 로 묶기 전의
// 상태로 되돌아가는 것이다.
//
// **포털로 그린다**(결정 3). 아래 화면을 밀어내려면 탭 화면+탭바를 감싼 `TabLayer` 에 `transform`
// 이 필요한데, `transform` 은 containing block 을 만들어 그 안의 `fixed` 후손을 자기 기준으로
// 잡는다. 그건 화면 셸(`ScreenScroll`·`PageHeader`)에는 필요한 성질이지만 — 함께 밀려야 하니까 —
// **오버레이까지 함께 밀어버린다.** react-router 는 중첩 자식을 부모의 `<Outlet />` 자리에 그리므로
// 오버레이는 그 안에 있다. 그래서 **React 트리 위치는 중첩 그대로 두고 DOM 위치만 옮긴다**:
// [[ADR-077]] 의 "부모가 언마운트되지 않는다"와 [[ADR-092]] 결정 3 의 중첩 Suspense 경계는 둘 다
// **트리**의 성질이라 포털로 DOM 을 옮겨도 그대로 성립한다.
//
// 나가는 연출은 여기 없다 — `useStackLocation` 이 라우트를 한 박자 늦추며 한 곳에서 낸다(결정 9-b).

/**
 * 이 자리에 놓이는 오버레이의 층 번호(0부터). 하위의 하위(`/settings/about/privacy`)가 있으므로
 * 필요하다 — 자기가 최상단인지 아래인지에 따라 `transform` 의 뜻이 정반대다.
 *
 * 포털은 **DOM 만** 옮기고 React 트리는 그대로라, 중첩된 `StackScreen` 은 부모의 이 컨텍스트를
 * 그대로 물려받는다. 스택 구조를 따로 등록·관리할 필요가 없는 이유가 이것이다.
 */
const StackIndexContext = createContext(0)

export interface StackScreenProps {
  children: React.ReactNode
  /**
   * 딥링크로 이 화면에 직접 들어왔을 때 뒤로가 갈 곳. 되돌아갈 히스토리 항목이 없어
   * `navigate(-1)` 이 앱을 벗어나는 경우의 대비다([[ADR-120]] 결정 9).
   */
  parentPath: string
  /**
   * 셸이 스크롤 상자를 대신 깔아 줄지. 기본은 `true` 이고 거의 모든 하위 페이지가 그렇다
   * (헤더 + 세로로 흐르는 목록).
   *
   * `false` 는 **화면이 뷰포트를 꽉 채우고 스스로 스크롤을 소유할 때**다 — 지금은 개인정보
   * 처리방침 하나(`iframe` 이 자기 스크롤을 갖는다). 그때는 `fixed inset-0` 안이 그대로 children
   * 자리이므로 안전영역도 화면이 직접 비운다.
   */
  scroll?: boolean
  /**
   * 모달·바텀시트처럼 **스크롤 상자 밖이자 이 오버레이 안**에 놓여야 하는 것.
   *
   * `children` 에 섞으면 `ScreenScroll` 안으로 들어가는데, 그 셸은 `position: fixed` 라 스태킹
   * 컨텍스트를 만들어 안쪽 `z-50` 을 가둔다(그 셸 주석). 반대로 `<StackScreen>` **밖**의 형제로
   * 두면 탭 레이어에 그려져 이 오버레이(`z-20`) 아래로 내려가고, 전환 중에는 아래 화면과 함께
   * 밀리기까지 한다. 그래서 프롭이다 — `PageHeader` 의 `below` 와 같은 사정이다.
   */
  overlays?: React.ReactNode
}

export function StackScreen({
  children,
  parentPath,
  scroll = true,
  overlays,
}: StackScreenProps): React.JSX.Element | null {
  const index = useContext(StackIndexContext)
  const { depth, progress, isDragging, transitionMs } = useScreenStackStore()
  const isTop = index === depth - 1

  const goBack = useStackBack(parentPath)

  // **안드로이드에서는 JS 제스처를 끈다**([[ADR-120]] 결정 17). 그쪽은 시스템 뒤로가기(제스처
  // 내비 스와이프 / 3버튼)가 인식과 **진행률까지** 주므로, 우리가 가장자리 좌표를 따로 재면
  // 제스처가 둘이 되어 그것부터 부자연스럽다. iOS 는 대안이 없어 JS 제스처를 그대로 쓴다
  // (WKWebView 의 `allowsBackForwardNavigationGestures` 는 same-document 이동에 전환도 진행률도
  // 주지 않아 지금보다 후퇴한다 — 결정 6).
  // 시스템 뒤로가기는 `AppShell` 이 소유한다([[ADR-120]] 결정 18) — 탭 최상위에서도 받아야 하는데
  // 이 컴포넌트는 하위 페이지가 열려 있을 때만 존재하기 때문이다.
  const usesSystemBack = Capacitor.getPlatform() === 'android'
  const edgeRef = useSwipeBack({ enabled: isTop && !usesSystemBack, onPop: goBack })

  // 마운트하면 화면 밖(1)에 전환 없이 세우고, 다음 프레임에 0으로 보낸다. **두 프레임이어야 한다** —
  // 같은 프레임에 두 값을 쓰면 브라우저가 시작 상태를 커밋하지 않아 전환이 걸리지 않고 툭 나타난다.
  useEffect(() => {
    useScreenStackStore.getState().open()

    const frame = requestAnimationFrame(() => {
      const store = useScreenStackStore.getState()
      store.setTransitionMs(resolveTransitionMs())
      store.setProgress(0)
    })

    return () => {
      cancelAnimationFrame(frame)
      useScreenStackStore.getState().close()
    }
  }, [])

  // 포털 대상은 `AppShell` 이 렌더하는 전용 컨테이너다. 없으면(셸 밖에서 화면만 렌더하는 테스트)
  // body 로 떨어뜨린다 — 겹침 순서는 셸이 정하는 것이라 화면 단위 테스트에는 없어도 된다.
  const container =
    typeof document === 'undefined' ? null : (document.getElementById('stack-root') ?? document.body)
  if (container === null) return null

  const transition = isDragging ? 'none' : `transform ${transitionMs}ms ${STACK_EASING}`

  return createPortal(
    <StackIndexContext.Provider value={index + 1}>
      <div
        data-testid="stack-screen"
        data-stack-index={index}
        // z-20 은 [[ADR-077]] 결정 4 가 정한 값 그대로다. 탭바(z-30)보다 숫자가 작은데 위에 그려지는
        // 것은 둘이 이제 다른 스태킹 컨텍스트에 살기 때문이다 — 탭바의 z-30 은 `TabLayer`(isolate)
        // 안에서만 의미를 갖는다(결정 8). 층끼리는 DOM 순서로 갈린다(늦게 열린 것이 위).
        className="fixed inset-0 z-20 bg-bg"
        style={{
          transform: resolveLayerTransform(index, depth, progress),
          transition,
          // 왼쪽 바깥으로 떨어지는 그림자 — 아래 화면과의 경계를 만든다. 다 들어오면 화면 밖이라
          // 보이지 않으므로 조건부로 켤 이유가 없다.
          boxShadow: '-8px 0 24px rgb(0 0 0 / 0.18)',
        }}
      >
        {scroll ? <ScreenScroll hasTabBar={false}>{children}</ScreenScroll> : children}
        {overlays}
        {/* 이 층 위에 또 하나가 얹혔을 때 덮는 스크림. 최상단이면 불투명도가 0이다. */}
        <div
          aria-hidden="true"
          data-testid="stack-screen-scrim"
          className="pointer-events-none absolute inset-0 z-[2] bg-black"
          style={{
            opacity: resolveScrimOpacity(resolveLayerAboveProgress(index, depth, progress)),
            transition: isDragging ? 'none' : `opacity ${transitionMs}ms ${STACK_EASING}`,
          }}
        />
        {/* 가장자리 히트존. `touch-action: none` 이라야 이 띠에서 시작한 손가락을 네이티브 스크롤이
            가져가지 않는다. 콘텐츠 위에 있어야 하므로 스크롤 상자 다음 형제다. */}
        <div
          ref={edgeRef}
          data-testid="stack-edge-zone"
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-[1]"
          style={{ width: STACK_EDGE_ZONE_PX, touchAction: 'none' }}
        />
      </div>
    </StackIndexContext.Provider>,
    container,
  )
}
