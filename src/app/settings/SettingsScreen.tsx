/**
 * 더보기 탭. **읽는 것만 남은 화면이다.**
 *
 * 이름이 `설정` 이 아닌 이유. 이 탭이 드는 것이 성질로 셋이었다 - 매일 바뀌는 소식 · 평생 한 번
 * 누르는 응원 · 가끔 바꾸는 설정. 셋을 덮는 말은 `여러 가지` 뿐이라 이름이 아무 말도 못 한다.
 * 그래서 **설정을 머리의 톱니바퀴 뒤로 보내고**(`AppSettingsScreen`) 여기에는 읽을 것만 남겼다.
 *
 * 순서는 **얼마나 자주 바뀌는가**로 정한다. 소식이 맨 위이고 응원이 맨 아래다. 자주 바뀌는 것을
 * 아래 두면 사용자가 스크롤을 배워야 한다.
 *
 * **이 화면에는 고정 헤더(`PageHeader`)를 두지 않는다**. 그 ADR 이 단 재판단 조건은 *"행이 늘어
 * 세로가 길어지면"* 인데, 설정을 내보내 **순감**이라 조건에 걸리지 않는다.
 */
import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'


import packageJson from '../../../package.json'
import { Card, GearIcon, Text } from '../../components/atoms'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import type { TabParamList } from '../../navigation/routes'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { tapFeedback } from '../../native/haptics'
import type { NoticeKind } from '../../types/notice'
import { SettingsRow } from './SettingsRow'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'

/**
 * 소식 카드의 행들. 행 하나가 분류 하나를 열고, 그 이름이 곧 목록 화면의 제목이 된다.
 *
 * `공지사항` 이 앱 공지와 게임 공지를 함께 드는 이유는 **사용자에게 둘이 같은 것**이기
 * 때문이다. 누가 썼는지는 우리 사정이고 읽는 쪽에는 `알려 줄 것` 하나다.
 */
const NOTICE_SECTIONS: readonly { label: string; kinds: readonly NoticeKind[] }[] = [
  { label: '공지사항', kinds: ['app', 'game'] },
  { label: '업데이트', kinds: ['update'] },
  { label: '이벤트', kinds: ['event'] },
  { label: '캐시샵', kinds: ['cashshop'] },
]

export function SettingsScreen(): React.JSX.Element {
  // 저장 로직을 새로 갖지 않는다. 통합 키 쓰기·수동 모드 시드·추가분만 동기화·
  // 진행률 보고가 이 액션에 이미 한 벌로 들어 있다. 이름이 **컨텐츠** 인 것은 이전의
  const navigation = useSettingsNavigation()
  const route = useRoute<RouteProp<TabParamList, 'Settings'>>()

  // 보스 수익의 "캐릭터 선택하러 가기"와 두 스케줄러의 빈
  // 상태 CTA 가 캐릭터 관리를 **열어 둔 채로** 이 탭에 보낸다.
  // 목적지가 모달에서 화면으로 바뀌어도 계약은 그대로다.
  //
  // 파라미터는 **마운트 직후 지운다**. 탭 파라미터는 스택에 남아, 안 지우면 탭을 떠났다 돌아올
  // 때마다 그 화면이 다시 밀려 들어온다.
  useEffect(() => {
    if (route.params?.openPicker !== true) return
    navigation.setParams({ openPicker: undefined })
    navigation.navigate('SettingsCharacters')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayedVersion = packageJson.version

  return (
    <ScreenScroll>
        {/* `screen-Settings` 는 나머지 세 탭 화면과 같은 관례다(`screen-Content`·`-Boss`·`-Profit`).
            이것이 없어서 내비게이션 테스트가 **자리표시자의 같은 testID 를 보고 초록**이었고,
            설정 탭이 통째로 빠진 것을 아무도 못 잡았다(실기기 관측). */}
        <View className="gap-4 px-4 pb-4" testID="screen-Settings">
          {/* 이 화면에는 `PageHeader` 가 없지만 제목 줄은 다른 탭과 **같은
              프리미티브**다. 셸이 달라도 제목이 서는 선은 같아야 한다. */}
          {/* 설정은 머리의 아이콘 뒤에 산다. 본문에 두면 매일 보는 소식이 가끔 쓰는 설정에
              밀려 내려간다. 톱니바퀴가 하단 바에서 여기로 옮겨 온 그림이다. */}
          <PageHeaderTitleRow>
            <Text className="text-lg font-semibold text-text">더보기</Text>
            <Pressable
              role="button"
              aria-label="설정"
              onPress={() => {
                tapFeedback()
                navigation.navigate('AppSettings')
              }}
              className="ml-auto p-1"
            >
              {/* 제목 글자(18)보다 크다. 이 화면에서 유일하게 누를 수 있는 머리 요소라 뒤로
                  가기(20)와 같은 크기면 눈에 안 걸린다. */}
              <GearIcon className="h-6 w-6 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
          </PageHeaderTitleRow>

          {/* **소식이 맨 위다.** 이 페이지에서 유일하게 매일 바뀌는 것이고, 나머지는 다 `가끔
              한 번` 이다. 자주 바뀌는 것을 아래 두면 사용자가 스크롤을 배워야 한다. */}
          <Card className="px-6" testID="settings-card">
            {NOTICE_SECTIONS.map((section, index) => (
              <View key={section.label} className={index === 0 ? '' : SETTINGS_ROW_DIVIDER_CLASS}>
                <SettingsRow
                  label={section.label}
                  onPress={() =>
                    navigation.navigate('SettingsNotices', {
                      kinds: [...section.kinds],
                      title: section.label,
                    })
                  }
                />
              </View>
            ))}
          </Card>

          {/* 읽는 것들. 설정과 갈라 둔 이유는 성질이 달라서다 - 이쪽은 한 번 읽고 끝나고
              설정은 값을 바꾼다. */}
          <Card className="px-6" testID="settings-card">
            {/* `기능 설명` 이 `개발 노트` 위다. 이 앱을 어떻게 쓰나 가 무엇이 바뀌었나 보다
                자주 묻는 질문이고 설명의 원천도 이쪽이다. */}
            <SettingsRow
              label="기능 설명"
              onPress={() => navigation.navigate('SettingsFeatureGuideList')}
            />
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow
                label="개발 노트"
                onPress={() => navigation.navigate('SettingsReleaseNotes')}
              />
            </View>
          </Card>

          {/* **응원은 맨 아래다.** 평생 한 번 누르는 것이라 자주 쓰는 것 위에 못 올린다.
              사람들이 후원을 찾을 때 관습적으로 화면 끝부터 본다. */}
          <Card className="px-6" testID="settings-card">
            <SettingsRow label="별점 남기기" onPress={() => undefined} />
            <View className={SETTINGS_ROW_DIVIDER_CLASS}>
              <SettingsRow label="커피 한 잔 사주기" onPress={() => undefined} />
            </View>
          </Card>

          {/* 이용약관 제6조④가 요구하는 출처 표기. 문구를 의역하지 않고 원문 그대로 노출한다.
              이 블록은 전부 읽고 끝나는 정적 문구라 톤(text-text-disabled)이
              균일하다. 눌러야 하는 것 하나가 한 단계 밝은 색·밑줄로 섞여 있던 예외는
              /settings/about 의 행으로 내려가면서 사라졌다.
              (`text-center` 가 상자에서 각 `Text` 로 내려온 것은 RN 이 글자 정렬을 상속하지
              않기 때문이다. `EmptyState` 와 같은 자리.) */}
          <View className="gap-1 pt-4" testID="settings-footer">
            <Text className="text-center text-xs text-text-disabled">v{displayedVersion}</Text>
            <Text className="text-center text-xs text-text-disabled">
              © {new Date().getFullYear()} 메이플 루틴
            </Text>
            <Text className="text-center text-xs text-text-disabled">
              Data based on NEXON Open API
            </Text>
            {/* 비제휴 고지는 약관이 요구하는 것이 아니라 동종 서비스(maple.gg·chuchu.gg·
                maplescouter)의 공통 관행이다. 출처 표기만 있으면 넥슨 공식 서비스로 오인될
                여지가 남는다. 문구도 그 3사와 같은 영문 형태로 맞춘다. */}
            <Text className="text-center text-xs text-text-disabled">
              Maple Routine is not associated with NEXON Korea
            </Text>
          </View>
        </View>
      </ScreenScroll>
  )
}
