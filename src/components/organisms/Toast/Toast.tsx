/**
 * 토스트 한 장. 아이콘 · 문구 · 액션 · 닫기 · 남은 시간 바를 그리는 부품.
 *
 * 톤 배경은 `*-tint` 토큰이다. Tailwind 투명도 접미사(`bg-secondary/10`)를 쓰면 투명과 섞여 배경이
 * 거의 안 보인다.
 *
 * 액션 슬롯은 아이콘만 보이고 라벨은 접근성 이름으로만 쓴다. 기본 아이콘이 `다시 시도` 를
 * 전제하므로 뜻이 다른 액션은 자기 아이콘을 넘긴다.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, View, type GestureResponderEvent } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import type { ToastItem, ToastVariant } from '../../../features/toast/store'
import { shouldDismissFromSwipe } from './swipe-dismiss'

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  RefreshCwIcon,
  Text,
  XIcon,
} from '../../atoms'
import { AnimatedView } from '../../../lib/nativewind-interop'
import { ENTER_TRANSITION, timerAnimation } from './timer-animation'

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
  const reduceMotion = useReducedMotion()

  // 마운트 직후 바로 최종 상태를 주면 트랜지션이 재생되지 않는다. 한 프레임 뒤로 미룬다.
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
  // 모션 줄이기면 시작 위치의 `translate-y-3` 이 빠진다.
  const restingClasses = reduceMotion ? 'translate-y-0 opacity-0' : 'translate-y-3 opacity-0'
  const enterClasses = isEntered ? 'translate-y-0 opacity-100' : restingClasses
  const ActionIcon = toast.action?.icon ?? RefreshCwIcon

  return (
    <AnimatedView
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
      // 드래그 중에는 트랜지션을 주지 않는다. 웹의 `transition: 'none'` 자리다(파일 머리 ③).
      style={
        isDragging
          ? { transform: [{ translateX: dragX }], opacity: dragOpacity }
          : ENTER_TRANSITION
      }
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
          {/* 모션 줄이기면 이 안쪽이 통째로 없다. 웹 `motion-reduce:hidden`(파일 머리 ②). */}
          {!reduceMotion && (
            <AnimatedView
              className={`h-full w-full ${TIMER_CLASSES[toast.variant]}`}
              style={{ transformOrigin: 'left', ...timerAnimation(toast.duration) }}
            />
          )}
        </View>
      )}
    </AnimatedView>
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
