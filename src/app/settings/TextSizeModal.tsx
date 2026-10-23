/**
 * 글자 크기 고르는 모달. 테마 모달처럼 **적용은 즉시지만 닫기는 따라오지 않는다.**
 *
 * 고르는 즉시 이 모달까지 새 크기로 다시 그려지므로, 열어 둔 채로 단계를 바꿔 가며 미리보기 글을 비교한다.
 */
import { View } from 'react-native'

import { useTextSizeStore } from '../../features/text-size/store'
import { TEXT_SIZE_LABELS, TEXT_SIZES } from '../../lib/text-size'

import { Button, Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { Modal } from '../../components/organisms/Modal/Modal'

/** 미리보기 글. 테스트가 이 글로 미리보기를 찾는다. */
export const TEXT_SIZE_PREVIEW = '이 크기로 앱의 모든 글자가 보입니다.'

export interface TextSizeModalProps {
  onClose: () => void
}

export function TextSizeModal(props: TextSizeModalProps): React.JSX.Element {
  const { size, selectSize } = useTextSizeStore()

  return (
    <Modal onClose={props.onClose} testId="text-size-modal-overlay">
      <Modal.Card
        footer={
          <View className="mt-4 flex-row justify-end">
            <Button variant="primary" onPress={props.onClose} textClassName="text-sm">
              완료
            </Button>
          </View>
        }
      >
        <View className="mb-4 gap-1">
          <Text className="text-lg font-semibold text-text">글자 크기</Text>
          <Text className="text-sm text-text-muted">원하는 글자 크기를 선택해주세요.</Text>
        </View>
        <View className="mb-4 rounded-xl bg-surface-2 px-4 py-3">
          <Text className="text-sm text-text">{TEXT_SIZE_PREVIEW}</Text>
        </View>
        <Segment
          size="tab"
          options={TEXT_SIZES}
          selected={size}
          labelOf={(option) => TEXT_SIZE_LABELS[option]}
          onSelect={(next) => {
            void selectSize(next)
          }}
        />
      </Modal.Card>
    </Modal>
  )
}
