# 기기 저장소

앱이 기기에 저장하는 데이터를 한눈에 정리한 문서다. 앱을 다시 켜거나 기기를 재부팅해도 남는 값을 다룬다. 기록은 기기에 먼저
저장하고 화면도 기기 저장소에서 그린다. 1.0.15 부터는 사용자가 만든 기록을 서버에도 올려 같은 사람의 기기끼리 맞춘다. 무엇을
올리고 어떻게 받는지는 `foundation/server-sync.md` 와 [[ADR-099]] 에, 저장소를 어떻게 감싸는지는 [[ADR-004]] 에 있다.

| 문서 | 다루는 것 |
|---|---|
| [preferences.md](./preferences.md) | Key-Value 저장소의 키 전부 |
| [sqlite.md](./sqlite.md) | SQLite 테이블 · 칸 · 버전 이관 |
| [lifecycle.md](./lifecycle.md) | 언제 읽고, 쓰고, 지우는가(부팅 · 데이터 삭제 · 로그아웃 · 리로드) |
| [capacitor-storage.md](./capacitor-storage.md) | Capacitor 앱이 남긴 저장소를 그대로 여는 규칙 |

## 저장소 셋

| 저장소 | 담는 것 | 형태 |
|---|---|---|
| Preferences | 설정 · 동기화 캐시 · 캐릭터 선택 · 작은 기록(파티 약속 등) | 평문 Key-Value. iOS `UserDefaults`, Android SharedPreferences |
| SQLite(`boss_profit`) | 보스 수익 · 드롭 · 가계부 · 인벤토리 · 강화 합계 · MVP 등급 같은 기록과 서버로 올릴 대기 표 | 표 목록은 `sqlite.md` |
| OS 와 라이브러리 | 예약된 로컬 알림 · 받은 OTA 번들 | 앱이 직접 읽지 못한다 |

단순한 값은 Preferences 에, 날짜 범위로 조회하거나 복합 키로 upsert 하는 기록은 SQLite 에 둔다([[ADR-004]] 결정 3).

## 읽고 쓰는 경로

`features/*` · `app/*` 는 `storage/*.ts` 의 함수만 부른다. 그 함수들은 `storage/ports.ts` 의 포트를 거쳐
`storage/adapters/rn-preferences.ts` · `rn-sqlite.ts` 에 닿는다.

```
features/* · app/*  →  storage/*.ts  →  storage/ports.ts  →  storage/adapters/rn-*.ts  →  modules/capacitor-storage · op-sqlite
```

## 데이터의 성격

| 성격 | 예 | 잃으면 |
|---|---|---|
| 앱 설정 | `theme` · `textSize` · `dropEffect` · 알림 스위치 | 기기마다 따로 두고 서버에 올리지 않는다([[ADR-099]] 결정 15). 다시 고르면 된다. 데이터 삭제에서 남긴다 |
| 동기화 캐시 | 쿼리 캐시 표 `query_cache`(스케줄 · 캐릭터 기본 정보 · 회차 · 공지 · 메소 획득량 · 이벤트 월드 이름) · 게임 데이터 사본(`game_data_sections` · `game_data_meta`) · 받은 그림 | 다음 조회가 다시 채운다. 게임 데이터는 잠금 화면이 다시 받는다 |
| 서버와 맞추는 기록과 설정 | 보스 수익 · 드롭 · 가계부 · 인벤토리 · 강화 합계 · 파티 약속 · 계산기 기록 · MVP 등급 이력 · 추적 캐릭터 · `trackingType` · 하단바 순서 | 1.0.15 부터 서버에도 있다. 같은 사람으로 로그인하면 새 기기도 서버에서 받는다. 대기 표(`server_sync_queue`)에 남은, 아직 올리지 못한 기록만 그 기기에 있다. 넥슨 API 는 최근 기간만 주므로 넥슨에서는 다시 받을 수 없다 |

## 여기서 다루지 않는 것

- 게임 데이터의 형식과 받는 순서. 사본 표 둘은 `sqlite.md` 에 있고, 받는 방법은 [[ADR-020]] 에 있다.
- zustand 스토어. 저장소를 읽어 메모리에 올린 것이라 앱을 끄면 사라진다.
