# 기기 저장소

앱이 기기에 저장하는 데이터를 한눈에 정리한 문서다. 앱을 다시 켜거나 기기를 재부팅해도 남는 값을 다룬다. 기록의 원본은 기기에
있고, 저장소를 어떻게 감싸는지는 [[ADR-004]] 에 있다.

| 문서 | 다루는 것 |
|---|---|
| [preferences.md](./preferences.md) | Key-Value 저장소의 키 전부 |
| [sqlite.md](./sqlite.md) | SQLite 테이블 · 칸 · 버전 이관 |
| [lifecycle.md](./lifecycle.md) | 언제 읽고, 쓰고, 지우는가(부팅 · 캐시 데이터 삭제 · 연결 해제 · 리로드) |
| [capacitor-storage.md](./capacitor-storage.md) | Capacitor 앱이 남긴 저장소를 그대로 여는 규칙 |

## 저장소 셋

| 저장소 | 담는 것 | 형태 |
|---|---|---|
| Preferences | 설정 · 동기화 캐시 · 캐릭터 선택 · 작은 기록(파티 약속 등) | 평문 Key-Value. iOS `UserDefaults`, Android SharedPreferences |
| SQLite(`boss_profit`) | 보스 수익 · 드롭 · 가계부 · 강화 내역 · MVP 등급 같은 기록 | 테이블 열넷 |
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
| 사용자가 고른 설정 | `theme` · `trackingMode` · `dropEffect` · 알림 스위치 | 다시 고르면 된다. 대부분 캐시 삭제에서 남긴다 |
| 동기화 캐시 | `schedulerCache:{ocid}` · `characterBasicCache:{ocid}` · `queryCache` | 다음 조회가 다시 채운다 |
| 기기에만 있는 기록 | 보스 수익 · 드롭 · 가계부 · 파티 약속 · MVP 등급 이력 | 되살릴 방법이 없다. 넥슨 API 는 최근 기간만 준다 |

## 여기서 다루지 않는 것

- `src/data/*.json`(보스 표 · 결정석 가격 · 드롭 표). 앱 번들에 들어 있는 읽기 전용 데이터다. 서버에서 받은 사본만
  `queryCache` 로 저장된다([[ADR-019]] · [[ADR-020]]).
- zustand 스토어. 저장소를 읽어 메모리에 올린 것이라 앱을 끄면 사라진다.
