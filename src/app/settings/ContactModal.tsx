/**
 * `문의 · 버그 제보` 모달. 메일과 카카오톡 오픈채팅 중 하나를 고르면 그 앱으로 보낸다.
 *
 * 버튼 줄이 없다. 칸을 누르는 것이 곧 고르는 것이라 확인할 것이 없고, 바깥을 누르면 닫힌다.
 */
import type { ReactNode } from 'react'
import { Linking, Pressable, View } from 'react-native'

import { ExternalLinkIcon, HeadsetIcon, KakaoTalkIcon, MailIcon, Text } from '../../components/atoms'
import { ModalHeader } from '../../components/molecules/ModalHeader/ModalHeader'
import { Modal } from '../../components/organisms/Modal/Modal'
import { useToastStore } from '../../features/toast/store'
import { openContactOpenChat } from './contact-open-chat'

export interface ContactModalProps {
  /** 기기 정보가 든 `mailto:` 주소(`contactMailUrl`) */
  mailUrl: string
  onClose: () => void
}

function ContactCell(props: { icon: ReactNode; label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      role="button"
      onPress={props.onPress}
      className="flex-row items-center gap-3 rounded-[10px] bg-card-inset p-3"
    >
      {props.icon}
      <Text className="min-w-0 flex-1 text-sm font-semibold text-text">{props.label}</Text>
      <ExternalLinkIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}

export function ContactModal(props: ContactModalProps): React.JSX.Element {
  // 모달부터 닫는다. 앱으로 돌아왔을 때 모달이 남아 있으면 다시 고르라는 것처럼 보인다.
  function choose(open: () => void): void {
    props.onClose()
    open()
  }

  return (
    <Modal onClose={props.onClose} testId="contact-modal-overlay" align="center">
      <Modal.Card>
        <View className="gap-4">
          <ModalHeader icon={HeadsetIcon} tone="primary" title="문의 · 버그 제보" />
          <View className="gap-1.5">
            <ContactCell
              label="메일"
              icon={
                <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint">
                  <MailIcon className="h-[18px] w-[18px] text-primary-ink" strokeWidth={1.75} aria-hidden />
                </View>
              }
              onPress={() =>
                choose(() => {
                  Linking.openURL(props.mailUrl).catch(() =>
                    useToastStore.getState().showError('메일 앱을 열지 못했습니다'),
                  )
                })
              }
            />
            <ContactCell
              label="카카오톡 오픈채팅"
              icon={<KakaoTalkIcon size={32} />}
              onPress={() => choose(openContactOpenChat)}
            />
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}
