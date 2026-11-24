import { View } from 'react-native'

import { IconBadge, Text, type IconBadgeIcon, type IconBadgeTone } from '../../atoms'

/** 배지에 드는 아이콘. */
export type ModalIcon = IconBadgeIcon

/** 배지 색. 꺼진 타일의 회색(`muted`)은 모달에 쓰지 않는다. */
export type ModalTone = Exclude<IconBadgeTone, 'muted'>

export interface ModalHeaderProps {
  /** 배지 아이콘. `busy` 면 그리지 않는다. */
  icon?: ModalIcon
  /** 기다리는 모달. 아이콘 자리에 링 스피너가 돈다. */
  busy?: boolean
  tone: ModalTone
  title: string
  description?: string
  /** 참이면 배지 없이 제목과 설명만 선다. 아래 칸이 무엇을 다루는지 보여 줄 때 쓴다(인벤토리 삭제 확인). */
  bare?: boolean
  /** 배지 · 설명의 testID 가 여기서 파생한다(`-badge` · `-description`). */
  testId?: string
  titleTestId?: string
}

/**
 * 가운데 모달의 머리 줄. 왼쪽 40 원 배지 옆에 제목과 설명을 세로로 둔다.
 *
 * @example <ModalHeader icon={CrownIcon} tone="primary" title={copy.title} description={copy.description} />
 */
export function ModalHeader(props: ModalHeaderProps): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-3">
      {props.bare !== true && (
        <IconBadge
          testID={props.testId === undefined ? undefined : `${props.testId}-badge`}
          icon={props.icon}
          size={40}
          tone={props.tone}
          busy={props.busy}
        />
      )}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text testID={props.titleTestId} className="text-base font-bold text-text">
          {props.title}
        </Text>
        {props.description !== undefined && (
          <Text
            testID={props.testId === undefined ? undefined : `${props.testId}-description`}
            className="text-xs text-text-muted"
          >
            {props.description}
          </Text>
        )}
      </View>
    </View>
  )
}
