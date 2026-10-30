# 데이터 생명주기

기기에 저장한 데이터를 언제 읽고, 쓰고, 지우는지 정리한다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app/AppShell.tsx` | 부팅 때 설정을 읽어 스토어에 넣는다 |
| `app/prehydrate.ts` · `features/prehydrate.ts` | 부팅 예열. 스케줄 회차와 보스 수익 스토어 |
| `app/QueryCacheProvider.tsx` · `features/query/persist.ts` | 저장된 쿼리 캐시를 올리고 바뀔 때마다 다시 쓴다 |
| `storage/cache-data.ts` | 데이터 삭제 · 그룹마다 지울 건수 계산 |
| `features/settings/cache-data.ts` | 삭제 → DB 닫기 → 리로드 순서 |
| `storage/api-key.ts` 의 `clearAuthConfig` · `features/auth/store.ts` | 연결 해제 |
| `storage/sqlite/db.ts` 의 `closeBossProfitDb` | 리로드 전 DB 닫기 |

## 부팅 때 읽는 것

`AppShell` 이 처음 마운트될 때 각 스토어가 따로 저장소를 읽는다. 하나가 실패해도 나머지는 계속 읽는다.

| 스토어 | 읽는 것 |
|---|---|
| 인증(`useAuthStore.restoreFromStorage`) | `authMethods`(없으면 `apiKey`) |
| 진입 단계(`useAppEntryStore.resolveFromStorage`) | 인증 수단 · 추적 캐릭터 |
| 테마 · 추적 모드 · 드롭 연출 | `theme` · `trackingMode` · `dropEffect` |
| 공지(`useNoticeStore.restore`) | 구독 상태. 읽은 뒤 켜 둔 토픽을 다시 구독한다 |
| 데이터 시각(`useDataFreshness.restore`) | `dataFetchedAt` |

그보다 먼저 `index.ts` 의 `loadGameData()` 가 SQLite 의 게임 데이터 사본을 읽어 표를 세운다. 사본이 없으면 잠금 화면 뒤에서 받고,
위의 복원은 다 받은 뒤에 마운트되는 `ReadyShell` 에서 돈다(테마는 잠금 화면도 그려야 해서 먼저 돈다). 쿼리 캐시는
`QueryCacheProvider` 가 SQLite `query_cache` 에서 올리고, 그 전에는 화면의 쿼리가 기다린다. 다 올리면 옛 Preferences
캐시(`schedulerCache:{ocid}` · `characterBasicCache:{ocid}`)를 쿼리에 없는 캐릭터만 옮기고 회차를 만료로 표시한다
([[ADR-142]] 결정 7). 앱이 준비된 뒤 `prehydrate` 가 그 복원을 기다렸다가 스케줄 회차와 보스 수익 스토어를 차례로
읽는다([[ADR-027]]). 그 밖의 값은 화면이 처음 열릴 때 그 기능의 스토어가 읽는다.

## 삭제: 연결 해제와 데이터 삭제

설정에 지우는 동작이 둘 있다. 둘이 지우는 범위는 겹치지 않는다.

| | 연결 해제 | 데이터 삭제 |
|---|---|---|
| 어디서 | 더보기 → 설정 → 앱 정보 및 계정 | 더보기 → 설정 → 앱 정보 및 계정 → 데이터 삭제 |
| 지우는 것 | Preferences 의 `authMethods` · `apiKey` · `selectedAccountId` 셋. 넥슨 세션이 있으면 서버 세션도 끊는다 | 고른 그룹(아래 표) |
| 기록 | 그대로 둔다 | 고른 그룹의 기록을 지운다. 강화는 다시 받고, 나머지는 되살릴 수 없거나 최근 기간만 다시 받는다([[ADR-053]] 결정 1) |
| 결과 | 로그인 화면으로 돌아간다 | 앱을 리로드한다 |

데이터 삭제는 그룹 넷 중에서 고른다. 처음에는 아무것도 골라져 있지 않다. 지우는 것이 되살릴 수 없거나 다시 받는 데 호출이 몰리는 기록이라서,
확인 창을 열고 바로 누른 한 번에 아무것도 지워지지 않게 하려는 것이다.

| 그룹 | 지우는 것 |
|---|---|
| `manual`(수동 선택 항목) | Preferences 의 `manualTrackedContent:*` · `worldSharedProgress:*` · `accountSharedProgress:*` · `lastHunts` · `lastHuntSelection` · `lastHuntToggles` · `lastPointRate` + 보스 기록 표 셋의 분배 칸(파티 설정 · 그 기간만 고친 값, 행 단위) |
| `boss`(보스 처치 · 드롭) | 보스 기록 표 셋의 처치 · 드롭 행(행 단위) |
| `cashbook`(가계부) | `cashbook_entries` · `cashbook_entry_items` · `cashbook_entry_hunt_inputs` · `remembered_levels` |
| `enhancement`(강화) | `enhancement_totals` · `enhancement_history_checks` · `enhancement_recomputes` |

보스 기록 표 셋(`boss_parties` · `boss_party_periods` · `boss_drops`, `BOSS_TABLE_NAMES`)은 통째로 지우지 않고 행 단위로
지운다. 한 표에 두 그룹의 행이 섞여 있고, 조합 행이 처치와 드롭의 부모라서 표를 통째로 지우면 외래키를 따라
처치 · 드롭까지 사라지기 때문이다. `manual` 은 분배 칸을 비우고, `boss` 는 처치 · 드롭과 그것만 남은 기간 행을 지운다.
어느 쪽이든 분배 칸도 기간도 남지 않은 조합 행은 함께 지운다([[ADR-078]] 결정 10).

그룹 목록에 없는 키와 테이블은 어떤 선택에서도 남긴다. 사용자가 그룹 이름을 보고 고르는 기능이라, 화면에 적지 않은 것을
함께 지우면 사용자가 모르는 것을 잃기 때문이다. 게임 데이터 사본과 받은 그림, 조회 캐시, 캐릭터 이력, 이전 버전 사본 표,
추적 캐릭터, 인증과 사용자 설정이 여기에 든다. 새 Preferences 키와 새 테이블은 그룹 목록에 더해야만 지워진다.

어느 그룹을 골라도 서버 전송 대기 표(`server_sync_queue`)는 비운다. 대기 표는 원본 기록이 없는 줄을 서버에 지우기
요청으로 보낸다. 대기 표를 남기면 방금 지운 기록들의 지우기 요청이 서버로 간다. 서버에 올린 데이터는 지우지 않는다.

테이블은 `DROP` 이 아니라 `DELETE FROM` 으로 비우므로 스키마는 남는다. 표 지우기는 트랜잭션 하나로 묶어, 중간에 실패하면
아무 표도 지워지지 않는다. 끝나면 `VACUUM` 으로 DB 파일을 다시 써서 지운 행이 차지하던 공간을 돌려준다. 확인 창은
용량 대신 그룹마다 지울 기록의 건수를 보인다. 이렇게 정한 이유는 [[ADR-053]] 에 있다.

데이터를 지워도 추적 모드와 추적 캐릭터는 남는다. `수동 선택 항목` 을 고르면 캐릭터마다 고른 수동 추적 항목이 지워진다.

## 리로드까지 하는 삭제

`clearCacheDataAndReload` 는 아래 순서로 진행한다.

1. `clearCacheData(selection)` 를 10초 타임아웃과 경쟁시킨다.
2. 실패하거나 시간을 넘기면 `setPendingNotice('cacheClearFailed')` 로 Preferences 에 표시를 남긴다. 다시 띄운 뒤
   `AppShell` 이 `showPendingCacheClearNotice` 로 읽고 오류 토스트를 띄운다.
3. `closeBossProfitDb()` 로 SQLite 커넥션을 닫는다(5초 상한, [[ADR-007]] 결정 3).
4. `showSplashScreen()` 을 부른다. RN 에는 스플래시를 다시 띄우는 API 가 없어서 이 호출은 아무 일도 하지 않는다([[ADR-013]] 결정 9).
5. 실패했어도 리로드한다. 지운 데이터가 이미 화면 곳곳에 반영돼 있어, 리로드하지 않고 어중간한 상태로 두는 편이 더 나쁘다.

OTA 적용도 같은 이유로 리로드 전에 DB 를 닫는다([[ADR-011]]).

## OS 와 라이브러리가 보관하는 것

| 무엇 | 보관하는 곳 | 앱이 아는 것 |
|---|---|---|
| 예약된 로컬 알림 | OS 알림 스케줄러(notifee) | 예약 내용을 다시 읽을 수 없어서 `notificationLedger` 에 따로 적는다([[ADR-056]]) |
| 받은 OTA 번들 | `expo-updates` 의 파일 저장소 | 지금 실행 중인 번들의 정보만 읽는다 |

둘 다 데이터 삭제 범위 밖이다. `notificationLedger` 도 데이터 삭제의 그룹 목록에 없어 남는다. 지우면 OS
에 남은 예약을 지목해 취소할 방법이 없다.
