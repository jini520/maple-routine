# ADR-102 강화 합계에서 빠지거나 판정하지 못한 줄을 서버 표에 남긴다

> 🟢 유효
> 관련 소스: `features/enhancement-history/anomalies.ts` · `features/enhancement-history/spending.ts` · `features/enhancement-history/collect.ts` · `features/enhancement-history/legacy-totals.ts` · `server/enhancement-anomalies.ts`

## 배경

강화 내역을 원본 대신 합계로 저장하면([[ADR-100]]), 응답 원본이 기기에 남지 않는다. 그래서 받은 줄을 합계에서 빼거나 판정하지
못한 일이 생겨도 나중에 원인을 볼 길이 없다(#614 를 구현하며 사용자 지정 2026-10-26). 실기기에는 강화 내역 30,793 줄 가운데
5,029 줄이 장비 표에 없는 장비였다.

## 결정

### 결정 1. 합계에서 빼거나 판정하지 못한 줄을 날짜 · 종류 · 이유 · 장비마다 세어 서버에 알린다

목적은 예상하지 못한 상황이 얼마나 · 어떤 모양으로 생기는지 운영자가 보는 것이다. 통계에 쓰지 않는다.

| 이유(`anomalyType`) | 언제 생기나 |
|---|---|
| `event_world_unknown` | 캐릭터 목록 요청이 실패한 회차의 큐브 · 잠재 · 소울 줄. 이벤트 월드인지 몰라 판정을 비웠다([[ADR-100]] 결정 5). `detail` 에 목록 요청의 실패 이유를 싣는다 |
| `no_level` | 장비 레벨을 모른다. 장비 표에 없는 장비의 스타포스, 응답에 레벨이 없는 큐브 · 잠재 |
| `no_grade` | 재설정 전 등급을 모른다. 사용 전 옵션이 없거나 모르는 등급 글자가 있는 잠재 · 소울 |
| `no_star` | 스타포스 응답에 시도 전 성수가 없다 |
| `no_type` | 잠재 응답의 재설정 종류를 모른다 |
| `no_cost` | 레벨 · 등급은 아는데 비용 표에 그 구간이 없다 |

- 캐릭터 이름은 싣지 않는다(사용자 선택). 원인을 보는 데는 장비 이름 · 종류 · 이유 · 줄 수면 된다. `event_world_unknown` 은
  장비와 무관해 장비 이름이 빈 글자다.
- 전용 재화(`펄스 인핸서`) 줄은 알리지 않는다. 메소가 안 드는 줄이라 빼는 것이 정상이다.

### 결정 2. 받은 자리에서 묶어 한 번 보내고, 실패하면 버린다

수집기가 한 날 · 한 종류를 받을 때마다 그 날의 상황을 묶어 `POST /v1/enhancement-anomalies` 로 한 번 보낸다. 옛 원본을 합계로
옮기는 부팅 단계([[ADR-100]] 결정 3)는 옮긴 줄 전체의 상황을 묶어 보낸다. 대기 표에 쌓아 다시 보내지 않는다(사용자 선택).
운영자가 양과 모양을 보는 용도라 몇 건을 놓쳐도 된다. 신원이 없으면 보내지 않는다.

### 결정 3. 서버는 표에 남기고, 같은 날 · 종류 · 이유 · 장비는 한 줄을 덮는다

서버 표 `enhancement_anomalies` 에 적는다(사용자 선택). 컨테이너 로그는 다시 만들면 사라지고 모아 보기 어렵다.
`UNIQUE (user_id, history_date, enhancement_type, anomaly_type, item_name)` 이고 받은 값으로 덮는다. 수집기는 오늘처럼 굳지 않은
날을 받을 때마다 그 날 전체를 다시 세므로, 덮어야 같은 줄이 여러 번 쌓이지 않는다.

```
서버 enhancement_anomalies   id · user_id · identified_by · history_date · enhancement_type · anomaly_type · item_key · item_name
                             · row_count · detail · created_at · updated_at
```

## 테스트

| 테스트 | 확인하는 것 |
|---|---|
| `features/enhancement-history/__tests__/anomalies.spec.ts` | 이유마다 가르고 날짜 · 종류 · 이유 · 장비로 세는지, 전용 재화와 값이 매겨진 줄은 안 세는지, 목록을 못 받으면 판정 못 한 줄을 세는지(결정 1) |
| `features/enhancement-history/__tests__/collect.spec.ts` | 받은 날마다 상황을 보내고, 없으면 안 보내며, 보내기가 실패해도 수집이 이어지는지(결정 2) |
| 서버 `modules/enhancement-anomalies/*.spec.ts` | 신원이 없으면 401, 같은 열쇠는 한 줄을 덮는지, 모르는 이유는 거절하는지(결정 3) |

## 번호 기록

- ADR-102 (2026-10-26): 강화 합계에서 빼거나 판정하지 못한 줄을 서버 로그로 남기는 결정을 처음 작성했다. 같은 날 보내는 방법 ·
  남기는 곳 · 캐릭터 이름을 정해 구현했다(#736)
