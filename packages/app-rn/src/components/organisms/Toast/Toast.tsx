// 토스트 한 장 — 아이콘 + 문구 + (선택) 액션 + 닫기 + 남은 시간 바.
//
// 톤 배경은 `*-tint` 토큰이다([[ADR-064]] 결정 2). Tailwind 투명도 접미사(`bg-secondary/10`)를 쓰면
// 투명과 섞여 배경이 거의 안 보인다 — 그 문제를 이 파일이 `color-mix` 로 우회하고 있었는데, 이제
// 틴트가 값으로 확정돼 있어 토큰만 쓰면 된다.
//
// 액션 슬롯은 아이콘만 보이고 라벨은 접근성 이름으로만 쓴다. 기본 아이콘이 '다시 시도'를
// 전제하므로 뜻이 다른 액션은 자기 아이콘을 넘긴다([[ADR-063]] — '설정 열기'에 새로고침 아이콘을
// 쓰면 무엇을 하는 버튼인지 어긋난다).
//
// ── RN 으로 옮기며 갈린 것 다섯 ─────────────────────────────────────────────────────
//
// ① **스와이프는 responder 프롭으로 그대로 옮긴다.** 웹은 `onPointerDown/Move/Up` 에 `clientX` 를
//    썼고 RN 은 같은 자리에 `onResponder*` 와 `pageX` 가 있다 — 임계값 판정은 `@core/lib/
//    swipe-dismiss` 의 `shouldDismissFromSwipe` 를 그대로 부른다. **`PanResponder` 를 쓰지
//    않는다**: 그것은 터치 히스토리에서 제스처 상태를 스스로 계산해, 웹이 갖고 있던 "시작점
//    하나와 현재 x" 라는 단순한 모델을 대신 세운다(그리고 그 계산 때문에 테스트에서 제스처를
//    합성하려면 `touchHistory` 를 통째로 지어내야 한다). **`onMove…` 에서만 responder 를 가져오는
//    것이 요점** — 시작에서 가져가면 안쪽 버튼(액션·닫기)이 눌리지 않는다. 웹이 `closest('button')`
//    로 걸러내던 것과 같은 목적이고, RN 에서는 responder 규칙이 그것을 구조로 해 준다.
// ② **`toast-shrink` 는 아직 안 움직인다** — `@keyframes` 8종 중 하나라 **step 7(animations)** 몫이다.
//    지금은 남은 시간 바가 폭 100% 로 서 있고 줄지 않는다. 구조(자리·두께·색·`duration === null`
//    이면 아예 없음)는 그대로라 step 7 이 값만 굴리면 된다.
// ③ **진입 트랜지션도 마찬가지다.** `isEntered` 상태와 두 클래스는 남겼지만 CSS 트랜지션이 없어
//    지금은 한 프레임 뒤 즉시 최종 상태로 튄다(웹은 `transition-opacity duration-200`).
// ④ **`truncate` → `numberOfLines={1}`**(RN 은 그 둘을 스타일이 아니라 `Text` 프롭으로 받는다).
// ⑤ `role`·`aria-live` 는 그대로 — RN 이 같은 이름의 ARIA 값을 받는다(error 는 즉시 알림).
//
// ── 남은 어긋남: `ToastAction.icon` 의 타입이 웹을 향해 있다 ─────────────────────────
//
// core 의 `ToastAction.icon` 은 `lucide-react`(웹)의 `LucideIcon` 이라 `lucide-react-native` 의
// 같은 아이콘이 **타입상 들어가지 않는다**(SVG DOM 프롭이 달라 `fillRule` 에서 갈린다). 이 파일은
// 그것을 *렌더만* 하므로 지금은 문제가 없지만, **아이콘을 넘기는 쪽**(설정 열기 토스트 등)은 화면
// 단계에서 걸린다. core 를 이 단계에서 고치지 않는 것이 원칙이라([[ADR-127]] 원칙 3) 사실만 적어
// 둔다 — 푸는 방법은 core 의 그 필드를 플랫폼 중립 컴포넌트 타입으로 넓히는 것이다.
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native'

import type { ToastItem, ToastVariant } from '@core/features/toast/store'
import { shouldDismissFromSwipe } from '@core/lib/swipe-dismiss'

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  RefreshCwIcon,
  XIcon,
} from '../../../lib/icons'

export interface ToastProps {
  toast: ToastItem
  onDismiss: () => void
}

const ICONS: Record<ToastVariant, typeof CheckCircle2Icon> = {
  success: CheckCircle2Icon,
  error: AlertCircleIcon,
  info: InfoIcon,
}

const TONE_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-secondary-tint',
  error: 'bg-error-tint',
  info: 'bg-info-tint',
}

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-secondary-ink',
  error: 'text-error-ink',
  info: 'text-info-ink',
}

export function Toast(props: ToastProps): React.JSX.Element {
  const { toast, onDismiss } = props
  const [isEntered, setIsEntered] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const dragStartX = useRef(0)

  // 마운트 직후 바로 최종 상태를 주면 트랜지션이 재생되지 않는다 — 한 프레임 뒤로 미룬다.
  // (지금은 그 트랜지션 자체가 없다 — 파일 머리 ③.)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function handleGrant(event: GestureResponderEvent): void {
    dragStartX.current = event.nativeEvent.pageX
    setDragX(0)
  }

  function handleMove(event: GestureResponderEvent): void {
    setDragX(event.nativeEvent.pageX - dragStartX.current)
  }

  function handleRelease(): void {
    if (dragX === null) return
    if (shouldDismissFromSwipe(dragX)) onDismiss()
    else setDragX(null)
  }

  const Icon = ICONS[toast.variant]
  const isDragging = dragX !== null
  const dragOpacity = isDragging ? Math.max(0.15, 1 - Math.abs(dragX) / 140) : undefined
  const enterClasses = isEntered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
  const ActionIcon = toast.action?.icon ?? RefreshCwIcon

  return (
    <View
      testID="toast"
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      // 시작이 아니라 **움직임**에서만 가져간다(파일 머리 ①).
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={() => setDragX(null)}
      className={`relative flex-row items-center gap-2 overflow-hidden rounded-[14px] border border-border px-2.5 py-2 ${TONE_CLASSES[toast.variant]} ${enterClasses}`}
      style={isDragging ? { transform: [{ translateX: dragX }], opacity: dragOpacity } : undefined}
    >
      <Icon className={`h-4 w-4 shrink-0 ${ICON_CLASSES[toast.variant]}`} strokeWidth={2} aria-hidden />
      <Text
        numberOfLines={1}
        className={`min-w-0 flex-1 text-sm font-medium ${
          toast.variant === 'error' ? 'text-error-ink' : 'text-text'
        }`}
      >
        {toast.message}
      </Text>

      {toast.action !== undefined && (
        <Pressable
          role="button"
          aria-label={toast.action.label}
          onPress={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className="h-6 w-6 shrink-0 items-center justify-center"
        >
          <ActionIcon className="h-3.5 w-3.5 text-primary-ink" strokeWidth={2} aria-hidden />
        </Pressable>
      )}

      <Pressable
        role="button"
        aria-label="닫기"
        onPress={onDismiss}
        className="h-6 w-6 shrink-0 items-center justify-center"
      >
        <XIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
      </Pressable>

      {toast.duration !== null && (
        <View testID="toast-timer" className="absolute inset-x-0 bottom-0 h-[2.5px]">
          {/* 폭이 줄어드는 것은 step 7(파일 머리 ②) — 지금은 가득 찬 채로 서 있다. */}
          <View className={`h-full w-full ${TIMER_CLASSES[toast.variant]}`} />
        </View>
      )}
    </View>
  )
}

/**
 * 남은 시간 바의 색.
 *
 * 웹은 `bg-current` + `text-*-ink` 로 글자색을 배경에 물려받았는데, RN 에는 `currentColor` 가 없어
 * (`tailwind.config.js` 가 `current` 를 일부러 뺐다) **배경 토큰을 직접 쓴다.**
 */
const TIMER_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-secondary-ink',
  error: 'bg-error-ink',
  info: 'bg-info-ink',
}
