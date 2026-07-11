# Step 5: app-routing-cutover

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/App.tsx` — 현재 라우팅·하단 탭바 구조(`/content`, `/boss` 2개 탭)
- `src/__tests__/App.test.tsx` — 기존 라우팅 테스트 패턴
- `src/app/boss-profit/BossProfitScreen.tsx` (이전 step 산출물)

## 작업

`src/App.tsx`를 수정해 보스 수익 계산기를 세 번째 탭으로 연결한다.

1. `TAB_ITEMS`에 `{ to: '/profit', label: '수익', Icon: <적절한 lucide-react 아이콘> }`을 **기존 두 항목 뒤에 추가**한다(순서: 컨텐츠 → 보스 → 수익). 아이콘은 `lucide-react`에서 금전/수익을 나타내는 아이콘(예: `Coins`)을 골라 쓰되, 실제 설치된 `lucide-react` 버전(`package.json` 확인 — 현재 `^1.24.0`)에 해당 아이콘이 존재하는지 import가 되는지로 확인하라. 없으면 다른 금전 관련 아이콘으로 대체하라.
2. `<Routes>`에 `/profit` 라우트를 추가한다. 기존 `/content`·`/boss`와 동일하게 `isCompleted` 여부로 `BossProfitScreen` 또는 `/onboarding` 리다이렉트를 분기한다.
3. `import { BossProfitScreen } from './app/boss-profit/BossProfitScreen'`을 추가한다.
4. `src/__tests__/App.test.tsx`를 갱신해 새 탭·라우트·라벨을 검증하는 케이스를 추가한다(기존 케이스는 그대로 통과해야 한다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR.md 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `npm run dev`로 앱을 실제로 열어 하단 탭바에서 "수익" 탭을 눌러 보스 수익 계산기 화면이 정상적으로 뜨는지, 콘솔 에러가 없는지 육안으로 확인한다.
4. 결과에 따라 `phases/boss-profit-calculator/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 기존 `/content`, `/boss` 라우트·탭 순서를 바꾸지 마라. 새 탭은 반드시 세 번째 위치에 추가한다.
- `BossProfitScreen`·`useBossProfitStore` 내부 로직을 이 step에서 수정하지 마라 — 연결만 한다.
- 기존 테스트를 깨뜨리지 마라.
