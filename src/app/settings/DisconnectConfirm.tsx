// 연결 해제 확인 — 파괴적 동작이라 확인을 한 번 받는다.
//
// ── RN 으로 옮기며 갈린 것 셋 ────────────────────────────────────────────────────────
//
// ① **자체 오버레이 → 공용 `Modal`.** 설정 모달 중 마지막까지 `fixed inset-0` 를 직접 그리던
//    자리였는데, RN 에서는 그 방법이 **아예 성립하지 않는다** — `absolute inset-0` 은 부모 상자에
//    갇혀 탭바조차 못 덮는다(`Modal.tsx` 파일 머리 ①). 골라서 바꾼 것이 아니라 짝이 없어서다.
//    딸려서 `stopPropagation`(바깥 클릭만 닫기)도 `Modal.Card` 의 responder 선언이 대신한다.
// ② **`useBodyScrollLock` 이 사라진다.** 뒤 문서 스크롤 잠금을 네이티브 윈도우가 구조적으로 한다
//    — 대체가 아니라 필요 자체가 없어진 것이라 짝을 만들지 않는다(`Modal.tsx` 파일 머리 ②).
//    웹 테스트의 「뒷 페이지 스크롤을 막고 복원한다」는 그래서 옮길 계약이 아니다.
// ③ `disabled:opacity-50` → 조건부 클래스(NativeWind 의 `disabled:` 는 `Pressable` 프롭과 안 이어진다).
//
// 카드 폭·여백(`max-w-sm p-6`)과 세로 중앙 정렬은 `Modal.Card` + `align="center"` 가 그대로 낸다.
import { View } from 'react-native'

import { Button, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'

export interface DisconnectConfirmProps {
  isOpen: boolean
  isDisconnecting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectConfirm(props: DisconnectConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <Modal onClose={props.onCancel} testId="disconnect-confirm-overlay" align="center">
      <Modal.Card>
        <View className="gap-4">
          <View className="gap-1">
            <Text className="text-lg font-semibold text-text">연결을 해제할까요?</Text>
            <Text className="text-sm text-text-muted">
              API 키와 계정 연결이 해제되고 온보딩 화면으로 돌아갑니다. 보스 수익·드랍 기록은
              삭제되지 않습니다.
            </Text>
          </View>

          <View className="flex-row justify-end gap-2">
            <Button
              variant="text"
              disabled={props.isDisconnecting}
              onPress={props.onCancel}
              className={props.isDisconnecting ? 'opacity-50' : undefined}
            >
              취소
            </Button>
            <Button
              variant="danger"
              disabled={props.isDisconnecting}
              busy={props.isDisconnecting}
              onPress={props.onConfirm}
              className={`flex-row items-center justify-center${
                props.isDisconnecting ? ' opacity-50' : ''
              }`}
            >
              연결 해제
            </Button>
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}
