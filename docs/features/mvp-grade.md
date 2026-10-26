# MVP 등급

메이플 ID 마다 MVP 등급을 받아 두고, 그 등급으로 경매장 수수료의 처음 값과 스타포스 비용을 계산한다.
등급을 묻는 모달과 주간 확인, 설정에서 이력을 고치는 화면이 여기에 속한다. 왜 이렇게 만들었는지는
[[ADR-050]] 에 있다.

수수료를 실제로 떼는 계산은 각 기능이 맡는다. 아이템 판매 · 조각 · 사냥 · 강화 지출은 가계부, 드롭 판매가는
드롭 기록, 파티 모달의 송금 수수료는 보스 스케줄러에 있다. 온보딩의 MVP 화면 순서는 [[ADR-026]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `lib/mvp/grades.ts` | 등급 일곱의 경매장 수수료 · 스타포스 할인 표(서버 게임 데이터의 `mvpGrades` 칸) · 요율 조회 · 등급이 없을 때의 요율 · 가장 높은 등급 · 혜택 한 줄 |
| `lib/mvp/history.ts` | 그 날의 등급 · 등급 변경 · 기간 추가 · 지우기 · 고치기 · 고를 수 있는 주 · 기간 추가의 설명 줄 |
| `lib/mvp/membership.ts` | 이름이나 ocid 로 메이플 ID 소속 찾기 |
| `lib/mvp/fees.ts` · `lib/mvp/starforce.ts` | 기록의 자동 요율 · 스타포스 줄의 MVP 할인 |
| `lib/enhancement/cost.ts` | 스타포스 시도 비용에 붙이는 MVP 할인(`withMvpDiscount`) |
| `storage/mvp-grades.ts` | `mvp_grade_history` 읽기 · 쓰기 |
| `storage/character-accounts.ts` | `character_accounts` 읽기 · 쓰기. 소속을 어느 넥슨 계정의 목록에서 봤는지도 적는다 |
| `storage/mvp-grade-prefs.ts` | `mvpWeeklyCheckOff` · `mvpLastCheckedWeek` · `mvpBulkApplyAsked` · `mvpOnboardingPending` |
| `features/mvp-grade/character-list.ts` | `character/list` 를 받고 소속을 기록한다. 목록을 받는 곳은 모두 이것을 부른다 |
| `features/mvp-grade/ask.ts` · `flow-store.ts` | 묻는 규칙 · 모달의 답을 저장하는 흐름 |
| `features/mvp-grade/accounts.ts` | 추적 캐릭터의 ID · ID 표시(대표 캐릭터 · 초상) |
| `features/mvp-grade/store.ts` · `fee-context.ts` · `auto-fee.ts` | 화면이 읽는 등급 정보 · 폼마다의 자동 요율 |
| `features/mvp-grade/bulk-apply.ts` · `recalculate-fees.ts` · `tasks.ts` | 일괄 적용과 다시 계산의 대상 목록, 이어서 하는 작업 둘 |
| `features/mvp-grade/after-change.ts` | 등급 이력을 바꾼 뒤 등급 정보를 다시 읽고 다시 계산을 돌린다 |
| `features/mvp-grade/settings-store.ts` | 설정 목록과 ID 이력 페이지가 함께 읽는 상태 |
| `features/mvp-grade/onboarding.ts` · `onboarding-draft.ts` | 온보딩에서 MVP 화면으로 갈지 · 두 화면이 함께 쓰는 고르던 값 |
| `app/mvp-grade/MvpGradeHost.tsx` · `MvpGradeModal.tsx` · `MvpGradeCards.tsx` | `AppShell` 의 모달과 고르기 · 확인 카드 |
| `app/mvp-grade/MvpGradeOnboarding.tsx` | 온보딩의 고르기 · 확인 화면 |
| `app/mvp-grade/MvpGradeSheets.tsx` · `GradeTimelineRow.tsx` | 등급 변경 · 기록 고치기 · 기록 추가 시트와 타임라인 한 줄 |
| `app/settings/SettingsMvpGradeScreen.tsx` · `SettingsMvpGradeHistoryScreen.tsx` | 설정의 목록 페이지 · ID 이력 페이지 |
| `components/molecules/MvpGradeGrid` · `MvpPlate` | 7칸 격자 · 명패 |
| `components/organisms/FeeRow` · `WeekCalendarPopover` | 수수료 줄 · 주 고르기 달력 |
| `lib/assets/asset-lookup.ts` 의 `mvpPlateAsset` | 명패 여섯. 서버 그림 목록의 `mvp/` 에서 찾는다. 일반은 그림이 없다 |

## 등급과 혜택

| 등급 | 경매장 수수료 | 스타포스 할인 |
|---|---|---|
| 일반 | 5% | 없음 |
| 브론즈 | 5% | 없음 |
| 실버 | 3% | 3% |
| 골드 | 3% | 5% |
| 다이아 | 3% | 10% |
| 레드 | 3% | 10% |
| 블랙 | 3% | 10% |

고르지 않은 메이플 ID 는 일반으로 계산한다.

## 저장하는 것

| 저장 | 내용 | 캐시 삭제 |
|---|---|---|
| SQLite `mvp_grade_history` | 메이플 ID 마다 `(시작 주의 목요일, 등급)` 줄. 등급이 빈 줄도 있다 | 남긴다(`기록` 그룹) |
| SQLite `character_accounts` | `(ocid, 이름, 메이플 ID)` 와 처음 본 날 · 마지막으로 본 날 | 남긴다(`기록` 그룹) |
| `mvpWeeklyCheckOff` | `앞으로 등급은 직접 바꿀게요` | 남긴다 |
| `mvpLastCheckedWeek` | 마지막으로 확인한 주 | 지운다 |
| `mvpBulkApplyAsked` | 일괄 적용을 물었는지 | 남긴다 |
| `mvpOnboardingPending` | 온보딩 MVP 화면에 들어갔는지 | 지운다 |

## 기록의 등급을 찾는 순서

1. 기록의 캐릭터가 속한 메이플 ID 를 찾는다. 스타포스 줄은 이름으로, 나머지는 ocid 로 찾는다.
2. 찾았으면 그 ID 의 이력에서 기록 날짜가 든 주 이하의 가장 늦은 줄을 쓴다.
3. 소속을 모르면 그 날짜에 등급이 있는 ID 가운데 가장 높은 등급을 쓴다.
4. 등급이 없으면 스타포스는 할인 없이, 자동 수수료는 일반 요율(5%)로 계산한다.

캐릭터 없이 적힌 옛 아이템 판매는 대표 캐릭터(없으면 추적 목록의 첫 캐릭터)로 찾는다.

## 수수료 줄

| 곳 | 줄 | 처음 값 |
|---|---|---|
| 가계부 아이템 판매 | 판매 수수료 | 자동 |
| 가계부 조각 정산 | 판매 수수료 | 자동 |
| 사냥 폼 둘의 조각 판매 | 판매 수수료. 조각 가격이 없어도 보인다 | 자동 |
| 드롭 판매가 입력 카드 | 판매 수수료 · 분배 수수료. 혼자면 분배 줄이 없다 | 자동 |
| 파티 모달 | 송금 수수료 | 자동 |

- 자동을 켜면 등급 명패와 요율, 끄면 `없음 · 3% · 5%`(파티 모달은 `0% · 3% · 5%`) 세그먼트가 보인다.
- 자동인 기록은 등급 이력이 바뀔 때마다 다시 계산되고, 끝나면 `자동 수수료 기록 N건을 다시 계산했어요` 가 뜬다.
- 가계부 폼에서 캐릭터를 고르기 전에는 `캐릭터를 선택해 주세요` 가 흐리게 보인다.
- 아이템 판매는 캐릭터를 골라야 저장된다.
- 판매 분배금 계산기에는 수수료 자동이 없다.

## 묻는 때와 화면

| 경우 | 화면 |
|---|---|
| 온보딩(캐릭터 설정 뒤) | 온보딩 화면 둘. 고르기 `다음` → 확인 `시작하기` |
| 업데이트 뒤 처음 | today 위 모달. 고르기 → 확인. 지난 기록이 있으면 일괄 적용 체크박스 |
| 새 메이플 ID 를 추적 | 그 ID 만 담은 모달. 고르기 → 확인 |
| 목요일이 지난 뒤 | 주간 확인 모달. 확인 → (수정) → 고르기 → 확인 |

모달을 띄울지는 앱이 열릴 때, 앱으로 돌아올 때, 캐릭터 관리에서 저장한 뒤에 판단한다. 바깥을 누르거나
뒤로가기로는 닫히지 않는다.

## 설정

`설정 > MVP 등급` 을 누르면 목록 페이지가 열린다.

| 페이지 | 보여 주는 것 | 누르면 |
|---|---|---|
| 목록 | ID 마다 지금 등급 한 줄과 `이력 N건 보기`, 맨 아래 `매주 등급 확인` 스위치 | `변경`: 등급 변경 시트 · `이력 N건 보기`: ID 이력 페이지 |
| ID 이력 | 지금 등급 · 혜택 · 시작 날짜, 연도로 나눈 타임라인 | `등급 변경`: 등급 변경 시트 · 줄: 기록 고치기 시트 · `+ 추가`: 기록 추가 시트 |

기록 추가는 지난주까지의 닫힌 기간을 끼워 넣는다. 종료 주 다음 주부터는 그 기간을 감싸던 등급이 다시
이어지고, 첫 기록보다 앞이면 `등급 없음` 이 된다. 자세한 규칙은 [[ADR-050]] 결정 14 에 있다.
