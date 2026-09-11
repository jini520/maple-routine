/**
 * 월드 이전으로 보이는 캐릭터를 관리 목록에서 갈아끼울지 묻는 모달.
 *
 * **캐릭터 관리 본문 안에 산다.** 판정은 로스터 조회(`getCharacterPickerRoster`) 중에만 나고 그
 * 조회는 이 화면에서만 돌므로, 이 모달이 뜰 수 있는 자리도 여기 하나다. 앱 셸에 두면 초안
 * (`useSelectionDraft`)에 손이 안 닿는데, 그 초안까지 함께 고치지 않으면 **사용자가 편집 중일 때
 * 저장 버튼 한 번에 방금 뺀 죽은 ocid 가 되살아난다**.
 *
 * `ApiKeyNoticeModal` 과 두 곳이 갈린다. **닫을 수 있고**(뒤 화면이 멀쩡히 돌아 안 바꿔도 앱을
 * 그대로 쓴다) **버튼이 둘이다**(`변경` · `나중에`).
 *
 * 주 버튼이 `변경` 인 것은 이 동작이 되돌릴 수 있어서다. 바뀌는 것은 추적 목록의 ocid 하나뿐이고
 * 기록은 어느 쪽으로도 안 옮긴다. 틀리면 캐릭터 관리에서 다시 고르면 된다.
 *
 * 어느 캐릭터인지 **월드로 말한다**. 두 캐릭터의 이름·레벨·직업이 같아서 이름만으로는 무엇이
 * 무엇으로 바뀌는지 문장이 성립하지 않는다.
 *
 * 바꾼 뒤 앱 상태로 흘리는 것이 셋이다. 저장소(`replaceTrackedCharacter`) · 스케줄러 스토어
 * (`saveTrackedOcids` 가 새로 든 캐릭터를 시드하고 동기화한다) · 화면의 초안(`renameCharacter`).
 * 하나라도 빠지면 세 진실이 갈린다.
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 톤 · 문구뿐이다.
 */
import { View } from 'react-native'

import { useWorldLeapStore } from '../../../features/character-manage/world-leap-store'
import { useContentSchedulerStore } from '../../../features/content-scheduler/store'

import { ArrowRightIcon, Text } from '../../atoms'
import { NoticeModal } from '../NoticeModal/NoticeModal'

export interface WorldLeapNoticeModalProps {
  /** 초안의 그 자리도 새 ocid 로 옮긴다. `useCharacterManage` 의 `renameCharacter`. */
  onRenamed: (fromOcid: string, toOcid: string) => void
}

export function WorldLeapNoticeModal(props: WorldLeapNoticeModalProps): React.JSX.Element | null {
  const candidate = useWorldLeapStore((state) => state.candidate)
  const confirm = useWorldLeapStore((state) => state.confirm)
  const dismiss = useWorldLeapStore((state) => state.dismiss)
  const saveTrackedOcids = useContentSchedulerStore((state) => state.saveTrackedOcids)

  async function handleConfirm(from: string, to: string): Promise<void> {
    const replaced = await confirm()
    if (replaced === null) {
      return
    }
    await saveTrackedOcids(replaced)
    props.onRenamed(from, to)
  }

  // falsy 검사인 것이 의도다. 스토어를 부분 모킹한 테스트에서 `undefined` 가 와도 모달이 안 뜬다.
  if (!candidate) {
    return null
  }

  return (
    <NoticeModal
      icon={ArrowRightIcon}
      // 실패가 아니라 알아차린 것 이라 `error` 가 아니다. 사용자가 잘못한 일이 없고 처방도
      // 한 번의 선택뿐이라, 안내 모달이 쓰는 `third` 를 그대로 쓴다.
      tone="third"
      title={`${candidate.from.name} 님이 월드를 옮긴 것 같아요`}
      content={
        <View className="flex-row items-center justify-center gap-2">
          <Text className="text-sm text-text-muted">{candidate.from.world}</Text>
          <ArrowRightIcon className="h-3.5 w-3.5 text-text-muted" aria-hidden />
          <Text className="text-sm font-semibold text-text">{candidate.to.world}</Text>
        </View>
      }
      description="관리 캐릭터를 옮긴 월드 기준으로 바꿀까요? 지난 기록은 그대로 남습니다."
      action={{
        label: '변경',
        onPress: () => void handleConfirm(candidate.from.ocid, candidate.to.ocid),
      }}
      secondaryAction={{ label: '나중에', onPress: dismiss }}
      onClose={dismiss}
      testId="world-leap-notice-overlay"
    />
  )
}
