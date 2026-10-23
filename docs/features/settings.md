# 더보기 · 설정

하단 바의 넷째 탭 `더보기` 와, 그 머리의 톱니바퀴가 여는 `설정` 이다. 더보기는 소식과 안내를 읽는 화면이고, 값을 바꾸는
행은 모두 설정에 있다. 이렇게 나눈 이유는 [[ADR-052]], 캐시 데이터 삭제는 [[ADR-053]] 에 있다.

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
| `app/settings/SettingsAccountDataScreen.tsx` | 계정 및 데이터. 넥슨 로그아웃 · 캐시 데이터 삭제 · 연결 해제 |
| `app/settings/CacheClearConfirm.tsx` · `DisconnectConfirm.tsx` · `SignOutConfirm.tsx` | 위험 동작 확인 창 |
| `app/settings/SettingsAboutScreen.tsx` · `AppUpdateSection.tsx` | 앱 정보. 버전 · 상태 · 업데이트 확인 · 개인정보 처리방침 주소(`PRIVACY_URL`) |
| `app/settings/SettingsReleaseNotesScreen.tsx` | 개발 노트 |
| `app/settings/SettingsFeatureGuideListScreen.tsx` · `SettingsFeatureGuideScreen.tsx` | 기능 설명 목록과 안내 상세 |
| `app/settings/contact-mail.ts` · `store-review-link.ts` | 문의 메일 주소 · 스토어 리뷰 주소 |
| `app/settings/ThemeModal.tsx` · `ThemeSelector.tsx` | 테마 고르기 |
| `app/settings/TextSizeModal.tsx` | 글자 크기 고르기. 미리보기 글과 네 단계, 고르면 바로 적용된다 |
| `app/settings/TrackingModeModal.tsx` · `TrackingModeSelector.tsx` | 스케줄 관리 방법 고르기 |
| `app/settings/reload-tab-stores.ts` | 스케줄 관리 방법을 바꾼 뒤 컨텐츠 · 보스 · 수익 스토어를 차례로 다시 읽게 한다 |
| `features/settings/store.ts` | 연결 해제 |
| `features/settings/cache-data.ts` · `storage/cache-data.ts` | 캐시 용량 · 삭제 · 다시 띄우기 |
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

## 설정

| 카드 제목 | 행 | 오른쪽 | 누르면 |
|---|---|---|---|
| `알림` | 알림 설정 | › | 알림 설정 화면 |
| `캐릭터 · 테마 · 글자 크기` | 캐릭터 관리 | `3개` 배지 › | 캐릭터 관리 화면 |
| | 보스 관리 | › | 보스 관리 화면 |
| | 테마 | 테마 이름 배지 › | 테마 모달 |
| | 글자 크기 | `작게` · `기본` · `크게` · `아주 크게` 배지 › | 글자 크기 모달 |
| `MVP 등급` | MVP 등급 | › | MVP 등급 목록 |
| `스케줄` | 스케줄 관리 방법 | `자동` · `수동` 배지 › | 스케줄 관리 방법 모달 |
| `앱 데이터` | 계정 및 데이터 | 캐시 총 용량 › | 계정 및 데이터 |
| | 앱 정보 | 앱 버전 › | 앱 정보 |

맨 아래에 버전 · `© {연도} 메이플 루틴` · `Data based on NEXON Open API` · `Maple Routine is not associated with NEXON Korea`
네 줄이 있다.

## 하위 화면

| 라우트 | 화면 | 내용 |
|---|---|---|
| `SettingsFeatureGuideList` | 기능 설명 | 그룹 탭(`컨텐츠 · 보스 · 수익 · 유틸리티 · 설정`, 안내 없는 그룹은 감춘다)과 안내 목록 |
| `SettingsFeatureGuide` · `SettingsReleaseNoteGuide` | 기능 안내 | 목차(마디가 둘 이상일 때) · 이미지 · 문단. 두 라우트가 같은 화면이다 |
| `SettingsReleaseNotes` | 개발 노트 | 버전마다 기능 → 개선 → 버그 묶음. `사용 중` · `스토어 업데이트 필요` 배지. 안내가 있는 항목만 눌린다 |
| `SettingsAccountData` | 계정 및 데이터 | 넥슨 로그아웃(로그인이 있을 때) · 캐시 데이터 삭제 · 연결 해제. 모두 위험 색이고 확인 창을 거친다 |
| `SettingsAbout` | 앱 정보 | 현재 버전 · 상태 · `업데이트 확인` · 개인정보 처리방침(`mapleroutine.store/privacy` 를 인앱 브라우저로 연다) |

개발 노트에는 업데이트를 적용하고 다시 시작했을 때 뜨는 `업데이트를 마쳤어요` 안내의 `자세히 보기` 로도 들어갈 수 있다.

## 행의 오른쪽 표시

| 종류 | 오른쪽 | 뜻 |
|---|---|---|
| 설정 행 | 현재값 배지 + chevron | 누르면 고르는 창이 열린다 |
| 이동 행 | 대표값(있으면) + chevron | 누르면 화면이 열린다 |
| 표시 행 | 값 평문 | 누를 수 없다 |
| 외부 링크 행 | 외부 링크 아이콘 | 앱을 떠난다 |
| 실행 행 | 위험 색 라벨, chevron 없음 | 누르면 확인 뒤 지운다 |

## 릴리스 노트를 쓰는 방법

`src/data/release-notes.ts` 맨 앞에 버전 하나를 더한다.

| 칸 | 내용 |
|---|---|
| `version` · `date` | OTA 번들 버전(`x.y.z`)과 날짜 |
| `items` | 항목마다 `category`(`feature` · `improvement` · `fix`)와 `text`. 네이티브 변경이면 `requiresStoreUpdate`, 사용법 안내가 있으면 `guideId`(와 `guideSectionId`) |
| `highlights` | 업데이트 모달이 보여 줄 핵심 몇 줄. `items` 와 따로 쓴다. 비면 OTA 발행이 멈춘다 |

이 파일에는 이미지 import 를 넣지 않는다. 발행 스크립트가 이 파일을 Node 에서 직접 읽기 때문이다.
