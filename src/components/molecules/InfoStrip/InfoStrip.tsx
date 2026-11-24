/**
 * 화면 머리글 바로 아래의 안내 띠 한 줄. 아이콘 · 두 줄 문구 · 닫기를 그리는 부품.
 *
 * 카드가 아니라 모서리도 그림자도 없다. 문장 둘은 각자 한 줄이다. 한 문단으로 흘리면 폭에 따라 접히는 자리가 달라져
 * 문장 가운데가 끊기기 때문. 본문을 누르면 안내를 열고 `X` 는 닫기만 한다.
 *
 * @example
 * <InfoStrip testID="today-settlement-banner" tone="settlement" icon={ClockIcon} title={title} detail={detail}
 *   infoLabel="결산이 무엇인지 보기" onPressInfo={openFaq} infoDisabled={faq === null}
 *   closeLabel="결산 안내 닫기" onClose={dismiss} />
 */
import type { ComponentType } from 'react'
import { Pressable, View } from 'react-native'

import { Text, XIcon } from '../../atoms'

/** 닫기 아이콘 16 을 권장 타깃 44 로 넓히는 값. 나란히 선 것이 없어 네 면 다 준다. */
const CLOSE_HIT_SLOP = 14

/**
 * 색 묶음. `settlement` 는 앱의 상태(결산 · 점검)를 말하는 띠의 전용 색이라 테마를 따르지 않고, `primary` 는 기능이
 * 열렸다는 띠라 기능의 색을 따른다. 아이콘은 글자와 다른 색이라야 표식으로 읽힌다.
 */
const TONE = {
  settlement: {
    box: 'bg-settlement-tint',
    mark: 'text-settlement-mark',
    title: 'text-settlement-ink',
    muted: 'text-settlement-ink-muted',
  },
  primary: { box: 'bg-primary-tint', mark: 'text-primary', title: 'text-primary-ink', muted: 'text-text-muted' },
} as const

export interface InfoStripProps {
  testID: string
  tone: keyof typeof TONE
  /** 띠가 말하는 일의 종류를 보이는 아이콘 */
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  /** 첫 줄. 무슨 일이 일어나는 중인가 */
  title: string
  /** 둘째 줄. 그래서 어떻게 되는가 */
  detail: string
  /** 본문을 누르면 여는 안내의 접근성 이름 */
  infoLabel: string
  onPressInfo: () => void
  /** 열 안내가 없으면 띠는 서되 본문이 눌리지 않는다 */
  infoDisabled?: boolean
  closeLabel: string
  onClose: () => void
}

export function InfoStrip(props: InfoStripProps): React.JSX.Element {
  const tone = TONE[props.tone]
  const Icon = props.icon
  return (
    <View testID={props.testID} className={`flex-row items-center gap-2.5 px-4 py-2.5 ${tone.box}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.mark}`} strokeWidth={2} aria-hidden />

      <Pressable
        role="button"
        aria-label={props.infoLabel}
        onPress={props.onPressInfo}
        disabled={props.infoDisabled}
        className="shrink grow"
      >
        <Text className={`text-xs font-semibold ${tone.title}`}>{props.title}</Text>
        <Text className={`text-11 ${tone.muted}`}>{props.detail}</Text>
      </Pressable>

      <Pressable
        role="button"
        aria-label={props.closeLabel}
        hitSlop={CLOSE_HIT_SLOP}
        onPress={props.onClose}
        className="shrink-0"
      >
        <XIcon className={`h-4 w-4 ${tone.muted}`} strokeWidth={2} aria-hidden />
      </Pressable>
    </View>
  )
}
