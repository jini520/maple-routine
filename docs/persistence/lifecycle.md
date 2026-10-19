# 데이터 생명주기

기기에 저장한 데이터를 언제 읽고, 쓰고, 지우는지 정리한다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app/AppShell.tsx` | 부팅 때 설정을 읽어 스토어에 넣는다 |
| `app/prehydrate.ts` · `features/prehydrate.ts` | 탭 스토어 선하이드레이션 |
| `storage/cache-data.ts` | 캐시 데이터 삭제 · 그룹별 용량 계산 |
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

그보다 먼저 `index.ts` 의 `loadGameData()` 가 `queryCache` 를 읽어 게임 데이터 표를 덮어쓴다. 탭 스토어(컨텐츠 ·
보스 · 보스 수익)는 앱이 준비된 뒤 `prehydrate` 가 차례로 읽는다([[ADR-027]]). 그 밖의 값은 화면이 처음 열릴 때 그
기능의 스토어가 읽는다.

## 삭제: 연결 해제와 캐시 데이터 삭제

설정에 지우는 동작이 둘 있다. 이름은 비슷하지만 지우는 범위가 거의 반대다.

| | 연결 해제 | 캐시 데이터 삭제 |
|---|---|---|
| 어디서 | 더보기 → 설정 → 계정 및 데이터 | 더보기 → 설정 → 계정 및 데이터 → 캐시 데이터 삭제 |
| 지우는 것 | Preferences 의 `authMethods` · `apiKey` · `selectedAccountId` 셋. 넥슨 세션이 있으면 서버 세션도 끊는다 | 고른 그룹(아래 표) |
| 기록 | 그대로 둔다 | `기록` 그룹을 고르면 지운다. 되살릴 수 없다 |
| 결과 | 로그인 화면으로 돌아간다 | 앱을 리로드한다 |

캐시 데이터 삭제는 그룹 둘 중에서 고른다. 처음에는 둘 다 골라져 있다.

| 그룹 | 지우는 것 |
|---|---|
| `general` | `KEEP_KEYS` 에 없는 Preferences 키 전부 + 기록 그룹이 아닌 테이블(`boss_party_settings` · `boss_party_period_overrides` · `server_sync_queue`) |
| `records` | `RECORD_TABLE_NAMES` 의 테이블: `boss_profit_records` · `boss_drop_records` · `enhancement_history` · `enhancement_history_checks` · `income_records` · `spend_records` · `character_profiles` · `character_world_leaps` · `mvp_grade_history` · `character_accounts` |

`general` 은 따로 목록이 없고, `KEEP_KEYS` 와 `RECORD_TABLE_NAMES` 에 들지 않은 나머지 전부다. 그래서 새 Preferences 키와 새 테이블은 따로 적지 않으면 `general` 에
들어간다. 다시 받을 수 없는 값은 `KEEP_KEYS` 나 `RECORD_TABLE_NAMES` 에 직접 넣어야 한다. 테이블은 `DROP` 이 아니라
`DELETE FROM` 으로 비우므로 스키마는 남는다. 설정 화면의 용량 표시는 각 그룹이 실제로 지우는 범위의 바이트를
더한 근사값이다. 이렇게 나눈 이유는 [[ADR-053]] 에 있다.

캐시를 지우면 추적 모드는 남지만 추적 캐릭터와 수동 추적 항목은 지워진다. 캐릭터를 다시 고르면 수동 추적
항목이 기본값으로 다시 만들어지고, 사용자가 바꿔 둔 항목은 기본값으로 돌아간다.

## 리로드까지 하는 삭제

`clearCacheDataAndReload` 는 아래 순서로 진행한다.

1. `clearCacheData(selection)` 를 10초 타임아웃과 경쟁시킨다.
2. 실패하거나 시간을 넘기면 `setPendingNotice('cacheClearFailed')` 를 남긴다(`preferences.md` 의 주의 참고).
3. `closeBossProfitDb()` 로 SQLite 커넥션을 닫는다(5초 상한, [[ADR-007]] 결정 3).
4. `showSplashScreen()` 을 부른다. RN 에는 스플래시를 다시 띄우는 API 가 없어서 이 호출은 아무 일도 하지 않는다([[ADR-013]] 결정 9).
5. 실패했어도 리로드한다. 지운 데이터가 이미 화면 곳곳에 반영돼 있어, 리로드하지 않고 어중간한 상태로 두는 편이 더 나쁘다.

OTA 적용도 같은 이유로 리로드 전에 DB 를 닫는다([[ADR-011]]).

## OS 와 라이브러리가 보관하는 것

| 무엇 | 보관하는 곳 | 앱이 아는 것 |
|---|---|---|
| 예약된 로컬 알림 | OS 알림 스케줄러(notifee) | 예약 내용을 다시 읽을 수 없어서 `notificationLedger` 에 따로 적는다([[ADR-056]]) |
| 받은 OTA 번들 | `expo-updates` 의 파일 저장소 | 지금 실행 중인 번들의 정보만 읽는다 |

둘 다 캐시 데이터 삭제 범위 밖이다. `notificationLedger` 는 `KEEP_KEYS` 에 있어 캐시 삭제 뒤에도 남는다. 지우면 OS
에 남은 예약을 지목해 취소할 방법이 없다.
