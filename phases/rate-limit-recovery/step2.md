# Step 2: modal-copy

이 step 은 **모달을 원인별로 그린다.** 만지는 것은 `src/app/ApiKeyInvalidModal.tsx`(+ 이름 정리)와
그 테스트뿐이다. 감지 배선은 step 3 이다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(지정한 것만)
- `/docs/adr/ADR-116.md` — **결정 1**(원인별 문구 표가 이 step 의 계약이다)
- `/docs/adr/ADR-115.md` — **결정 10**(닫을 수 없는 모달의 근거)
- `/docs/adr/ADR-114.md` — **결정 1·4**(429 문구는 단계를 판정하지 않는다 · 자리가 담을 수 있는 양)
- `/docs/foundation/error-resilience.md` — 문구 어미 표([[ADR-062]] 결정 5)
- `/docs/foundation/design-system.md` — 아이콘 규칙(단독 vs 배지)
- `/src/app/ApiKeyInvalidModal.tsx` (전문) · `/src/app/__tests__/ApiKeyInvalidModal.test.tsx` (전문)
- `/src/app/UpdatePromptModal.tsx` (같은 골격의 선례 — `IconBadge`·버튼 클래스)
- **step 1 이 만든 것**: `apiKeyNotice: 'invalid' | 'rateLimited' | null` · `confirmApiKeyNotice()`

## 작업

TDD 다 — 테스트를 먼저 고치고, 그다음 구현.

### 1. 파일·컴포넌트 이름

`ApiKeyInvalidModal` → **`ApiKeyNoticeModal`**(파일도 `src/app/ApiKeyNoticeModal.tsx`). 이유: 이제
무효 키만 다루지 않는다. `src/App.tsx` 의 import·렌더도 함께 고쳐라(그 두 줄이 이 step 이 `App.tsx` 를
만지는 유일한 이유다). 테스트 파일도 같이 옮긴다.

### 2. 원인별 문구 — **표에서 벗어나지 마라** ([[ADR-116]] 결정 1)

| `apiKeyNotice` | 제목 | 본문 |
|---|---|---|
| `'invalid'` | `API 키가 더 이상 유효하지 않습니다` | `키 입력 화면으로 이동합니다.` |
| `'rateLimited'` | `호출 한도를 초과했습니다` | `서비스 단계 키로 다시 입력해주세요.` |

- 문구를 **한 글자도 바꾸지 마라** — step 3~5 의 테스트가 이 문자열을 단언한다.
- 429 본문이 처방까지 담는 것은 **모달이 줄바꿈되는 자리**라서다([[ADR-114]] 결정 4). 토스트 문구
  (`호출 한도를 초과했습니다` 한 줄)와 갈리는 것이 의도이니 **통일하지 마라** — 그 이유를 주석으로 남겨라.
- 어미 규칙([[ADR-062]] 결정 5)을 지킨다.
- **버튼은 `확인` 하나** — 두 원인 모두 같다. 닫기·취소·"나중에"를 만들지 마라([[ADR-116]] 결정 1,
  사용자가 429 도 닫을 수 없게 하기로 확정했다).

### 3. 아이콘

- `invalid` 는 지금 그대로 `KeyRound` + `bg-error-tint text-error-ink`.
- `rateLimited` 는 **다른 아이콘**을 쓴다(`lucide-react` 에서 고르되 한도·속도를 뜻하는 것 —
  예: `Gauge`·`TimerOff`). 톤은 `error` 로 통일할지 판단해 정하고 **근거를 주석으로 남겨라**
  (design-system.md 의 톤 규칙과 어긋나지 않을 것).
- 아이콘을 **배지 안에** 두는 현재 형태는 유지한다(모달은 `UpdatePromptModal` 과 같은 골격이고,
  `ErrorState` 의 "단독 아이콘" 규칙은 그쪽 컴포넌트의 것이다).

### 4. 테스트

`src/app/__tests__/ApiKeyNoticeModal.test.tsx`:
- 알림이 `null` 이면 아무것도 안 그린다.
- **두 kind 각각** 제목·본문을 **문자열 그대로** 단언한다.
- 두 kind 각각 `확인` 을 누르면 `confirmApiKeyNotice` 가 1회 불린다.
- 두 kind 각각 **오버레이를 눌러도 닫히지 않고 버튼이 정확히 1개**다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                     # errors 0
test -f src/app/ApiKeyNoticeModal.tsx
test ! -f src/app/ApiKeyInvalidModal.tsx
grep -q '서비스 단계 키로 다시 입력해주세요' src/app/ApiKeyNoticeModal.tsx
grep -q 'API 키가 더 이상 유효하지 않습니다' src/app/ApiKeyNoticeModal.tsx
# 이 step 은 app/ 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'src/app/' | wc -l    # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력**: `rateLimited` 분기를 `invalid` 와 같은 문구로 바꾸면 새 테스트가 실제로 실패하는가?
   확인 후 되돌리고 결과를 summary 에 적어라.
3. 아키텍처 체크: `app/` 컴포넌트가 `features/` 스토어를 읽는 것은 기존 패턴 그대로인가
   (`UpdatePromptModal` 과 같은 형태) · 어미 규칙 · 버튼이 하나인가.
4. `index.json` step 2 갱신 — summary 에 **새 파일명과 두 문구**를 담아라.

## 금지사항

- **감지 지점을 배선하지 마라**(step 3). 이 step 에서 429 가 실제로 모달을 띄우지는 않는다.
- **닫기·취소 버튼을 만들지 마라.** 이유: 사용자가 429 도 닫을 수 없게 확정했다([[ADR-116]] 결정 1).
- **429 모달 본문을 토스트 문구와 통일하지 마라.** 이유: 자리가 담을 수 있는 양이 다르다([[ADR-114]] 결정 4).
- **`features/` 를 건드리지 마라**(step 1 이 끝냈다).
- 기존 테스트를 깨뜨리지 마라.
