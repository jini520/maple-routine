// 설정 하위 페이지 「캐릭터 관리」([[ADR-144]] 결정 1) — **모달이 아니라 페이지다.**
//
// 두 층 + 드롭다운 + 순서 + 대표가 한 화면에 서면 385px 모달 본문([[ADR-107]] 결정 2)에 들어가지
// 않는다. 그래서 `설정 → 캐릭터 관리` 가 여는 것이 모달에서 화면 push 로 바뀌었고, 카드 1 의
// 성질(«고르면 그 자리에서 끝난다»)은 유지된다 — 화면이 pop 되면 설정으로 돌아온다.
//
// **본문은 이 파일에 없다.** `CharacterManageBody` + `useCharacterManage` 가 갖고, 온보딩 캐릭터
// 선택 단계가 같은 것을 페이지로 쓴다(결정 1 — 갈리는 것은 머리와 CTA 뿐이다). 여기 있는 것은
// `←` + 제목 · 「닫기/저장」 · 저장 배선 셋이다.
//
// ── 고정 영역을 만들지 않는다 ([[ADR-131]]) ─────────────────────────────────────────
//
// 두 층도 CTA 도 페이지와 함께 굴러간다. 위 리스트가 길면 아래 목록이 화면 밖으로 나가는데
// ([[ADR-144]] 대가), «아래를 화면에 붙여 둔다» 는 그 ADR 을 정면으로 되돌리는 것이라 하지 않는다.
//
// ── 저장 ([[ADR-144]] 결정 7 · [[ADR-140]] 결정 4·5) ────────────────────────────────
//
// 저장 로직을 새로 갖지 않는다 — 통합 키 쓰기·수동 모드 시드·추가분만 동기화·진행률 보고가
// `saveTrackedOcids` 에 한 벌로 들어 있다. **대표는 그 뒤에 쓴다**: 목록 저장이 먼저 돌면서
// 목록에 없는 대표를 지우므로(`setTrackedCharacterOcids` 의 참조 무결성), 순서를 뒤집으면 방금
// 고른 대표가 지워질 수 있다.
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { useContentSchedulerStore } from '@core/features/content-scheduler/store'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import {
  clearRepresentativeCharacter,
  setRepresentativeCharacter,
} from '@core/storage/character-selection'

import { Button } from '../../components/atoms/Button/Button'
import { CharacterManageBody } from '../../components/organisms/CharacterManage/CharacterManageBody'
import { useCharacterManage } from '../../components/organisms/CharacterManage/use-character-manage'
import { useReorderScroll } from '../../components/organisms/CharacterManage/use-reorder-scroll'
import { ProgressModal } from '../../components/organisms/ProgressModal/ProgressModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowLeftIcon } from '../../lib/icons'
import { reloadTabStores } from './reload-tab-stores'
import { useSettingsNavigation } from './use-settings-navigation'

export function SettingsCharactersScreen(): React.JSX.Element {
  const { saveTrackedOcids } = useContentSchedulerStore()
  const navigation = useSettingsNavigation()
  const manage = useCharacterManage()
  // 끌어서 순서를 바꾸는 동안 화면 가장자리에서 자동으로 굴러간다([[ADR-144]] 결정 5). 이 화면에는
  // 고정 영역이 없어([[ADR-131]]) 굴릴 것이 페이지 자신뿐이고, 그래서 그 배선은 스크롤 뷰를 가진
  // **화면**의 것이다 — 컨트롤러에 실으면 그 객체가 ref 를 품어 읽는 자리마다 `react-hooks/refs`
  // 에 걸린다. 온보딩 단계도 같은 두 줄을 갖는다(결정 1 — 갈리는 것은 머리와 CTA 다).
  const { scrollRef, onScroll, scroll } = useReorderScroll()
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)

  // [[ADR-115]] 결정 7 · [[ADR-116]] 결정 1: 두 조회가 맞는 401·429 도 키 재입력 진입점으로 간다.
  // 두 번 부르는 것은 두 겹이 아니다 — 훅은 값 하나를 지켜보고, 멱등은 스토어 가드가 진다.
  useApiKeyNotice(manage.rosterError)
  useApiKeyNotice(manage.accountsError)

  const isSaveDisabled = !manage.isDirty || manage.selectedOcids.length === 0

  async function handleSave(): Promise<void> {
    const ocids = manage.selectedOcids
    const representative = manage.representativeOcid
    setSaveProgress({ completed: 0, total: ocids.length })
    // 저장이 실패해도 진행률 모달은 항상 닫는다 — 안 그러면 모달이 멈춘다(피커가 하던 그대로).
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
    // 컨텐츠는 빠진다([[ADR-140]] 결정 5) — 저장의 주체가 그 스토어라 이미 최신이다.
    reloadTabStores(['boss', 'profit'])
  }

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        ref={scrollRef}
        onScroll={onScroll}
        header={
          <PageHeader>
            <View className="flex-row items-center gap-2">
              <Pressable
                role="button"
                aria-label="뒤로"
                onPress={() => navigation.goBack()}
                className="-ml-1 p-1"
              >
                <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
              </Pressable>
              <Text className="text-lg font-semibold text-text">캐릭터 관리</Text>
            </View>
          </PageHeader>
        }
      >
        {/* `screen-<라우트 이름>` 은 나머지 하위 페이지와 같은 관례다. */}
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsCharacters">
          {/* 이 자리의 401·429 는 곧 키 입력 화면으로 옮겨간다(위 `useApiKeyNotice`) — 그래서
              실패 문구도 그렇게 말하는 피커 어휘다([[ADR-115]] 결정 7). */}
          <CharacterManageBody manage={manage} scroll={scroll} place="picker" />

          <View className="flex-row justify-end gap-2">
            <Button variant="text" onPress={() => navigation.goBack()}>
              닫기
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                void handleSave()
              }}
              disabled={isSaveDisabled}
              // 웹의 `disabled:opacity-50` 은 CSS 의사 클래스라 RN 의 `disabled` 프롭과 이어지지
              // 않는다 — 그대로 두면 비활성 버튼이 멀쩡한 색으로 보인다(피커와 같은 처방).
              className={isSaveDisabled ? 'opacity-50' : undefined}
              textClassName="text-sm"
            >
              저장
            </Button>
          </View>
        </View>
      </ScreenScroll>

      {saveProgress !== null && (
        <ProgressModal
          message="캐릭터 정보를 저장하고 있어요"
          completed={saveProgress.completed}
          total={saveProgress.total}
        />
      )}
    </>
  )
}
