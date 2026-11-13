/**
 * 계정 관리에서 넣은 키가 검증에 걸렸을 때 띄우는 모달. 제목과 주 버튼은 같고, 안내만 걸린 이유마다 다르다.
 *
 * 닫으면 키 입력 시트로 돌아간다. 시트는 그대로 서 있어 키를 다시 넣는다.
 */
import { View } from 'react-native'

import { KeyRoundIcon } from '../../components/atoms'
import { InsetNote, InsetRow } from '../../components/molecules/InsetRow/InsetRow'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import type { KeyRejection } from '../../features/account-manage/validate-key'
import { openInAppBrowser } from '../../native/browser'
import { GUIDE_URL } from './api-key-links'

const NOTES: Record<Exclude<KeyRejection, 'developmentStage'>, string> = {
  invalid: '넥슨 Open API 에서 확인되지 않는 키예요. 키를 다시 확인해 주세요.',
  noMapleId: '이 API 키에 연결된 메이플 ID 를 찾지 못했어요.',
  alreadyRegistered: '이미 등록된 넥슨 계정의 키예요. 같은 넥슨 계정은 한 번만 등록할 수 있어요.',
  otherAccount: '이 계정과 넥슨 계정이 일치하지 않는 키예요. 다른 API 키를 넣어 주세요.',
}

export function UnregistrableKeyModal(props: { reason: KeyRejection; onClose: () => void }): React.JSX.Element {
  // 키를 새로 받아야 하는 이유에만 발급 안내를 단다. 이미 등록된 계정이나 다른 계정의 키는 키를 고르는 문제다.
  const needsGuide = props.reason === 'developmentStage' || props.reason === 'invalid'
  return (
    <NoticeModal
      icon={KeyRoundIcon}
      tone="error"
      title="등록할 수 없는 키예요"
      titleTestId="unregistrable-key-title"
      content={
        props.reason === 'developmentStage' ? (
          <View className="gap-1.5">
            <InsetRow label="넣으신 키" value="개발 단계" valueClassName="text-xs text-text-muted" />
            <InsetRow label="필요한 키" value="서비스 단계" valueClassName="text-xs font-bold text-primary-ink" />
          </View>
        ) : (
          <InsetNote>{NOTES[props.reason]}</InsetNote>
        )
      }
      action={{ label: '다시 입력하기', onPress: props.onClose }}
      link={needsGuide ? { label: 'API 키 발급 방법 보기', onPress: () => openInAppBrowser(GUIDE_URL) } : undefined}
      onClose={props.onClose}
      testId="unregistrable-key"
    />
  )
}
