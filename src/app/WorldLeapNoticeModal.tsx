/**
 * 월드 이전으로 보이는 캐릭터를 관리 목록에서 어떻게 할지 묻는 모달.
 *
 * **어느 화면에 있든 뜬다.** 판정이 동기화(부팅 포함)와 로스터 조회 양쪽에서 나므로 묻는 자리도
 * 화면 하나에 가둘 수 없다. 자리가 `AppNavigation` 인 이유는 조건이 둘이기 때문이다. 어느
 * 화면에서든 떠야 하니 화면 안은 안 되고, `캐릭터 관리로 이동` 이 내비게이션을 잡아야 하니
 * 컨테이너 밖인 `AppShell` 도 안 된다(`UpdatePromptModal` 이 같은 이유로 그 자리에 있다).
 *
 * **묻는 얼굴이 둘이다.** 목적지를 짚었으면 `변경` 이고, 못 짚었으면 `캐릭터 관리로 이동` 이다.
 * 후자는 닉네임을 바꾸고 리프한 경우가 대표인데, 그때 앱이 아는 것은 **옮겼다는 사실과 옛
 * 이름**뿐이라 바꿀 대상이 없다. 할 일이 없는 버튼은 버튼이 아니므로, 사용자가 직접 고르는
 * 자리로 보낸다.
 *
 * `ApiKeyNoticeModal` 과 두 곳이 갈린다. **닫을 수 있고**(뒤 화면이 멀쩡히 돌아 안 바꿔도 앱을
 * 그대로 쓴다) **버튼이 둘이다**.
 *
 * 주 버튼이 `변경` 인 것은 이 동작이 되돌릴 수 있어서다. 바뀌는 것은 추적 목록의 ocid 하나뿐이고
 * 기록은 어느 쪽으로도 안 옮긴다. 틀리면 캐릭터 관리에서 다시 고르면 된다.
 *
 * 어느 캐릭터인지 **월드로 말한다**. 두 캐릭터의 이름·레벨·직업이 같아서 이름만으로는 무엇이
 * 무엇으로 바뀌는지 문장이 성립하지 않는다. 모르는 목적지는 `?` 로 비운다.
 *
 * 바꾼 뒤 앱 상태로 흘리는 것이 둘이다. 저장소(`replaceTrackedCharacter`, 스토어의 `confirm`
 * 안) · 스케줄러 스토어(`saveTrackedOcids` 가 새로 든 캐릭터를 시드하고 동기화한다). 화면의
 * 초안은 여기서 안 부르고 `useSelectionDraft` 가 스토어를 구독한다.
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 톤 · 문구뿐이다.
 */
import { View } from 'react-native'

import { useWorldLeapStore } from '../features/character-manage/world-leap-store'
import { useContentSchedulerStore } from '../features/content-scheduler/store'

import { ArrowRightIcon, Text } from '../components/atoms'
import { NoticeModal } from '../components/organisms/NoticeModal/NoticeModal'

export interface WorldLeapNoticeModalProps {
  /** 목적지를 못 짚었을 때 보낼 곳. 내비게이션을 쥔 쪽이 넘긴다. */
  onOpenCharacterManage: () => void
}

export function WorldLeapNoticeModal(props: WorldLeapNoticeModalProps): React.JSX.Element | null {
  const notice = useWorldLeapStore((state) => state.notice)
  const confirm = useWorldLeapStore((state) => state.confirm)
  const dismiss = useWorldLeapStore((state) => state.dismiss)
  const saveTrackedOcids = useContentSchedulerStore((state) => state.saveTrackedOcids)

  async function handleConfirm(): Promise<void> {
    const replaced = await confirm()
    if (replaced === null) {
      return
    }
    await saveTrackedOcids(replaced)
  }

  // 닫고 보낸다. 안 닫으면 방금 보낸 그 화면을 이 모달이 그대로 덮는다.
  function handleOpenCharacterManage(): void {
    dismiss()
    props.onOpenCharacterManage()
  }

  // falsy 검사인 것이 의도다. 스토어를 부분 모킹한 테스트에서 `undefined` 가 와도 모달이 안 뜬다.
  if (!notice) {
    return null
  }

  const action =
    notice.kind === 'confirmed'
      ? { label: '변경', onPress: () => void handleConfirm() }
      : { label: '캐릭터 관리로 이동', onPress: handleOpenCharacterManage }

  return (
    <NoticeModal
      icon={ArrowRightIcon}
      // 실패가 아니라 알아차린 것 이라 `error` 가 아니다. 사용자가 잘못한 일이 없고 처방도
      // 한 번의 선택뿐이라, 안내 모달이 쓰는 `third` 를 그대로 쓴다.
      tone="third"
      title={`${notice.from.name} 님이 월드를 옮긴 것 같아요`}
      content={
        <View className="flex-row items-center justify-center gap-2">
          <Text className="text-sm text-text-muted">{notice.from.world}</Text>
          <ArrowRightIcon className="h-3.5 w-3.5 text-text-muted" aria-hidden />
          <Text className="text-sm font-semibold text-text">
            {notice.kind === 'confirmed' ? notice.to.world : '?'}
          </Text>
        </View>
      }
      description={
        notice.kind === 'confirmed'
          ? '관리 캐릭터를 옮긴 월드 기준으로 바꿀까요? 지난 기록은 그대로 남습니다.'
          : '옮겨간 캐릭터를 찾지 못했어요. 캐릭터 관리에서 직접 바꿔주세요. 지난 기록은 그대로 남습니다.'
      }
      action={action}
      secondaryAction={{ label: '나중에', onPress: dismiss }}
      onClose={dismiss}
      testId="world-leap-notice-overlay"
    />
  )
}
