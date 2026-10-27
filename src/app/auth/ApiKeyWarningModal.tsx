/**
 * `API 키로 시작하기` 를 누르면 뜨는 경고. 키로 가기 전에 넥슨 로그인을 한 번 더 권한다.
 *
 * 앞으로 일부 기능은 넥슨 로그인으로만 쓸 수 있게 된다. 어떤 기능인지는 적지 않는다. 목록이 아직 정해지지 않아,
 * 적으면 거짓이 될 수 있다.
 *
 * 두 버튼 모두 모달을 닫는다. 무엇을 이어서 할지는 화면이 정한다(넥슨 로그인 시작 · 키 입력 시트 열기).
 *
 * 패널은 테두리가 없다. 다크에서는 시트처럼 표면을 한 단 올려 스크림과 가른다. 게임 데이터 잠금 화면과 같은 모양이다.
 */
import { vars } from 'nativewind'
import { Pressable, View } from 'react-native'

import { AlertTriangleIcon, LockIcon, Text } from '../../components/atoms'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { Modal } from '../../components/organisms/Modal/Modal'
import { keepWords } from '../../lib/keep-words'
import { useThemeAppearance } from '../../theme/context'
import { buildSheetScopeVariables } from '../../theme/theme-vars'

export function ApiKeyWarningModal(props: {
  /** 스크림 · 뒤로가기. 첫 화면으로 돌아간다 */
  onClose: () => void
  onNexonLogin: () => void
  onContinueWithApiKey: () => void
}): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <Modal testId="api-key-warning" align="center" onClose={props.onClose}>
      <Modal.Panel>
        <View style={vars(buildSheetScopeVariables(definition))} className="gap-4 rounded-[14px] bg-surface p-6">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-error-tint">
              <AlertTriangleIcon className="h-5 w-5 text-error-ink" strokeWidth={1.75} aria-hidden />
            </View>
            <Text className="flex-1 text-base font-semibold text-text">API 키로 시작할까요?</Text>
          </View>

          <View className="gap-1.5">
            {/* 자물쇠인 것은 머리 줄의 경고 삼각형과 겹치지 않게 하려는 것이다. 칸이 말하는 것은 잠긴 기능이다. */}
            <View className="flex-row items-center gap-2.5 rounded-[10px] bg-card-inset px-3 py-2.5">
              <LockIcon className="h-[18px] w-[18px] text-error-ink" strokeWidth={1.75} aria-hidden />
              <Text className="flex-1 text-13 text-text">{keepWords('일부 기능은 넥슨 로그인으로만 쓸 수 있어요')}</Text>
            </View>
            <View className="rounded-[10px] bg-card-inset px-3 py-2.5">
              {/* 단어 가운데서 줄이 바뀌지 않게 묶는다. RN 은 한글을 글자 사이에서도 줄을 바꾼다. */}
              <Text className="text-13 text-text-muted">{keepWords('앞으로 나오는 기능도 넥슨 로그인을 기준으로 만들어요.')}</Text>
            </View>
          </View>

          <View className="gap-1">
            <NexonLoginButton onPress={props.onNexonLogin} />
            <Pressable
              role="button"
              onPress={props.onContinueWithApiKey}
              className="self-center px-3 pb-0.5 pt-2.5"
            >
              <Text className="text-13 text-text-muted">그래도 API 키로 시작하기</Text>
            </Pressable>
          </View>
        </View>
      </Modal.Panel>
    </Modal>
  )
}
