/**
 * 알리거나 확인을 받는 모달의 골격. 영역의 자리와 값을 갖는다.
 *
 * ```
 * [배지 40] 제목         머리 줄. 설명은 제목 아래 text-xs
 *           설명
 *   ↕ 16
 * 내용                   card-inset 칸. 버전 · 크기 · 단계
 *   ↕ 16
 * 옵션                   머리 밖의 자유 블록. 펼침 버튼 · 고르는 칸
 *   ↕ 16
 * [주 버튼]              전폭. **되돌릴 수 없는 확인에서는 이 자리가 `취소` 다**
 *   ↕ 4
 * 부 버튼 또는 링크       가운데 글자 버튼. `danger` 는 크기가 같고 글자색만 error
 * ```
 *
 * 호출부는 무엇을 넣을지만 정하고 자리와 간격은 못 바꾼다. 골격이 문장으로만 있고 코드에 없던
 * 동안 값이 이미 갈렸다. 아이콘 굵기 1.7 대 1.75 · 설명 `text-xs` 대 `text-sm` · 묶는 폭 8 대 20.
 *
 * **닫을 수 있는가는 이 파일이 안 본다.** `onClose` 가 정한다. 뒤 화면이 이미 제 기능을 못 하는
 * 모달은 no-op 을 넘겨 못 닫는 채로 남는다.
 *
 * @example
 * <NoticeModal
 *   icon={StoreIcon}
 *   tone="third"
 *   title="스토어 업데이트가 필요해요"
 *   description="이 업데이트는 앱 스토어에서 업데이트해야 받을 수 있어요."
 *   content={<InsetRow label="최소 앱 버전" value={`${minNativeVersion} 이상 필요`} />}
 *   action={{ label: '스토어로 이동', onPress: openStore }}
 *   onClose={dismiss}
 *   testId="update-prompt-overlay"
 * />
 */
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { Button, ExternalLinkIcon, Text } from '../../atoms'
import { ModalHeader, type ModalIcon, type ModalTone } from '../../molecules/ModalHeader/ModalHeader'
import { Modal } from '../Modal/Modal'

/** 버튼 하나. `busy` 는 라벨을 가리고 스피너를 겹쳐 그린다. 못 누르게 하는 것은 `disabled` 다. */
interface NoticeAction {
  label: string
  onPress: () => void
  busy?: boolean
  disabled?: boolean
}

export interface NoticeModalProps {
  icon: ModalIcon
  tone: ModalTone
  title: string
  description?: string
  /** 머리 줄 아래 칸. 버전 · 크기 · 키 단계 같은 값. */
  content?: ReactNode
  /** 칸 아래, 버튼 위의 자유 블록. 펼침 버튼 · 고르는 칸. */
  option?: ReactNode
  /**
   * 전폭 주 버튼. 이 틀에는 반드시 하나 있다.
   *
   * **되돌릴 수 없는 확인에서는 이 자리가 `취소` 다.** 안전한 기본값이 무르는 쪽이고 채운 알약이
   * 그것을 가리켜야 한다. 파괴 동작은 아래 `secondaryAction` 에 `danger` 로 내린다.
   */
  action: NoticeAction
  /**
   * 주 버튼 아래 글자 버튼. `나중에` · `취소` · 파괴 동작 자리.
   *
   * `danger` 는 **크기를 안 바꾸고 글자색만** `error` 로 만든다(사용자 지정). 되돌릴 수 없는
   * 동작이 주 버튼보다 커 보이면 안 되고, 위험하다는 신호는 색 하나로 충분하다.
   */
  secondaryAction?: NoticeAction & { danger?: boolean }
  /** 주 버튼 아래 인라인 링크. 앱 밖으로 나가는 도움말이 여기 선다. */
  link?: { label: string; onPress: () => void }
  onClose: () => void
  /**
   * 오버레이의 testID. 안쪽 조각들이 여기서 파생한다(`-header` · `-badge` · `-description` ·
   * `-content` · `-option` · `-link`). `Modal` 이 창 자체에 `-modal` 을 붙인다.
   */
  testId: string
  /** 제목에 다는 별도 손잡이. 화면 테스트가 이것으로 모달이 떴는지 본다. */
  titleTestId?: string
}

export function NoticeModal(props: NoticeModalProps): React.JSX.Element {
  const { testId } = props

  return (
    <Modal onClose={props.onClose} testId={testId} align="center">
      <Modal.Card
        footer={
          <View className="mt-4 gap-1">
            <Button
              variant="primary"
              onPress={props.action.onPress}
              busy={props.action.busy}
              disabled={props.action.disabled}
              className={`w-full items-center${props.action.disabled === true ? ' opacity-50' : ''}`}
            >
              {props.action.label}
            </Button>
            {/* 파괴 동작의 색은 **변형**으로 준다. 변형이면 대기 스피너 색도 함께 온다. */}
            {props.secondaryAction !== undefined && (
              <Button
                variant={props.secondaryAction.danger === true ? 'dangerText' : 'text'}
                size="sm"
                onPress={props.secondaryAction.onPress}
                busy={props.secondaryAction.busy}
                disabled={props.secondaryAction.disabled}
                className={`self-center${props.secondaryAction.disabled === true ? ' opacity-50' : ''}`}
              >
                {props.secondaryAction.label}
              </Button>
            )}
            {props.link !== undefined && (
              <Pressable
                testID={`${testId}-link`}
                role="link"
                onPress={props.link.onPress}
                className="flex-row items-center gap-1 self-center px-3.5 py-1.5"
              >
                <Text className="text-xs font-semibold text-primary-ink">{props.link.label}</Text>
                <ExternalLinkIcon className="h-3 w-3 text-primary-ink" aria-hidden />
              </Pressable>
            )}
          </View>
        }
      >
        <View className="gap-4">
          <View testID={`${testId}-header`}>
            <ModalHeader
              icon={props.icon}
              tone={props.tone}
              title={props.title}
              description={props.description}
              testId={testId}
              titleTestId={props.titleTestId}
            />
          </View>
          {props.content !== undefined && <View testID={`${testId}-content`}>{props.content}</View>}
          {props.option !== undefined && <View testID={`${testId}-option`}>{props.option}</View>}
        </View>
      </Modal.Card>
    </Modal>
  )
}
