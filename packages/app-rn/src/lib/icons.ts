/**
 * 이 앱이 쓰는 lucide 아이콘 — **`className` 이 풀리도록 등록한 뒤** 다시 내보낸다
 * (등록의 원리와 매핑 근거는 `nativewind-interop.ts` 의 `withIconInterop`).
 *
 * ## 왜 `lucide-react-native` 인가
 *
 * 웹은 `lucide-react` 로 DOM `<svg>` 를 그린다. RN 판은 같은 아이콘 세트를 `react-native-svg` 로
 * 그리는 공식 포트이고, **버전을 웹과 같은 1.24.0 으로 고정**했다 — 그림이 갈리면 같은 아이콘이
 * 두 앱에서 다르게 보인다(`design-system.md` 「아이콘」· [[ADR-066]] 결정 3 이 lucide 규격을
 * 조건으로 단 것과 같은 이유).
 *
 * ## 목록을 한 파일에 모아 두는 이유
 *
 * 등록을 빼먹으면 **에러도 경고도 없이 클래스만 사라진다**(색·크기 없는 아이콘). 아이콘을 쓰는
 * 파일마다 등록을 흩어 두면 그 실패가 어디서 시작됐는지 알 수 없으므로, **import 자리를 여기
 * 하나로 좁힌다** — `lucide-react-native` 를 직접 import 하는 곳이 이 파일뿐이면 빠뜨릴 자리도 없다.
 *
 * ## 배럴이 아니라 **아이콘별 경로**로 가져온다 (실측)
 *
 * `import { Users } from 'lucide-react-native'` 는 배럴을 타고 **아이콘 1,900개를 전부** 그래프에
 * 넣는다. Metro 는 기본적으로 트리셰이킹을 하지 않으므로 그대로 번들에 실린다 — 같은 8개를 쓰는
 * 두 방식을 재 보면 이렇다(2026-08-12, `expo export --platform android`).
 *
 *   배럴   3,365 모듈 · 5.5 MB
 *   개별   1,626 모듈 · 3.7 MB   ← **1.8 MB 차이**
 *
 * OTA 로 나가는 앱이라 이 차이가 매 배포의 다운로드 크기가 된다([[ADR-092]]·[[ADR-093]] 이 웹에서
 * 재던 것과 같은 축). **여기 목록이 늘어도 배럴로 되돌리지 말 것.**
 *
 * 이름은 lucide 의 **정규 이름**(kebab-case 파일명)이다 — 웹이 쓰는 `AlertTriangle` 은 옛 별칭이라
 * 런타임 모듈이 없고(`icons/alert-triangle.mjs` 가 없다 — 타입 선언만 있다) 실물은
 * `triangle-alert` 다. 그림은 같고, 이 파일에서 웹과 같은 이름으로 다시 내보낸다.
 */

import ChevronDown from 'lucide-react-native/icons/chevron-down'
import Clock from 'lucide-react-native/icons/clock'
import Info from 'lucide-react-native/icons/info'
import Minus from 'lucide-react-native/icons/minus'
import Plus from 'lucide-react-native/icons/plus'
import Sparkles from 'lucide-react-native/icons/sparkles'
import TriangleAlert from 'lucide-react-native/icons/triangle-alert'
import Users from 'lucide-react-native/icons/users'

import { withIconInterop } from './nativewind-interop'

/** 실패·경고 — `ErrorState` · `StaleBanner`. */
export const AlertTriangleIcon = withIconInterop(TriangleAlert)
/** 드롭다운 화살표 — `CharacterSelectDropdown`. */
export const ChevronDownIcon = withIconInterop(ChevronDown)
/** 아직 집계 전(pending 톤) — `UnavailableNotice`. */
export const ClockIcon = withIconInterop(Clock)
/** 조회 불가(정보 톤) — `UnavailableNotice`. */
export const InfoIcon = withIconInterop(Info)
/** 파티원 수 감소 — `PartySizeStepper`. */
export const MinusIcon = withIconInterop(Minus)
/** 파티원 수 증가 — `PartySizeStepper`. */
export const PlusIcon = withIconInterop(Plus)
/** 고가 드롭 반짝임 — `ValuableDropBadge`. */
export const SparklesIcon = withIconInterop(Sparkles)
/** 파티원 표식 — `PartySizeStepper`(compact). */
export const UsersIcon = withIconInterop(Users)
