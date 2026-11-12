# today

앱을 켜면 처음 보이는 화면이다. 4열 격자 위에 위젯 열 개를 놓아, 지금 할 일과 이번 주 결과를 요약해
보여 준다. 왜 이렇게 만들었는지는 [[ADR-058]] 에, 빠른 이동 위젯은 [[ADR-089]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app/today/TodayScreen.tsx` | 화면. 쿼리 캐시와 스토어를 읽어 뷰모델을 만들고, 조회를 건다 |
| `app/today/view-model.ts` | `buildTodayViewModel`. 위젯이 읽는 값을 한 번에 만드는 순수 함수 |
| `app/today/WidgetGrid.tsx` | 격자. 배치를 줄로 묶어 줄마다 `flex-row` 로 그리고, 같은 줄의 타일을 가장 높은 것에 맞춘다 |
| `app/today/widgets/registry.ts` | 위젯마다 그리는 폭 · 누르면 갈 곳 · 숨김 조건 |
| `app/today/widgets/layout.ts` | 기본 배치 좌표(`TILE_LAYOUT`)와 결정석 위젯을 넓힌 배치(`WIDE_CRYSTAL_LAYOUT`) |
| `app/today/widgets/crystal-cells.ts` | 넓힌 결정석 위젯의 칸 폭 고르기 · 차례 · 줄 나누기 |
| `components/organisms/WidgetSelect/` | 위젯 제목 줄의 메이플 ID 드롭다운 버튼 |
| `features/maple-id/owners.ts` · `hooks/useMapleIdOwners.ts` | 캐릭터마다의 메이플 ID 와 메이플 ID 의 차례(넥슨 계정 차례) |
| `features/today/shared-maple-id.ts` · `storage/today-shared-maple-id.ts` | 공유 컨텐츠 위젯에서 마지막에 고른 메이플 ID(Preferences `todaySharedMapleId`) |
| `app/today/widgets/types.ts` | 위젯 id 와 프롭 형식 |
| `app/today/widgets/*Widget.tsx` | 위젯 열 개 |
| `app/today/quick-links.ts` | 빠른 이동 칸마다 가는 화면 · 아이콘과, 칸을 칠하는 색 |
| `app/today/QuickLinksSheet.tsx` | 빠른 이동 편집 시트 |
| `features/quick-links/config.ts` · `store.ts` | 빠른 이동의 화면 목록 · 기본 구성 · 구성을 바꾸는 함수와 스토어 |
| `storage/quick-links.ts` | 빠른 이동 구성(Preferences `quickLinks`) |
| `app/today/TodayLoadingModal.tsx` | 처음 불러오는 동안 띄우는 모달 |
| `lib/today/widget-grid-metrics.ts` | 창 폭에서 열 폭 · 간격을 계산한다 |
| `lib/today/widget-layout.ts` | 배치 검증(`validateWidgetLayout`) · 줄 묶기(`groupWidgetRows`) · 숨김(`omitHiddenTiles`) |
| `features/stats/aggregate.ts` | 이번 주 수익의 집계(통계와 같은 함수) |
| `features/cashbook/ledger-query.ts` | 이번 주 가계부 줄 쿼리 `ledgerDays(from, to)`. 가계부 · 통계와 같은 열쇠다 |
| `features/boss-profit/period-query.ts` · `round-view.ts` | 이번 주 보스 수익 쿼리 `bossProfitPeriod('weekly', 이번 주)` · 회차의 실패 표식 |
| `features/boss-profit/drop-history-query.ts` | 드롭 기록 쿼리 `dropHistory()`. 최고가 · 미입력 위젯이 읽는다 |
| `features/refresh/pull.ts` · `freshness.ts` | 당김 하나(`pullRefresh`) · 갱신 시각(`useRealtimeFetchedAt`) |
| `app/SettlementBanner.tsx` | 결산 안내 줄. 가계부 · 통계도 같이 쓴다 |
| `features/settlement/query.ts` | 결산 쿼리 `settlement()`. 줄을 세울지 정하는 `useSettlementBanner`, 회차가 함께 묻는 `refreshSettlement`. 앱 복귀마다 다시 받는다 |
| `features/settlement/store.ts` · `banner-text.ts` | 닫은 결산의 시작 시각 스토어(`useSettlementDismissal`) · 안내 문구 |
| `storage/settlement-banner.ts` | 닫은 결산의 시작 시각(Preferences `dismissedSettlement`) |
| `server/settlement.ts` | `/v1/settlement` 조회 |
| `app/today/NoticeBanner.tsx` | 공지 배너([[ADR-057]]). `features/notice/notice-query.ts` 의 `useNoticeBanner` 가 앱 공지 쿼리에서 하나를 고른다 |
| `app/today/ManualCompletionBanner.tsx` | 직접 완료 안내 줄([[ADR-037]]) |
| `features/manual-completion/query.ts` | 직접 완료를 연 보스 쿼리 `manualCompletion()`. 줄을 세울지 정하는 `useManualCompletionBanner`. 포커스 · 복귀마다 다시 받는다 |
| `features/party-appointments/query.ts` | 파티 약속 쿼리 `partyAppointments()`. 다음 파티 스케줄 위젯이 `usePartyAppointments` 로 읽는다 |
| `app/today/CharacterManageButton.tsx` | 제목 줄 오른쪽의 캐릭터 관리 버튼([[ADR-029]]) |
| `app/today/NexonLinkButton.tsx` | 캐릭터 관리 버튼 왼쪽의 `넥슨 ID 연동하기`. 넥슨 로그인이 없을 때만 보이고, 누르면 연동 시트를 연다([[ADR-025]] 결정 6) |
| `app/today/widgets/figure-motion.ts` · `useFigureStep.ts` · `lib/character-look.ts` | 대표 캐릭터 위젯의 전신 그림이 움직이는 값과 프레임 주소([[ADR-147]]) |
| `features/faq/` | 제목 옆 물음표와 안내 줄이 여는 FAQ 묶음(`useFaqSheet`). 문구는 서버의 게임 데이터 칸 `faqs` 다([[ADR-150]]) |

## 화면 구성

```
PageHeader            today · FAQ 물음표 · 갱신 시각 · [넥슨 ID 연동하기] · 캐릭터 관리 버튼
[결산 안내 줄]         결산 중일 때만
[직접 완료 안내 줄]    서버가 직접 완료를 열었을 때만
[공지 배너]            새 앱 공지가 있을 때만
WidgetGrid            px-4 pt-2
```

세 줄은 격자 래퍼 밖에 전폭으로 놓인다. 보여 줄 내용이 없으면 아무것도 그리지 않는다. 갱신 시각 줄은
[[ADR-061]], 당김 인디케이터는 [[ADR-064]] 에 있다.

## 격자

| 값 | 크기 |
|---|---|
| 열 수 | 4 |
| 열 폭 | `(창폭 − 32 − 12×3) / 4`. 360dp 에서 73 |
| 높이 | 내용이 정한다. 같은 줄의 타일은 가장 높은 것에 맞춘다 |
| 타일 간격 | 12(가로 · 세로) |
| 좌우 여백 | 16. 화면의 래퍼가 준다 |

카드는 테두리 없이 카드 색만 칠하고, 위젯 안에서 묶이는 내용은 `card-inset` 칸에 담는다([[ADR-058]] 결정 28).
위젯을 눌러도 흐려지지 않는다([[ADR-058]] 결정 11).

## 기본 배치

```
0  4칸  대표 캐릭터
1  4칸  빠른 이동
2  2칸  초기화 카운트다운        2칸  주간 결정석 판매 한도
3  4칸  다음 파티 스케줄        보여 줄 회차가 없으면 맨 아래 줄로 간다
4  4칸  계정 및 메이플 ID 공유 컨텐츠
5  4칸  남은 스케줄
6  4칸  이번 주 수익
7  2칸  이번 주 최고가          2칸  가격 미입력
```

메이플 ID 가 둘 이상이면 결정석 위젯을 넓히고 줄 2 를 둘로 가른다([[ADR-101]] 결정 10).

```
2  4칸  초기화 카운트다운
3  4칸  주간 결정석 판매 한도
```

그 아래 위젯은 한 줄씩 내려간다. 결정석 위젯만 넓히면 카운트다운이 그 줄에 혼자 남는다.
넓힌 카운트다운의 내용은 2칸일 때와 같고 폭만 넓다(사용자 확인 2026-11-11). 그 줄에 다른 위젯이 들어오기 전에는 넓은 폭에 더 넣을 것이 없다.

### 넓힌 결정석 위젯

메이플 ID 마다 `card-inset` 칸 하나이고, 칸 맨 위에 메이플 ID 이름을 적는다. 칸 안에는 한도 줄마다 링 하나와 그 오른쪽의 줄 이름 ·
`N개 남음` 을 둔다. 막대는 쓰지 않는다. 칸 폭은 그 메이플 ID 의 한도 줄 수로 정한다([[ADR-101]] 결정 10).

| 한도 줄 수 | 칸 | 폭 |
|---|---|---|
| 1 | 링 하나. 줄 이름 없이 `N개 남음` | 반 |
| 2 이상 | 링을 옆으로 나란히. 링마다 줄 이름(`일반 월드` · `챌린저스`)과 `N개 남음` | 전체 |

- 칸의 차례는 넥슨 계정 차례(넥슨 ID 계정, 그다음 API 키를 등록한 차례)다. 폭 전체 칸이 있으면 그 칸을 앞으로 모으고, 같은 폭끼리는
  기본 차례를 지킨다.
- 반 폭 칸은 그 차례대로 둘씩 한 줄에 놓고 높이를 맞춘다. 짝 없이 남은 칸은 반 폭 그대로다.
- 메이플 ID 를 모르는 캐릭터의 처치는 어느 한도에도 넣지 않는다. 소속은 캐릭터 목록을 받을 때 적고 캐릭터는 그 목록에서 고르므로,
  이런 캐릭터는 소속 기록이 생긴 1.0.10+3 전에 추적하고 그 뒤 어느 목록에도 나오지 않은 캐릭터뿐이다.

위젯을 더할 때는 `types.ts` 의 `WidgetId`, `registry.ts` 의 한 줄, `layout.ts` 의 좌표 한 줄을 고친다.
셋이 어긋나면 `widget-registry.test.ts` 가 잡는다.

## 위젯

| id | 내용 | 폭 | 누르면 | 값의 출처 |
|---|---|---|---|---|
| `representative-character` | 초상화(52) 오른쪽에 월드 엠블럼 · 닉네임 · 길드, 레벨 · 직업, EXP 칸 | 4 | 없음 | 쿼리 캐시 `characterBasic(ocid)` · 캐릭터 선택 스토어 |
| `quick-links` | 사용자가 고른 화면으로 가는 칸. 한 줄 5칸 · 두 줄 10칸, 원 안의 아이콘과 9px 짧은 이름. 제목 줄의 `편집` 이 편집 시트를 연다 | 4 | 칸마다 그 화면 | 빠른 이동 스토어 |
| `reset-countdown` | 일일 · 주간 초기화까지 남은 시간. 일일은 초까지 1초마다 | 2. 결정석 위젯을 넓히면 4 | 없음 | 뷰모델의 `resets` |
| `crystal-limit` | 한도 줄마다 링(반시계) 하나. 한도 줄은 2026-11-19 주부터 메이플 ID 마다 `일반 월드` 와 챌린저스 월드다([[ADR-042]] 결정 3). 메이플 ID 가 하나면 첫 한도 줄의 링과 `N개 남음`, 줄이 둘이면 첫 줄 이름 옆에 `외 N`(`일반 월드 외 1`). 줄이 하나면 줄 이름을 적지 않는다. 줄에 안 들어가면 `외 N` 이 다음 줄로. 메이플 ID 가 둘 이상이면 위 `넓힌 결정석 위젯` | 2 · 4 | 보스 수익 탭 | 쿼리 `bossProfitPeriod('weekly', 이번 주)` · 추적 캐릭터 프로필의 월드 · 캐릭터의 메이플 ID(`character_accounts`) |
| `next-party-schedule` | 진행 중인 파티 회차 하나(`진행 중`). 없으면 시작 전인 가장 가까운 회차 하나. 캐릭터마다 칸에 닉네임과 보스 줄. 회차가 없으면 맨 아래 줄에서 `매주 반복` · `한 번만` 등록 칸 | 4 | 회차 상세, 또는 고른 갈래의 새 스케줄 시트 | 쿼리 `partyAppointments()` |
| `shared-contents` | 고른 메이플 ID 의 추적 캐릭터만 모은 몬스터파크 · 메이플 유니온 · 에픽 던전의 공유 진행. 추적 캐릭터가 있는 메이플 ID 가 둘 이상이면 제목 줄 오른쪽 드롭다운 버튼으로 고르고, 마지막에 고른 것을 기억한다 | 4 | 없음 | 컨텐츠 스케줄러 스토어 · 캐릭터의 메이플 ID · Preferences `todaySharedMapleId` |
| `remaining-schedule` | 캐릭터별 남은 퀘스트 · 보스. 일간 · 주간 · 월간 탭 | 4 | 없음(행마다 펼침) | 컨텐츠 · 보스 스케줄러 스토어. 세는 함수는 `features/remaining-schedule/` 이고 미완료 스케줄 알림과 같다 |
| `weekly-income` | 이번 주 순 수익 · 수익 · 지출(세그먼트), 반원 도넛과 갈래, 캐릭터 상위 셋(메이플 ID 기록은 순위에 서지 않는다). 캐릭터 줄을 누르면 갈래별 금액 팝오버 | 4 | 없음 | 쿼리 `ledgerDays(이번 주)` 와 통계의 집계 함수 |
| `top-valuable-item` | 이번 주 기록한 판매가 중 가장 큰 아이템의 아이콘과 금액 | 2 | 아이템 가격 입력 | 쿼리 `dropHistory()` |
| `unpriced-drops` | 가격을 아직 안 적은 드롭 건수와 `기록하기` 줄 | 2 | 아이템 가격 입력 | 쿼리 `dropHistory()` |

### 빈 상태

| 위젯 | 그리는 것 |
|---|---|
| 대표 캐릭터 | 추적 캐릭터가 없을 때만 그 사실을 한 줄로 알린다 |
| 이번 주 수익 | 읽는 동안은 숫자 없이 빈 반원. 기록이 없으면 `0` 과 `아직 이번 주 기록이 없습니다`, 순위는 없다 |
| 이번 주 최고가 | `가격이 입력된 아이템이 없습니다` |
| 가격 미입력 | `기록하기` 줄과 같은 크기의 칸에 체크와 `전부 기록했습니다`. 위젯 크기가 그대로다 |
| 주간 결정석 판매 한도 | 처치 기록이 없는 추적 캐릭터의 월드는 `0 / 한도` 로 그린다. 월드를 아는 추적 캐릭터가 없을 때만 `집계할 기록이 없습니다` |
| 공유 컨텐츠 | 타일은 남고 빈 체크박스 줄이 보인다 |
| 다음 파티 스케줄 | 맨 아래 줄로 내려가 `매주 반복` · `한 번만` 등록 칸 둘을 그린다 |

남은 스케줄은 캐릭터 단위 실패를 행에 표시한다. 조회할 수 없는 캐릭터는 `조회 불가`, 동기화가 실패한
캐릭터는 `동기화 실패` 배지를 달고 맨 아래로 간다. 대표 캐릭터가 조회 불가면 흰 실루엣 전신이 멈춘 채 서고, EXP 칸 대신
카드 오른쪽 위에 `조회 불가` 알약이 보인다([[ADR-058]] 결정 13).

대표 캐릭터 위젯의 전신 그림은 휘두르기 · 걷기 · 웃기 · 윙크 · 점프를 무작위로 잇고, 동작 사이에 4~7초 대기 동작을 한다. 프레임을 다 받지 못했거나 조회 불가 · 움직임 줄이기 · 화면이나 앱이 보이지 않는 때는 움직이지 않는다([[ADR-147]]).

이번 주 수익은 통계와 같이 처치 날짜가 있는 기록만 세고, 가계부에서 뺀 강화 장비 줄은 세지 않는다([[ADR-160]] 결정 2). 결정석 판매는 보스 수익 기간으로 세므로, 넥슨이 결산하는
동안이나 처치 날짜를 아직 못 받은 주에는 두 위젯의 기준이 다를 수 있다([[ADR-058]] 결정 27).

### 남은 스케줄과 공유 컨텐츠

남은 스케줄은 공유 컨텐츠를 세지 않는다. 공유 컨텐츠는 캐릭터 수와 관계없이 항목마다 한 줄이다.
남은 스케줄의 행을 누르면 그 탭의 항목 이름이 타일 안에서 펼쳐지고, 한 번에 한 행만 열린다.
미완료 스케줄 알림([[ADR-056]] 결정 15)을 누르면 today 가 열리고 세그먼트가 알림의 주기로 선다.

| | 남은 스케줄 | 공유 컨텐츠 |
|---|---|---|
| 기준 | 캐릭터마다 한 줄 | 항목마다 한 줄 |
| 탭 · 열 | 일간 · 주간 · 월간 탭([[ADR-058]] 결정 23) | 두 열([[ADR-058]] 결정 24) |
| 완료 | `CLEAR` 배지. 대상이 없던 캐릭터도 같다 | 체크박스와 취소선. 누를 수 없다 |
| 순서 | 실패는 맨 아래, 그 탭에 남은 개수가 많은 순, 같으면 캐릭터 관리 순서 | `sharedGroupOrder`. 줄 수가 가장 비슷해지는 곳에서 두 열로 나눈다 |
| 수치 | `퀘스트 N개` · `보스 N개`. 합계는 없다 | 진행 횟수 `n/max`. 에픽 던전 제목 줄에 주간 한도 `n/3` |
| 누르면 | 그 행이 펼쳐진다 | 아무 일도 없다 |

## 조회

| 언제 | 무엇을 |
|---|---|
| 마운트 · 포커스 | 스케줄 회차(만료됐을 때만, [[ADR-142]] 결정 5) |
| 앱 복귀 | 스케줄 회차(신선해도 한 번) · 결산 · 열어 둔 직접 완료 · 앱 공지(서버 쿼리라 신선해도 받는다) |
| 포커스 | 열어 둔 직접 완료(`manualCompletion()`) · 앱 공지(`notices('app')`). 둘은 `staleTime` 이 0 이라 포커스마다 받는다 |
| 기록이 바뀔 때 | 이번 주 가계부 줄(`ledgerDays`) · 이번 주 보스 수익(`bossProfitPeriod`) · 드롭 기록(`dropHistory`) · 직접 적은 완료(`manualCompleted`)는 표의 판이 오르면 무효화되어 다시 읽는다([[ADR-142]] 결정 6) |
| 당김 | `pullRefresh`(스케줄 회차 → 13일 창 → 오늘 강화) · 앱 공지(`refreshNoticeKinds(['app'])`). 쓴 기록은 판을 올려 위젯이 스스로 바뀐다. 대표의 EXP · 레벨은 회차가 캐시에 넣는 그 자리에서 바뀐다 |
| 파티 약속을 저장할 때 | 저장(`savePartyAppointments`)이 쿼리 캐시를 덮는다. 기기에만 있는 값이라 다시 읽을 계기는 없다 |
| 다음 KST 자정 | 공용 타이머(`features/query/reset-timer.ts`)가 넥슨 쿼리를 무효화하고 화면을 다시 렌더한다. 주가 바뀌면 이번 주 가계부 줄을 새 주 열쇠로 읽는다 |

캐릭터 설정을 마치고 처음 들어와 캐시가 하나도 없는 동안에는, 동기화가 400ms 넘게 걸리면
`체크리스트를 불러오고 있어요` 모달과 진행률을 띄운다([[ADR-058]] 결정 26).

## 결산 안내 줄

넥슨이 스케줄러 기록을 결산하는 동안 머리글 바로 아래에 띠 한 줄이 보인다. 결산 중인지는 서버가 정하고,
스케줄러 데이터를 갱신할 때 함께 묻는다(`refreshSettlement`). 앱 복귀에도 다시 묻는다(`settlement()` 쿼리,
[[ADR-142]] 결정 5). 새벽 결산 중 배경에 두었다가 돌아오면 다음 회차를 기다리지 않고 줄이 걷힌다.

```
스케줄러 데이터를 결산 중입니다.
일부 데이터가 갱신되지 않을 수 있습니다.
```

| 누르면 | 무엇이 |
|---|---|
| `X` | 이번 결산 동안 줄을 닫는다. 다음 결산에는 다시 보인다 |
| 그 밖 | FAQ 시트 `스케줄러 결산` 이 열린다 |

가계부와 통계에도 같은 줄이 보이고, 둘째 줄만 `오늘 잡은 보스 수익은 결산이 끝난 뒤 반영됩니다.` 로
다르다. 한 화면에서 닫으면 세 화면 모두 그 결산 동안 보이지 않는다. 서버 값을 못 받아도 보이지 않는다.
