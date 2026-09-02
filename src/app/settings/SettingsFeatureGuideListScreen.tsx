// 설정 하위 페이지 `기능 설명`(정정, 2026-08-10). 앱 기능을 **기능 축**으로
// 나열한 카탈로그이고, 사용법 설명의 **원천**이다.
//
// 처음엔 이 화면이 없었다. 안내가 개발 노트 항목에 붙어 버전 축으로만 존재했는데, 그러면
// *"지금 이 앱을 어떻게 쓰나"* 에 답할 자리가 없다. 오래된 기능이 옛 버전 카드 안에 묻힌다.
// 지금은 **여기가 원천이고 개발 노트는 링크만 건다**(같은 설명을 두 벌 두면 반드시 갈라진다).
//
// **탭은 하단 탭바와 같은 축**이다(사용자 지정). 이미 아는 구획이라 안내를 찾을 때 새로 배울
// 것이 없다. `유틸리티` 만 그 축 밖이고 **지금은 비어 있어 탭이 뜨지 않는다.**
//
// 한 안내가 **여러 그룹에 설 수 있다**. `캐릭터 관리`는 컨텐츠·보스가 같은 피커를 쓰므로 양쪽
// 탭에 같은 글로 선다. 사본을 두면 갈라진다.
//
// ── RN 으로 옮기며 갈린 것 셋 ────────────────────────────────────────────────────────
//
// ① **`StackScreen` → 루트 스택 + `ScreenScroll`**(`SettingsAboutScreen` 파일 머리와 같다).
// ② **탭 줄의 `role="tablist"` 가 사라지고 `aria-selected` 만 남는다.** RN 접근성에 `tablist`
//    컨테이너 역할이 없어(`role` 이 받는 값 목록에 없다) 남겨도 조용히 버려진다. 실제로 선택
//    상태를 나르는 것은 각 탭의 `aria-selected` 이고 그것은 그대로 산다.
// ③ **경로가 아니라 파라미터로 민다.** 웹은 경로를 조립하는 작은 모듈을 따로 뒀는데, 목록이 안내
//    카탈로그를 import 하지 않게 하려는 것이 그 요점이었다. RN 은 라우트 이름 + `{ guideId }` 라
//  조립할 경로가 없어 그 요점이 저절로 지켜지고, 그래서 그 모듈은 삭제됐다(결정 7
//    정정). 여기서 `FEATURE_GUIDES` 를 읽는 것은 목록 행(제목·그룹)을 그리기 위해서지 본문 때문이
//    아니다.
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import {
  FEATURE_GUIDES,
  FEATURE_GUIDE_GROUP_LABELS,
  FEATURE_GUIDE_GROUP_ORDER,
} from '../../data/feature-guides'
import type { FeatureGuideGroup } from '../../types'

import { ArrowLeftIcon, BookOpenIcon, Card, ChevronRightIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SETTINGS_ROW_DIVIDER_CLASS } from './row-class'
import { useSettingsNavigation } from './use-settings-navigation'

// 탭 토글은 `design-system.md` `탭 토글`절 그대로다. **새 스타일을 만들지 않는다.**
const ACTIVE_TAB_CLASS = 'rounded-full bg-primary-tint px-3 py-[5px]'
const ACTIVE_TAB_TEXT_CLASS = 'text-sm font-semibold text-primary-ink'
const INACTIVE_TAB_CLASS = 'px-3 py-[5px]'
const INACTIVE_TAB_TEXT_CLASS = 'text-sm font-medium text-text-muted'

export function SettingsFeatureGuideListScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()

  // **비어 있는 그룹은 탭째 감춘다**(개발 노트의 카테고리 묶음·`ThemeSelector` 와 같은 규칙) —
  // 빈 탭을 열면 아무것도 없는 화면을 만난다. 지금은 `유틸리티` 가 그렇다. 순서는 데이터가
  // 아니라 상수가 정한다.
  const groups = FEATURE_GUIDE_GROUP_ORDER.filter((group) =>
    FEATURE_GUIDES.some((guide) => guide.groups.includes(group)),
  )

  // 첫 탭이 기본이다. 그룹이 하나뿐이면 탭 줄 자체를 그리지 않으므로(고를 것이 없다) 이 값은
  // 그대로 그 하나로 남는다.
  const [selected, setSelected] = useState<FeatureGuideGroup | undefined>(() => groups[0])
  const active = selected !== undefined && groups.includes(selected) ? selected : groups[0]
  // 한 안내가 여러 그룹에 설 수 있다. `캐릭터 관리`는 컨텐츠·보스 양쪽 탭에 같은 글로 선다.
  const guides = FEATURE_GUIDES.filter(
    (guide) => active !== undefined && guide.groups.includes(active),
  )

  return (
    <ScreenScroll
      hasTabBar={false}
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
            <Text className="text-lg font-semibold text-text">기능 설명</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석). */}
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsFeatureGuideList">
        {groups.length === 0 ? (
          // 지금은 도달할 수 없는 자리다(안내가 열한 벌 있다). 그래도 데이터가 비어도 화면이
          // 깨지지 않아야 한다. 목록 빈 상태라 컨텍스트 아이콘 + inline 크기.
          <EmptyState icon={BookOpenIcon} title="아직 준비된 기능 설명이 없습니다" />
        ) : (
          <>
            {/* **선택지가 둘 이상일 때만** 탭 줄이 뜻을 갖는다. 하나뿐이면 고를 것이 없다. */}
            {groups.length > 1 && (
              <View className="flex-row items-center gap-4">
                {groups.map((group) => {
                  const isActive = group === active
                  return (
                    <Pressable
                      key={group}
                      role="tab"
                      testID="guide-group-tab"
                      aria-selected={isActive}
                      onPress={() => {
                        setSelected(group)
                      }}
                      className={isActive ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS}
                    >
                      <Text className={isActive ? ACTIVE_TAB_TEXT_CLASS : INACTIVE_TAB_TEXT_CLASS}>
                        {FEATURE_GUIDE_GROUP_LABELS[group]}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            <Card>
              {guides.map((guide, index) => (
                <View
                  key={guide.id}
                  // 웹의 `divide-y` 자리 — NativeWind 에 형제 선택자가 없어 첫 행을 제외한
                  // 나머지가 직접 얹는다(`row-class.ts`).
                  className={index === 0 ? undefined : SETTINGS_ROW_DIVIDER_CLASS}
                >
                  <Pressable
                    role="button"
                    testID="guide-row"
                    onPress={() => {
                      navigation.navigate('SettingsFeatureGuide', { guideId: guide.id })
                    }}
                    className="w-full flex-row items-center gap-2 px-4 py-3"
                  >
                    <Text
                      testID="guide-row-title"
                      className="min-w-0 flex-1 text-sm font-medium text-text"
                    >
                      {guide.title}
                    </Text>
                    <ChevronRightIcon
                      className="h-4 w-4 text-text-muted"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
    </ScreenScroll>
  )
}
