/**
 * 설정 하위 페이지 `캐릭터 관리`. 모달이 아니라 화면이다.
 *
 * **본문은 이 파일에 없다.** `CharacterManageBody` + `useCharacterManage` 가 갖고 온보딩 단계가 같은
 * 것을 쓴다. 여기 있는 것은 `←` + 제목 · 저장 바 · 저장 배선 셋이다.
 *
 * 지키는 것 셋.
 *
 * ① 고정되는 것은 **저장 버튼 하나**다. 두 층은 페이지와 함께 굴러간다. 이 화면은 스크롤이 길고
 *    저장은 어디까지 굴렸든 지금 할 수 있어야 하는 일이라 여기만 예외다.
 * ② **바 높이를 상수로 적지 않는다.** `onLayout` 으로 잰다. 손으로 적으면 글자 크기·안전영역이
 *    바뀌는 기기에서 마지막 행이 바 뒤로 숨는다.
 * ③ **대표는 목록 저장 뒤에 쓴다.** 순서가 뒤집히면 목록 저장의 참조 무결성이 아직 목록에 없는
 *    대표를 지운다.
 *
 * 저장 로직을 새로 갖지 않는다. `saveTrackedOcids` 한 벌에 통합 키 쓰기 · 수동 모드 시드 ·
 * 추가분만 동기화 · 진행률 보고가 들어 있다.
 */
import { useState } from 'react'
import { Pressable, View, type ScrollView } from 'react-native'
import { useAnimatedRef } from 'react-native-reanimated'

import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { useApiKeyNotice } from '../../features/auth/use-api-key-notice'
import {
  clearRepresentativeCharacter,
  setRepresentativeCharacter,
} from '../../storage/character-selection'

import { ArrowLeftIcon, Button, Text } from '../../components/atoms'
import { CharacterManageBody } from '../../components/organisms/CharacterManage/CharacterManageBody'
import { useCharacterManage } from '../../hooks/useCharacterManage'
import { ProgressModal } from '../../components/organisms/ProgressModal/ProgressModal'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useBottomSafeAreaPx } from '../../lib/safe-area'
import { reloadTabStores } from './reload-tab-stores'
import { useSettingsNavigation } from './use-settings-navigation'

export function SettingsCharactersScreen(): React.JSX.Element {
  const { saveTrackedOcids } = useContentSchedulerStore()
  const navigation = useSettingsNavigation()
  const manage = useCharacterManage()
  // 끌어서 순서를 바꾸는 동안 화면 가장자리에서 자동으로 굴러간다. 이 화면에는 고정 영역이
  // 없어 굴릴 것이 페이지 자신뿐이고, 그래서 그 ref 는 스크롤 뷰를 가진 화면의 것이다.
  // 컨트롤러에 실으면 그 객체가 ref 를 품어 읽는 자리마다 `react-hooks/refs` 에 걸린다.
  const scrollableRef = useAnimatedRef<ScrollView>()
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)
  // 하단 액션 바가 안전영역을 먹는다(아래). 그 **안전영역** 은 인셋이 아니라 하한이 깔린 값이다
  // 이 화면만 인셋으로 두면 하위 페이지들과 바닥 여백이 갈린다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  // 고정 바가 덮는 높이. 잰 값이 오기 전에는 0이라 마지막 행이 한 프레임 가려질 수 있지만, 그
  // 프레임은 바가 그려지는 바로 그 프레임이라 사용자가 스크롤을 시작하기 전이다.
  const [actionBarHeightPx, setActionBarHeightPx] = useState(0)

  // 두 조회가 맞는 401·429 도 키 재입력 진입점으로 간다.
  // 두 번 부르는 것은 두 겹이 아니다. 훅은 값 하나를 지켜보고, 멱등은 스토어 가드가 진다.
  useApiKeyNotice(manage.rosterError)
  useApiKeyNotice(manage.accountsError)

  const isSaveDisabled = !manage.isDirty || manage.selectedOcids.length === 0

  async function handleSave(): Promise<void> {
    const ocids = manage.selectedOcids
    const representative = manage.representativeOcid
    setSaveProgress({ completed: 0, total: ocids.length })
    // 저장이 실패해도 진행률 모달은 항상 닫는다. 안 그러면 모달이 멈춘다(피커가 하던 그대로).
    try {
      await saveTrackedOcids(ocids, (completed, total) => setSaveProgress({ completed, total }))
      if (representative === null) {
        await clearRepresentativeCharacter()
      } else {
        await setRepresentativeCharacter(representative)
      }
    } finally {
      setSaveProgress(null)
      navigation.goBack()
    }
    // 컨텐츠는 빠진다. 저장의 주체가 그 스토어라 이미 최신이다.
    reloadTabStores(['boss', 'profit'])
  }

  return (
    <View className="flex-1">
      <ScreenScroll
        hasTabBar={false}
        ref={scrollableRef}
        tracksScrollOffset
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <Pressable
                role="button"
                aria-label="뒤로"
                onPress={() => navigation.goBack()}
                className="-ml-1 p-1"
              >
                <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
              </Pressable>
              <Text className="text-lg font-semibold text-text">캐릭터 관리</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* `screen-<라우트 이름>` 은 나머지 하위 페이지와 같은 관례다. */}
        <View
          className="gap-4 px-4 pb-4"
          testID="screen-SettingsCharacters"
          // 잰 바 높이만큼 콘텐츠 아래를 비운다. 안 그러면 마지막 행이 바 뒤에 영영 숨는다.
          style={{ paddingBottom: actionBarHeightPx }}
        >
          {/* 이 자리의 401·429 는 곧 키 입력 화면으로 옮겨간다(위 `useApiKeyNotice`). 그래서
              실패 문구도 그렇게 말하는 피커 어휘다. */}
          <CharacterManageBody manage={manage} scrollableRef={scrollableRef} place="picker" />
        </View>
      </ScreenScroll>

      {/* 스크롤 뷰의 형제이자 절대 배치라 굴러가지 않는다. 불투명해야 하는 것은 콘텐츠가 이
          아래를 지나가기 때문이고, 색은 카드가 아니라 페이지 바닥이라 `bg-bg` 다. 안전영역은
          이 바가 먹는다. 스크롤포트는 `ScreenScroll` 이 이미 자기 몫을 뺐다. */}
      <View
        testID="character-manage-action-bar"
        className="absolute inset-x-0 bottom-0 border-t border-border bg-bg px-4 pt-3"
        style={{ paddingBottom: bottomSafeAreaPx + 12 }}
        onLayout={(event) => setActionBarHeightPx(event.nativeEvent.layout.height)}
      >
        <Button
          variant="primary"
          onPress={() => {
            void handleSave()
          }}
          disabled={isSaveDisabled}
          // CSS 의사 클래스가 없어 `disabled` 프롭과 이어지지
          // 않는다. 그대로 두면 비활성 버튼이 멀쩡한 색으로 보인다(피커와 같은 처방).
          className={`w-full items-center${isSaveDisabled ? ' opacity-50' : ''}`}
        >
          저장
        </Button>
      </View>

      {saveProgress !== null && (
        <ProgressModal
          message="캐릭터 정보를 저장하고 있어요"
          completed={saveProgress.completed}
          total={saveProgress.total}
        />
      )}
    </View>
  )
}
