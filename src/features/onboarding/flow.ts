/**
 * 온보딩 흐름이 앱마다 갈리는 **단 하나의 값**([[ADR-143]] 결정 8).
 *
 * ## 왜 값 하나인가
 *
 * RN 은 메이플 ID 를 고르지 않고 여러 계정의 캐릭터를 한 목록으로 고른다 — 그래서 온보딩이
 * 다섯 단계에서 세 단계가 된다. 그런데 온보딩 스토어에는 무효 키·한도 초과 알림 사슬
 * ([[ADR-115]]·[[ADR-116]])이 함께 들어 있어 **사본을 만들 수 없다**([[ADR-140]] 결정 4 와 같은
 * 판단 — 세 번째 사본을 만들지 않는다). 그래서 앱이 주입하는 값 하나만 두고 나머지는 공유한다.
 *
 * ## 읽는 자리는 둘뿐이다
 *
 * - 재개 파생(`resume.ts`) — `'all'` 이면 «`selectedAccountId` 없음 → `selectingAccount`» 행이
 *   표에서 빠진다. 나머지 세 행은 그대로다.
 * - 키 재입력 가드(`store.ts` 의 `submitApiKey`) — 대조할 `selectedAccountId` 가 없으므로 같은
 *   목적을 추적 ocid 로 세운다([[ADR-143]] 결정 9).
 *
 * **셋째가 생기면 설계가 새는 것이다.** 정렬·표시처럼 다른 축의 갈림을 이 값에 얹지 마라 — 그
 * 축들은 각자 자기 방법으로 푼다([[ADR-143]] 결정 3 이 순서를 RN 화면 셀렉터로 푼 것처럼).
 *
 * ## 한시적이다
 *
 * 저장소·네이티브 포트 주입(`storage/ports.ts`)과 모양이 같지만 **뜻이 다르다** — 그쪽은 "구현이
 * 플랫폼마다 다르다"이고 이쪽은 "제품 흐름이 앱마다 다르다"다. core 에 제품 흐름 분기가 생기는
 * 것은 이번이 처음이고, 한시적이라는 것이 그 대가를 견딜 수 있게 하는 유일한 근거다.
 * **`app-capacitor` 가 걷히면 이 파일을 지우고 `'all'` 만 남긴다.**
 */
export type OnboardingAccountScope =
  /** 메이플 ID 하나를 고르고 그 안에서 산다(웹뷰 앱, [[ADR-051]]·[[ADR-086]]). */
  | 'single'
  /** 계정을 고르지 않고 전 계정의 캐릭터를 한 목록으로 다룬다(RN, [[ADR-143]]). */
  | 'all'

/**
 * **기본값이 `'single'` 인 것이 계약이다.** 웹뷰 앱은 아무것도 주입하지 않으므로, 이 기본이
 * 뒤집히면 그 앱의 재개 표에서 계정 선택 행이 조용히 사라진다 — 계정을 고르는 화면은 그대로 있는
 * 채로 아무도 그리로 보내지 않는 상태가 된다.
 */
let accountScope: OnboardingAccountScope = 'single'

/** 앱이 부팅 시 한 번 주입한다(`app-rn/src/boot.ts` — 저장소를 처음 만지는 코드보다 먼저). */
export function setOnboardingAccountScope(scope: OnboardingAccountScope): void {
  accountScope = scope
}

export function getOnboardingAccountScope(): OnboardingAccountScope {
  return accountScope
}
