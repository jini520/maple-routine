# 캐릭터

앱이 다루는 캐릭터를 정하고 보여 주는 기능이다. 네 부분으로 나뉜다.

| 부분 | 하는 일 | 결정 |
|---|---|---|
| 추적 캐릭터 | 앱 전체가 함께 쓰는 추적 목록. 후보 자격 판정 · 조회 불가 표시 · 월드 이전 처리 | [[ADR-028]] |
| 캐릭터 관리 | 추적 목록 · 순서 · 대표를 고치는 화면과 today 헤더 버튼 | [[ADR-029]] |
| 캐릭터 선택 | 스케줄러 네 화면이 함께 쓰는 고른 캐릭터와 초상화 레일 | [[ADR-030]] |
| 초상화 | 얼굴 원 · 진행 링 · 곡선 글자로 만든 캐릭터 초상화 부품 | [[ADR-031]] |

처음 켰을 때의 캐릭터 설정 화면은 [[ADR-026]], 캐릭터를 고르는 계정의 인증 수단은 [[ADR-024]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `storage/character-selection.ts` | 추적 목록(`trackedCharacters`) · 마지막 선택(`lastSelectedCharacter`) · 대표 저장, 옛 키 이관 |
| `storage/schedule-probe-ledger.ts` | (ocid, 날짜) 조회 원장(`scheduleProbe:{ocid}`)과 조회 불가 표식 |
| `storage/character-profiles.ts` | 지워지지 않는 이름 · 얼굴 표(`character_profiles`) |
| `features/schedule-sync/character-roster.ts` | 후보 목록을 단계마다 나눠 내보낸다(`getCharacterPickerRoster`) |
| `features/schedule-sync/character-eligibility.ts` | 후보 자격 판정(`resolveCharacterEligibility`) |
| `features/schedule-sync/stranded-characters.ts` | `character/list` 에 없는 추적 ocid 를 따로 조회한다 |
| `features/character-profile/resolve.ts` | 표시할 이름 · 얼굴을 찾는다(`resolveDisplayProfiles`) |
| `features/character-manage/world-leap.ts` · `world-leap-store.ts` · `app/WorldLeapNoticeModal.tsx` | 월드 이전 판정과 확인 모달 |
| `app/settings/SettingsCharactersScreen.tsx` | 캐릭터 관리 화면 |
| `components/organisms/CharacterManage/` | 캐릭터 관리 본문. 고른 목록과 후보를 한 격자에 그린다 |
| `components/organisms/CharacterRow/` | 캐릭터 관리의 카드 한 장 |
| `components/organisms/AccountSelect/` | 메이플 ID 드롭다운 |
| `hooks/useCharacterManage.ts` · `useAccountRosters.ts` · `useKnownProfiles.ts` · `useSelectionDraft.ts` | 캐릭터 관리 화면 로직 |
| `features/character-manage/derivations.ts` · `grid-split.ts` | 계정 요약 · 위 목록 뷰 · 격자 순서에서 고른 목록 자르기 |
| `app/today/CharacterManageButton.tsx` | today 헤더의 초상화 버튼 |
| `app/settings/reload-tab-stores.ts` | 저장 뒤 보스 · 보스 수익 탭 스토어를 다시 읽힌다 |
| `features/character-selection/store.ts` | 고른 캐릭터와 대표 표식을 갖는 스토어 |
| `features/character-selection/selected-character.ts` | 고른 캐릭터가 목록에 없을 때 대신 보여 줄 캐릭터 |
| `lib/scheduler/tracked-order.ts` | 추적 목록 저장 순서로 정렬(`orderByTracked`) |
| `app/content-scheduler/content-completion.ts` | 진행 링이 세는 완료 판정 |
| `components/organisms/CharacterRail/` | 초상화 레일 |
| `components/organisms/CharacterPortrait/` | 초상화 · 링 · 곡선 글자 · 치수 표(`portrait-metrics.ts`) |
| `components/molecules/CharacterAvatar/` | 얼굴 원과 그림이 없을 때의 실루엣 |
| `lib/face-crop.ts` | 얼굴을 자르는 좌표 |

## 추적 캐릭터

| 항목 | 동작 |
|---|---|
| 목록 | 앱 전체에 하나. 저장된 순서가 화면 순서다. 최소 1개 |
| 동기화 | 넥슨 스케줄러 API 는 추적 캐릭터만 부른다 |
| 후보 자격 | `access_flag` 가 `true` 이거나 최근 14일 안에 캐릭터 단위 항목을 하나라도 완료한 캐릭터. 추적 중이면 자격이 없어도 남긴다 |
| 후보 표시 | 기기 캐시 → `character/list` → 캐릭터마다 자격 확인 순서로, 확인된 캐릭터만 차례로 보여 준다 |
| 기록 | 추적에서 빼도 보스 수익 · 가계부 기록은 남는다. 이름과 얼굴은 `character_profiles` 에서 읽는다 |
| 조회 불가 | 지우지 않는다. `조회 불가` 배지와 얼굴의 `!` 표식을 달고, 스케줄러에서 고르면 `캐릭터 관리로 이동하기` 안내를 보여 준다 |
| 월드 이전 | 챌린저스 월드 캐릭터가 조회 불가가 되면 옮겨 간 캐릭터를 찾아 모달로 묻는다. `변경` · `목록에서 빼기` · `캐릭터 관리로 이동` · `나중에` |

## 캐릭터 관리

여는 곳은 설정 탭 톱니바퀴 → 앱 설정의 `캐릭터 관리` 행과 today 헤더의 초상화 버튼이다. 스케줄러와 보스
수익의 빈 상태 버튼, 조회 불가 안내도 설정 탭을 거쳐 이 화면을 연다.

| 영역 | 보이는 것 | 누르면 |
|---|---|---|
| `선택된 캐릭터 N개` | 모든 메이플 ID 의 추적 캐릭터. 저장 순서. 왼쪽 끌기 핸들 · 오른쪽 대표 별과 `✕` | 핸들: 순서 변경 · 별: 대표 지정 · `✕`: 후보로 되돌림 |
| 메이플 ID 드롭다운 | 계정의 대표 캐릭터와 월드별 캐릭터 수 | 다른 계정의 후보를 연다 |
| `캐릭터 추가` | 고른 메이플 ID 의 후보. 레벨 내림차순 | 카드: 위 목록 끝으로 옮긴다 |
| 하단 `저장` | 목록 · 순서 · 대표가 바뀌었고 1개 이상일 때만 켜진다 | 저장하고 화면을 나간다 |

today 헤더의 버튼은 지름 48 원 안에서 대표부터 앞의 세 캐릭터 얼굴을 차례로 바꿔 보여 준다. 움직임 줄이기가
켜져 있으면 첫 얼굴에서 멈추고, 얼굴이 없으면 사람 아이콘을 그린다.

## 캐릭터 선택

컨텐츠 스케줄러 · 컨텐츠 관리 · 보스 스케줄러 · 보스 관리 네 화면이 위쪽의 초상화 레일에서 캐릭터를 고른다.
고른 캐릭터는 네 화면이 함께 쓰고 `lastSelectedCharacter` 에 저장된다.

| 항목 | 동작 |
|---|---|
| 레일 | 추적 캐릭터를 저장 순서로 가로로 늘어놓는다. 스크롤바는 없다 |
| 고른 캐릭터 | 나머지 초상화를 불투명도 0.3 으로 흐리게 한다. 다른 캐릭터를 누를 때만 햅틱을 낸다 |
| 진행 링 | 컨텐츠 스케줄러는 왼쪽 일간 · 오른쪽 주간, 보스 스케줄러는 주간 하나. 관리 화면에는 없다 |
| 고른 캐릭터가 목록에 없을 때 | 첫 번째 캐릭터를 보여 준다 |

## 초상화

| 규격 | 쓰는 곳 | 특징 |
|---|---|---|
| `rail` (68×70) | 스케줄러 레일 | 진행 링(12시에서 시작) · 얼굴 아래 호에 레벨과 이름. 누르면 캐릭터를 고른다. 얼굴 뒤 바탕색 없음 |
| `compact` (40×40) | 보스 수익 캐릭터 아코디언 | 글자가 없고, 처치 한도만큼 나뉜 칸 링을 `ProgressRing` 으로 그린다 |

치수는 `portrait-metrics.ts` 표 한 곳에 있다. 링이 없는 칸에는 두께 2 의 빈 링을 둔다. 그림이 없을 때 무엇을
그릴지는 초상화를 쓰는 쪽이 정해 넘긴다.
