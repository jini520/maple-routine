// 토스트 스택 — 스토어의 목록을 아래에서부터 쌓아 그린다.
//
// ── RN 으로 옮기며 갈린 것 셋 ─────────────────────────────────────────────────────
//
// ① **`createPortal(document.body)` 이 사라진다. 그리고 그 자리를 대신할 것을 여기서 만들지
//    않는다.** 웹에서 포털을 쓴 이유는 *"토스트는 항상 최상단"* 이었고(모달·피커가 전부 z-50 이라
//    그보다 낮으면 스크림에 가린다), RN 에서 그 성질을 주는 것은 네이티브 윈도우(`Modal`)뿐인데
//    안드로이드에서 그것은 **화면 전체의 터치를 삼키는 다이얼로그**라 토스트에는 쓸 수 없다.
//    그래서 이 컴포넌트는 **자기가 놓인 자리에 절대 배치로 그리고**, 어디에 마운트할지는 앱 셸이
//    정한다(화면 단계 몫 — 탭 레이어 밖 루트에 두면 탭바 위에 뜬다).
//
//    **남는 한계를 적어 둔다**: 그렇게 해도 `Modal`(피커·업데이트 모달 등)이 열려 있는 동안 새로
//    뜬 토스트는 그 네이티브 윈도우 **뒤**에 가린다. 웹에서는 z-60 으로 항상 앞이었다. 실제로
//    걸리는 자리가 있다. 파티 인원 모달이 열린 채 저장이 실패하면 그 토스트가 안 보인다
// . 오버레이를 전부 한 루트 호스트로 모으면 풀리는 문제이고, 그것은 화면
//    배선의 결정이라 여기서 미리 정하지 않는다.
// ② `pointer-events` 대신 **`pointerEvents="box-none"`**. 스택 자신은 터치를 통과시키고 토스트
//    카드만 받는다(웹은 컨테이너가 `fixed` 라 자기 상자 밖은 애초에 안 받았다).
// ③ `bottom-[calc(4rem+var(--sa-bottom)+0.75rem)]` → 값 계산. 탭바 높이 상수는 웹의 `h-16`(4rem)과
//  같은 기준이다. 실제 탭바를 실측해 맞추는 것은 셸이 붙는 단계의 일이다(가 웹에서
//    `4rem` 가정을 실측으로 바꾼 것과 같은 지점).
import { View } from 'react-native'

import { useToastStore } from '../../../features/toast/store'

import { useBottomSafeAreaPx } from '../../../lib/safe-area'
import { Toast } from './Toast'

/** 하단 탭바 높이 — 웹 `AppShell` 의 `h-16`(4rem)과 같은 기준(파일 머리 ③). */
const TAB_BAR_H = 64
/** 탭바(또는 안전영역) 위로 띄우는 간격 — 웹 `0.75rem`. */
const GAP = 12

export interface ToastStackProps {
  /** 하단 탭바가 떠 있는 화면인지. 기본 true. */
  hasTabBar?: boolean
}

export function ToastStack(props: ToastStackProps): React.JSX.Element | null {
  const hasTabBar = props.hasTabBar ?? true
  // **인셋이 아니라 하한이 깔린 값이다**. 토스트는 바 **위에** 쌓이므로 바와
  // 같은 자리에서 출발해야 한다. 여기만 인셋으로 두면 안드로이드 제스처 기기에서 바는 34 에
  // 뜨는데 토스트는 15 + 바 높이에 서서 캡슐 안으로 7px 들어간다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <View
      testID="toast-stack"
      pointerEvents="box-none"
      className="absolute inset-x-0 gap-2 px-4"
      style={{ bottom: (hasTabBar ? TAB_BAR_H : 0) + bottomSafeAreaPx + GAP }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </View>
  )
}
