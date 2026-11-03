/**
 * 토스트 한 장. 아이콘 · 문구 · 액션 · 닫기 · 남은 시간 링을 그리는 부품.
 *
 * 톤 배경은 `*-tint` 토큰이다. Tailwind 투명도 접미사(`bg-secondary/10`)를 쓰면 투명과 섞여 배경이
 * 거의 안 보인다.
 *
 * 모양과 그림자는 안쪽 `View` 가 든다. `AnimatedView` 에 준 정적 스타일은 오류 없이 사라질 수 있다.
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
import { boxShadowOf, DROPDOWN_SHADOW } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
import { ENTER_TRANSITION } from './enter-transition'
import { TimerRing } from './TimerRing'

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
  const { definition } = useThemeAppearance()
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
      // 시작이 아니라 움직임에서만 가져간다.
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={() => setDragX(null)}
      className={enterClasses}
  // 드래그 중에는 트랜지션을 주지 않는다.
      style={
        isDragging
          ? { transform: [{ translateX: dragX }], opacity: dragOpacity }
          : ENTER_TRANSITION
      }
    >
      <View
        className={`flex-row items-center gap-2 rounded-[14px] px-2.5 py-2 ${TONE_CLASSES[toast.variant]}`}
        style={{ boxShadow: boxShadowOf(definition.shadowColor, DROPDOWN_SHADOW) }}
      >
        <Icon className={`h-4 w-4 shrink-0 ${ICON_CLASSES[toast.variant]}`} strokeWidth={2} aria-hidden />
        <Text
          numberOfLines={1}
          className={`min-w-0 flex-1 text-sm font-semibold ${
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
          {toast.duration !== null && (
            <View testID="toast-timer" pointerEvents="none" className="absolute inset-0">
              {/* 모션 줄이기면 이 안쪽이 통째로 없다. */}
              {!reduceMotion && (
                <TimerRing durationMs={toast.duration} className={ICON_CLASSES[toast.variant]} />
              )}
            </View>
          )}
          <XIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
        </Pressable>
      </View>
    </AnimatedView>
  )
}
