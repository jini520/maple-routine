/**
 * 캐릭터 설정 화면. 앱이 관리할 캐릭터를 고른다.
 *
 * **온보딩의 한 단계가 아니라 화면이다.** 고른 캐릭터가 이 앱이 하는 일 전부의 입력이라, 로그인과
 * 같은 층에 선다.
 *
 * 본문은 이 파일에 없다. 설정 하위 페이지(`SettingsCharactersScreen`)와 같은
 * `CharacterManageBody` + `useCharacterManage` 를 쓰고, 여기 있는 것은 제목 블록 · `계속하기` ·
 * 최소 1개 게이트 · 저장 배선이다.
 *
 * 지키는 것 넷.
 *
 * ① 401 을 키 재입력 진입점에 안 넘긴다. 여기의 401 은 방금 넣은 키가 나쁘다는 뜻이라 폼 자체의
 *    실패로 남아야 다시 시도 가 처방이 된다. 넘기는 것은 429 뿐이다. 그쪽은 하드 잠금이라
 *    되돌릴 UI 가 없다.
 * ② **대표는 목록 저장 뒤에 쓴다.** 순서가 뒤집히면 목록 저장의 참조 무결성이 아직 목록에 없는
 *    대표를 지운다(`SettingsCharactersScreen` 과 같은 순서).
 * ③ 이 화면이 셸(`EntryScroll`)을 직접 두른다. 바의 활성 조건이 `useCharacterManage` 안에 있어
 *    그 훅을 부르는 컴포넌트가 스크롤과 바 둘 다의 조상이어야 한다.
 * ④ **대기 표시가 두 단이다.** 저장 중에는 CTA 만 스피너이고, 시드가 시작되면 화면 전체가
 *    스피너다. 시드는 고른 캐릭터 수만큼 걸려서 CTA 스피너로는 멈춘 것처럼 보인다.
 *
 * @see docs/features/app-entry.md 정책
 */
import { useState } from 'react'
import { View, type ScrollView } from 'react-native'
import { useAnimatedRef } from 'react-native-reanimated'

import { useAppEntryStore } from '../../features/app-entry/store'
import { useApiKeyNotice } from '../../features/auth/use-api-key-notice'
import {
  clearRepresentativeCharacter,
  setRepresentativeCharacter,
} from '../../storage/character-selection'

import { Button, MapleSweepSpinner, Text } from '../../components/atoms'
import { CharacterManageBody } from '../../components/organisms/CharacterManage/CharacterManageBody'
import { EntryScroll } from '../../components/templates/EntryScroll/EntryScroll'
import { useCharacterManage } from '../../hooks/useCharacterManage'

/** 대기의 두 단. `saving` 은 CTA 스피너, `seeding` 은 화면 전체 스피너. */
type SetupPhase = 'idle' | 'saving' | 'seeding'

export function CharacterSetupScreen(): React.JSX.Element {
  const completeCharacterSetup = useAppEntryStore((state) => state.completeCharacterSetup)
  const manage = useCharacterManage()
  // 끌어서 순서를 바꾸는 동안 굴릴 스크롤 뷰. 셸이 그것을 소유한다.
  const scrollableRef = useAnimatedRef<ScrollView>()
  const [phase, setPhase] = useState<SetupPhase>('idle')

  // 429 만 넘긴다. 두 조회가 각각 맞을 수 있어 두 번 부르지만 두 겹은 아니다. 훅은 값 하나를
  // 지켜보고 멱등은 스토어 가드가 진다.
  useApiKeyNotice(manage.rosterError?.kind === 'rateLimited' ? manage.rosterError : null)
  useApiKeyNotice(manage.accountsError?.kind === 'rateLimited' ? manage.accountsError : null)

  async function handleSubmit(): Promise<void> {
    const representativeOcid = manage.representativeOcid
    setPhase('saving')
    try {
      await completeCharacterSetup(manage.selectedOcids, () => setPhase('seeding'))
      // 실패는 삼킨다: 여기 도달했다는 것은 목록이 이미 저장돼 **설정이 끝났다**는 뜻이고, 대표는
      // 표식뿐이라 없어도 화면이 성립한다. 되던지면 호출부가 `void` 라 미처리 rejection 이 되고,
      // 사용자에게 돌아가는 것은 그래도 없다.
      await (representativeOcid === null
        ? clearRepresentativeCharacter()
        : setRepresentativeCharacter(representativeOcid)
      ).catch(() => {})
    } finally {
      setPhase('idle')
    }
  }

  // 시드가 끝날 때까지 화면 전체가 대기다(진행률 숫자 없음. 템플릿 기본값으로 먼저 그리지 않고
  // 최종 값이 확정될 때까지 로딩만 유지). 화면 전체 대기라 셸 승계 카드를 씌우지 않고, 24px 이상
  // 자리이므로 스피너는 스윕이다.
  if (phase === 'seeding') {
    return (
      <View testID="screen-CharacterSetup" className="flex-1">
        <EntryScroll center>
          <View className="items-center gap-3" role="status" aria-busy>
            <MapleSweepSpinner size={32} className="text-primary" />
            <Text className="text-sm text-text-muted">체크리스트를 준비하고 있어요</Text>
          </View>
        </EntryScroll>
      </View>
    )
  }

  // 최소 1개. 이 제약은 이 화면 전용이고 설정 화면에는 **변경 없음** 게이트가 따로 있다
  // (`isDirty`). 그래서 두 화면의 CTA 가 갈린다.
  const isSubmitDisabled = manage.selectedOcids.length === 0 || phase === 'saving'

  return (
    <View testID="screen-CharacterSetup" className="flex-1">
      <EntryScroll
        scrollRef={scrollableRef}
        tracksScrollOffset
        footer={
          <Button
            variant="primary"
            disabled={isSubmitDisabled}
            busy={phase === 'saving'}
            onPress={() => void handleSubmit()}
            // CSS 의사 클래스가 없어 `disabled` 프롭과 이어지지
            // 않는다. 그대로 두면 비활성 버튼이 멀쩡한 색으로 보인다(설정 화면과 같은 처방).
            className={`w-full flex-row items-center justify-center${isSubmitDisabled ? ' opacity-50' : ''}`}
          >
            계속하기
          </Button>
        }
      >
        <View className="w-full gap-4">
          <View className="gap-1">
            <Text className="text-lg font-semibold text-text">관리할 캐릭터를 선택해주세요</Text>
            {/* 캐릭터를 세는 단위는 **개** 다(**명** 은 사람을 센다). */}
            <Text className="text-sm text-text-muted">
              선택한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 개는 선택해주세요.
            </Text>
          </View>

          {/* 401 을 넘기지 않으므로 화면이 안 옮겨간다. 문구도 그 사실에 맞아야 하고, 그래서 이
              자리에서만 401 에 `다시 시도`가 남는다(`formatRosterError` 의 `'characterSetup'`). */}
          <CharacterManageBody
            manage={manage}
            scrollableRef={scrollableRef}
            place="characterSetup"
          />
        </View>
      </EntryScroll>
    </View>
  )
}
