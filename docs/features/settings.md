# 더보기 · 설정

하단 바의 넷째 탭 `더보기` 와, 그 머리의 톱니바퀴가 여는 `설정` 이다. 더보기는 소식과 안내를 읽는 화면이고, 값을 바꾸는
행은 모두 설정에 있다. 이렇게 나눈 이유는 [[ADR-052]], 데이터 삭제는 [[ADR-053]] 에 있다.

캐릭터 관리는 `features/character.md`([[ADR-029]]), 소식 목록과 상세는 [[ADR-057]], 알림 설정 화면은 [[ADR-056]],
MVP 등급 페이지는 `features/mvp-grade.md`([[ADR-050]]), 테마 고르기는 `features/theme.md`([[ADR-054]]) 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app/settings/SettingsScreen.tsx` | 더보기. 소식 분류 다섯과 `가이드 및 문의` 카드 |
| `app/settings/AppSettingsScreen.tsx` | 설정. 제목 붙은 카드 다섯과 고지 네 줄 |
| `app/settings/SectionTitle.tsx` | 카드 제목 줄. 두 화면이 함께 쓴다 |
| `app/settings/NoticeSkeleton.tsx` | 소식을 받기 전의 스켈레톤 |
| `app/settings/SettingsRow.tsx` · `SettingsLinkRow.tsx` · `row-class.ts` · `ValueBadge.tsx` | 누르는 행 둘과 공통 골격 · 현재값 배지 |
| `app/settings/CacheClearConfirm.tsx` · `DisconnectConfirm.tsx` · `SignOutConfirm.tsx` | 위험 동작 확인 창 |
| `app/settings/SettingsAboutScreen.tsx` · `AppUpdateSection.tsx` | 앱 정보 및 계정. 버전 · 상태 · 업데이트 확인 · 개인정보 처리방침 주소(`PRIVACY_URL`) · 넥슨 로그아웃 · 데이터 삭제 · 연결 해제 |
| `app/settings/SettingsReleaseNotesScreen.tsx` | 개발 노트 |
| `app/settings/SettingsFeatureGuideListScreen.tsx` · `SettingsFeatureGuideScreen.tsx` | 기능 설명 목록과 안내 상세 |
| `app/settings/contact-mail.ts` · `store-review-link.ts` | 문의 메일 주소 · 스토어 리뷰 주소 |
| `features/app-review/request.ts` · `storage/app-review.ts` · `native/store-review.ts` | 저장 뒤 앱 안 리뷰 요청. 요청 조건 판단 · 기록 칸 · OS 팝업 호출 |
| `app/settings/SettingsThemeScreen.tsx` · `ThemeSelector.tsx` | 테마 페이지([[ADR-054]] 결정 10) |
| `app/settings/SettingsTextSizeScreen.tsx` · `TextSizeSlider.tsx` | 글자 크기 페이지. 미리보기 칸과 네 칸 슬라이더([[ADR-063]] 결정 11) |
| `app/settings/SettingsActionBar.tsx` | 하위 페이지 아래에 고정하는 버튼 바. 캐릭터 관리의 `저장` · 테마와 글자 크기의 `적용` |
| `app/settings/TrackingModeModal.tsx` · `TrackingModeSelector.tsx` | 스케줄 관리 방법 고르기 |
| `app/settings/reload-tab-stores.ts` | 스케줄 관리 방법을 바꾼 뒤 컨텐츠 · 보스 · 수익 스토어를 차례로 다시 읽게 한다 |
| `features/settings/store.ts` | 연결 해제 |
| `features/settings/cache-data.ts` · `storage/cache-data.ts` | 데이터 삭제 그룹 · 건수 · 삭제 · 다시 띄우기 |
| `src/data/release-notes.ts` · `types/release-notes.ts` | 버전별 변경 목록과 업데이트 모달의 핵심 줄 |
| `src/data/feature-guides/` · `types/feature-guides.ts` · `src/assets/guide/` | 기능 안내. 안내 하나가 파일 하나 |

## 더보기

| 순서 | 내용 | 누르면 |
|---|---|---|
| 1 | 넥슨 로그인 버튼(로그인이 없을 때만, [[ADR-025]]) | 넥슨 로그인 |
| 2 | 소식 분류 다섯: `NOTICE` · `진행 중인 이벤트` · `캐시샵 업데이트` · `공지 사항` · `업데이트` | 분류 제목의 `전체`: 그 분류 목록 · 글: 상세 |
| 3 | `가이드 및 문의` 카드: 기능 설명 · 개발 노트 · 문의하기 · 개발자 응원하기(앱 리뷰) | 하위 화면 · 메일 앱 · 스토어 |

- 머리 오른쪽 톱니바퀴가 설정을 연다.
- 당겨서 새로고침하면 다섯 분류를 다시 받는다. 모두 실패했을 때만 `소식을 불러오지 못했습니다` 가 뜬다.
- 받기 전의 분류는 스켈레톤으로, 받아 봤는데 없는 분류는 빈 문구 카드로 보인다.

## 앱 리뷰 요청

리뷰는 두 곳에서 받는다. 더보기의 `개발자 응원하기(앱 리뷰)` 는 스토어로 보내고, 핵심 작업을 저장한 뒤에는 OS 의 리뷰
팝업을 부른다([[ADR-052]] 결정 10). 앱 안 요청은 1.0.13 스토어 바이너리부터 있다.

| 조건 | 값 | 이유 |
|---|---|---|
| 세는 저장 | 드롭 기록 · 가계부 기록 · 보스 직접 완료 | 앱을 써 본 사람에게 묻는다. 지우기 · 취소 · 드롭을 전부 뺀 저장은 세지 않는다 |
| 저장 횟수 | 4번 이상 | Apple 예제의 값 |
| 첫 실행 뒤 | 3일 | 써 본 뒤에 평가하게 한다. 이 바이너리를 처음 실행한 날부터 센다 |
| 마지막 요청 뒤 | 90일 | iOS 는 1년에 세 번까지 띄우고, Play 는 한 달 안에 다시 부르면 안 뜰 수 있다 |
| 저장 뒤 대기 | 2초 | 시트가 닫히는 화면을 막지 않는다. 고가 드롭 연출이 재생 중이면 닫힌 뒤 2초 |

팝업이 떴는지 · 리뷰를 썼는지는 앱이 모른다. 그래서 요청한 날을 마지막 요청일로 적고 화면은 바꾸지 않는다.

## 설정

| 카드 제목 | 행 | 오른쪽 | 누르면 |
|---|---|---|---|
| `알림` | 알림 설정 | › | 알림 설정 화면 |
| `캐릭터 · 테마 · 글자 크기` | 캐릭터 관리 | `3개` 배지 › | 캐릭터 관리 화면 |
| | 보스 관리 | › | 보스 관리 화면 |
| | 테마 | 테마 이름 배지 › | 테마 페이지 |
| | 글자 크기 | `작게` · `기본` · `크게` · `아주 크게` 배지 › | 글자 크기 페이지 |
| `MVP 등급` | MVP 등급 | › | MVP 등급 목록 |
| `스케줄` | 스케줄 관리 방법 | `자동` · `수동` 배지 › | 스케줄 관리 방법 모달 |
| `앱 데이터` | 앱 정보 및 계정 | 앱 버전 › | 앱 정보 및 계정 |

맨 아래에 버전 · `© {연도} 메이플 루틴` · `Data based on NEXON Open API` · `Maple Routine is not associated with NEXON Korea`
네 줄이 있다.

## 하위 화면

| 라우트 | 화면 | 내용 |
|---|---|---|
| `SettingsFeatureGuideList` | 기능 설명 | 그룹 탭(`컨텐츠 · 보스 · 수익 · 유틸리티 · 설정`, 안내 없는 그룹은 감춘다)과 안내 목록 |
| `SettingsFeatureGuide` · `SettingsReleaseNoteGuide` | 기능 안내 | 목차(마디가 둘 이상일 때) · 이미지 · 문단. 두 라우트가 같은 화면이다 |
| `SettingsReleaseNotes` | 개발 노트 | 버전마다 기능 → 개선 → 버그 묶음. `사용 중` · `스토어 업데이트 필요` 배지. 안내가 있는 항목만 눌린다 |
| `SettingsAbout` | 앱 정보 및 계정 | `앱 정보` 묶음에 현재 버전 · 상태 · `업데이트 확인` · 개인정보 처리방침(`mapleroutine.store/privacy` 를 인앱 브라우저로 연다). `계정` 묶음에 넥슨 로그아웃(로그인이 있을 때) · 데이터 삭제 · 연결 해제. 계정 행은 확인 창을 거친다 |

개발 노트에는 업데이트를 적용하고 다시 시작했을 때 뜨는 `업데이트를 마쳤어요` 안내의 `자세히 보기` 로도 들어갈 수 있다.

## 행의 오른쪽 표시

| 종류 | 오른쪽 | 뜻 |
|---|---|---|
| 설정 행 | 현재값 배지 + chevron | 누르면 고르는 창이 열린다 |
| 이동 행 | 대표값(있으면) + chevron | 누르면 화면이 열린다 |
| 표시 행 | 값 평문 | 누를 수 없다 |
| 외부 링크 행 | 외부 링크 아이콘 | 앱을 떠난다 |
| 실행 행 | 위험 색 라벨, chevron 없음 | 누르면 확인 뒤 지운다 |

## 카드 안의 행

카드는 테두리 없는 `Card` 이고, 그 안의 행은 하나씩 `card-inset` 칸에 담긴다. 칸 사이는 간격 4 이고 선은 긋지 않는다. 칸 색이 행 사이
경계이기 때문이다([[ADR-052]] 결정 15).

- 더보기 · 설정 · 앱 정보 및 계정 · 알림 설정 · MVP 등급 · MVP 등급 이력 · 개발 노트, 그리고 더보기와 소식 목록의 글 줄이 이 모양이다.
- ID 표시(MVP 등급)와 버전 줄(개발 노트)은 칸 없이 카드 머리에 선다.
- 기능 설명 목록은 아직 행 사이에 선을 긋는다.

## 릴리스 노트를 쓰는 방법

`src/data/release-notes.ts` 맨 앞에 버전 하나를 더한다.

| 칸 | 내용 |
|---|---|
| `version` · `date` | OTA 번들 버전(`x.y.z`)과 날짜 |
| `items` | 항목마다 `category`(`feature` · `improvement` · `fix`)와 `text`. 네이티브 변경이면 `requiresStoreUpdate`, 사용법 안내가 있으면 `guideId`(와 `guideSectionId`) |
| `highlights` | 업데이트 모달이 보여 줄 핵심 몇 줄. `items` 와 따로 쓴다. 비면 OTA 발행이 멈춘다 |

이 파일에는 이미지 import 를 넣지 않는다. 발행 스크립트가 이 파일을 Node 에서 직접 읽기 때문이다.
