/**
 * today 머리의 `넥슨 ID 연동하기` 가 여는 연동 시트. 제목 · 설명 두 줄 · 넥슨 버튼 · 소개 링크가 왼쪽 정렬로 선다.
 *
 * @see docs/features/auth.md 넥슨 로그인
 */
import { View } from 'react-native'

import { Text } from '../../components/atoms'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { DataUtilLoginLink } from './DataUtilLoginLink'

const TITLE = '넥슨 ID 연동하기'

export function NexonLinkSheet(props: {
  onClose: () => void
  /** 넥슨 버튼. 시트를 닫는 것까지 부르는 쪽이 한다. */
  onSignIn: () => void
}): React.JSX.Element {
  return (
    <BottomSheet label={TITLE} onClose={props.onClose}>
      <View className="gap-5 px-6">
        <View className="gap-1">
          <Text className="text-base font-bold text-text">{TITLE}</Text>
          {/* 줄은 손으로 나눈다. 자동 줄바꿈은 폭에 따라 말 가운데서 꺾는다. 두 줄 모두 폭 320 에서 한 줄에 든다. */}
          <View>
            <Text className="text-xs text-text-muted">일부 기능은 넥슨 로그인으로만 쓸 수 있어요.</Text>
            <Text className="text-xs text-text-muted">앞으로 나오는 기능도 넥슨 로그인을 기준으로 만들어요.</Text>
          </View>
        </View>

        <View className="gap-3">
          <NexonLoginButton onPress={props.onSignIn} />
          <DataUtilLoginLink />
        </View>
      </View>
    </BottomSheet>
  )
}
