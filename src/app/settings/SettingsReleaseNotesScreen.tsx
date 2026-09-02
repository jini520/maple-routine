// 설정 하위 페이지 「개발 노트」([[ADR-118]] 결정 2 · [[ADR-119]]) — 버전별 변경 목록.
//
// **데이터는 앱 번들 안에 있다**([[ADR-119]] 결정 1) — `src/data/release-notes.ts` 를 그대로 읽으므로
// 네트워크 0회이고 오프라인에서도 과거 전체가 보인다. 그래서 이 화면에는 로딩·에러 상태가 없다.
// 원격 조회는 업데이트 모달의 몫이고 그쪽은 `latest.json` 을 쓴다(원천 하나 + 소비 둘).
//
// **배열을 정렬하지 않는다** — "최신이 먼저"는 데이터 파일의 계약이고 그 강제는 데이터 테스트가
// 한다. 화면이 다시 정렬하면 같은 규칙의 진실이 두 곳에 생긴다.
//
// ── RN 으로 옮기며 갈린 것 넷 ────────────────────────────────────────────────────────
//
// ① **`StackScreen` → 루트 스택 + `ScreenScroll`**(`SettingsAboutScreen` 파일 머리와 같다). 자식
//    라우트가 아니게 되면서 `<Outlet />` 도 사라지지만, 안내 상세를 **이 화면이 민다**는 관계는
//    그대로다.
// ② **`사용 중` 배지의 기준이 빌드 시점 버전으로 좁혀진다.** 웹은 `loadCurrentVersion()` 으로 지금
//    실행 중인 OTA 번들 버전을 물었는데 RN 에서는 그 스토어를 **값으로 import 하는 것만으로 죽는다**
//    ([[ADR-128]] 결정 7 · `AppUpdateSection` 파일 머리). 그래서 웹이 `currentVersion === null` 일
//    때 쓰던 **폴백 경로만 남는다** — 값을 지어내지 않고 이미 있던 분기 하나로 좁힌 것이다.
//    그 결과 지금은 배지가 `package.json` 버전과 같은 카드에 붙는다.
// ③ **글자 정렬·색이 상속되지 않아** `<li>` 의 `text-sm text-text-muted` 가 상자에서 각 `Text` 로
//    내려온다(`EmptyState` 와 같은 자리). 불릿 `·` 은 `aria-hidden` 인 `Text` 그대로다.
// ④ **`space-y-*` → `gap-*`**(NativeWind 에 형제 선택자가 없다). 안내가 있는 항목의 `<button>` 은
//    `Pressable role="button"` 이 된다 — 웹에서 태그가 공짜로 주던 시맨틱을 명시로 되살린다.
import { Pressable, View } from 'react-native'

import packageJson from '../../../package.json'
import {
  RELEASE_NOTES,
  RELEASE_NOTE_CATEGORY_LABELS,
  RELEASE_NOTE_CATEGORY_ORDER,
} from '../../data/release-notes'

import { Badge, Card, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowLeftIcon, ChevronRightIcon, FileTextIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useSettingsNavigation } from './use-settings-navigation'

export function SettingsReleaseNotesScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()

  // 폴백까지 했는데도 일치하는 노트가 없으면 아무 배지도 붙지 않는다 — 1.0.2 이전 사용자는
  // 자기 버전이 목록에 없고([[ADR-119]] 결정 4), 없는 것을 지어내지 않는다.
  const runningVersion = packageJson.version

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
            <Text className="text-lg font-semibold text-text">개발 노트</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석). */}
      <View className="gap-3 px-4 pb-4" testID="screen-SettingsReleaseNotes">
        {RELEASE_NOTES.length === 0 ? (
          // 지금은 도달할 수 없는 자리다 — 그래도 데이터가 비어도 화면이 깨지지 않아야 한다.
          // 목록 빈 상태라 컨텍스트 아이콘 + inline 크기([[ADR-060]]).
          <EmptyState icon={FileTextIcon} title="아직 기록된 변경 내역이 없습니다" />
        ) : (
          RELEASE_NOTES.map((note) => (
            <Card key={note.version} testID="release-note" className="gap-3 p-4">
              <View className="flex-row items-center gap-2">
                <Text
                  testID="release-note-version"
                  style={TABULAR_NUMS}
                  className="text-sm font-semibold text-text"
                >
                  {note.version}
                </Text>
                {note.version === runningVersion && <Badge variant="primary">사용 중</Badge>}
                <Text style={TABULAR_NUMS} className="ml-auto text-xs text-text-disabled">
                  {note.date}
                </Text>
              </View>

              {/* [[ADR-119]] 결정 9: 항목마다 배지를 다는 대신 **카테고리로 묶는다.** 배지는 항목
                  수만큼 반복돼 같은 말이 열 번 나오지만, 묶음 제목은 한 번만 말하고 그 아래
                  전부에 적용된다. 순서는 데이터가 아니라 RELEASE_NOTE_CATEGORY_ORDER 가 정한다 —
                  노트를 쓰는 사람이 항목을 어떤 순서로 적든 화면은 늘 같아야 한다.
                  **비어 있는 묶음은 제목째 감춘다**(ThemeSelector 의 카테고리 섹션과 같은 규칙). */}
              {RELEASE_NOTE_CATEGORY_ORDER.map((category) => {
                const items = note.items.filter((item) => item.category === category)
                if (items.length === 0) return null

                return (
                  <View key={category} testID="release-note-group" className="gap-1">
                    <Text className="text-xs font-semibold text-text-muted">
                      {RELEASE_NOTE_CATEGORY_LABELS[category]}
                    </Text>
                    <View className="gap-2">
                      {items.map((item) => {
                        // 지역 상수로 받는다 — `item.guideId` 를 콜백 안에서 그대로 쓰면 바깥의
                        // `undefined` 검사로 좁혀진 타입이 클로저 경계에서 풀린다.
                        const guideId = item.guideId
                        const body = (
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-sm text-text-muted">{item.text}</Text>
                            {/* [[ADR-119]] 결정 3: 표식은 버전이 아니라 이 항목에 붙는다. 톤은 스토어
                                이동을 말하는 다른 자리(UpdatePromptModal 의 store-required)와 같은
                                third 다. */}
                            {item.requiresStoreUpdate === true && (
                              <View className="flex-row">
                                <Badge variant="third">스토어 업데이트 필요</Badge>
                              </View>
                            )}
                          </View>
                        )

                        return (
                          <View key={item.text} className="flex-row gap-2">
                            <Text aria-hidden className="text-sm text-text-disabled">
                              ·
                            </Text>
                            {/* [[ADR-125]] 결정 5: **안내가 있는 항목만** 눌린다. 없는 것은 결함이
                                아니라 정상이므로 비활성 버튼을 두지 않고, 그 항목의 트리는 종전
                                그대로다 — 래퍼도 클래스도 만들지 않는다. chevron 은 설정 행과 같은
                                약속이다(있으면 누르면 무언가 열린다, [[ADR-118]] 결정 4). */}
                            {guideId === undefined ? (
                              body
                            ) : (
                              <Pressable
                                role="button"
                                onPress={() => {
                                  // 마디까지 가리키면 그 자리로 떨어진다([[ADR-125]] 결정 7) —
                                  // 릴리스에서 바뀐 것은 보통 기능 전체가 아니라 그중 한 마디다.
                                  // 웹의 `?s=` 쿼리가 여기서는 라우트 파라미터다(`routes.ts`).
                                  navigation.navigate('SettingsReleaseNoteGuide', {
                                    guideId,
                                    section: item.guideSectionId,
                                  })
                                }}
                                className="min-w-0 flex-1 flex-row items-start gap-2"
                              >
                                {body}
                                <View testID="release-note-item-chevron" className="mt-0.5">
                                  <ChevronRightIcon
                                    className="h-4 w-4 text-text-muted"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </View>
                              </Pressable>
                            )}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )
              })}
            </Card>
          ))
        )}
      </View>
    </ScreenScroll>
  )
}
