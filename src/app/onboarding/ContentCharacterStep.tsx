/**
 * 온보딩 마지막 단계. 관리할 캐릭터를 고르는 화면.
 *
 * **본문은 이 파일에 없다.** 설정 하위 페이지(`SettingsCharactersScreen`)와 같은
 * `CharacterManageBody` + `useCharacterManage` 를 쓰고, 여기 있는 것은 제목 블록 · `계속하기` ·
 * 최소 1개 게이트 셋이다.
 *
 * 지키는 것 셋.
 *
 * ① **401 을 키 재입력 진입점에 안 넘긴다.** 여기의 401 은 방금 넣은 키가 나쁘다는 뜻이라 폼 자체의
 *    실패로 남아야 `다시 시도` 가 처방이 된다. 넘기는 것은 429 뿐이다. 그쪽은 하드 잠금이라
 *    되돌릴 UI 가 없다(이슈 #176).
 * ② 대표 캐릭터를 목록과 **함께** 넘긴다. 안 실어 보내면 사용자의 선택이 조용히 사라진다.
 * ③ 이 단계가 단계 셸(`OnboardingStep`)을 직접 두른다. 바의 활성 조건이 `useCharacterManage` 안에
 *    있어 그 훅을 부르는 컴포넌트가 스크롤과 바 둘 다의 조상이어야 한다.
 *
 * @see docs/features/onboarding.md 정책
 */
import { View } from 'react-native'

import { useApiKeyNotice } from '../../features/onboarding/use-api-key-notice'

import { Button, Text } from '../../components/atoms'
import { CharacterManageBody } from '../../components/organisms/CharacterManage/CharacterManageBody'
import { useCharacterManage } from '../../components/organisms/CharacterManage/use-character-manage'
import { useReorderScroll } from '../../components/organisms/CharacterManage/use-reorder-scroll'
import { OnboardingStep } from './OnboardingStep'

export interface ContentCharacterStepProps {
  isSubmitting: boolean
  /** 목록과 대표를 함께 넘긴다. 저장 순서는 받는 쪽이 지킨다(파일 머리). */
  onSubmit: (ocids: string[], representativeOcid: string | null) => void
}

export function ContentCharacterStep(props: ContentCharacterStepProps): React.JSX.Element {
  const manage = useCharacterManage()
  const { scrollRef, onScroll, scroll } = useReorderScroll()

  // 파일 머리. **429 만** 넘긴다. 두 조회가 각각 맞을 수 있어 두 번 부르지만 두 겹은 아니다
  // (훅은 값 하나를 지켜보고, 멱등은 스토어 가드가 진다).
  useApiKeyNotice(manage.rosterError?.kind === 'rateLimited' ? manage.rosterError : null)
  useApiKeyNotice(manage.accountsError?.kind === 'rateLimited' ? manage.accountsError : null)

  // : 최소 1개. 이 제약은 온보딩 전용이고 설정 화면에는 **변경 없음** 게이트가
  // 따로 있다(`isDirty`). 그래서 두 화면의 CTA 가 갈린다.
  const isSubmitDisabled = manage.selectedOcids.length === 0 || props.isSubmitting

  return (
    <OnboardingStep
      scrollRef={scrollRef}
      onScroll={onScroll}
      footer={
        <Button
          variant="primary"
          disabled={isSubmitDisabled}
          busy={props.isSubmitting}
          onPress={() => props.onSubmit(manage.selectedOcids, manage.representativeOcid)}
          // 웹의 `disabled:opacity-50` 은 CSS 의사 클래스라 RN 의 `disabled` 프롭과 이어지지
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
            자리에서만 401 에 `다시 시도`가 남는다(`formatRosterError` 의 `'onboarding'`). */}
        <CharacterManageBody manage={manage} scroll={scroll} place="onboarding" />
      </View>
    </OnboardingStep>
  )
}
