// atom 테스트가 공유하는 렌더 도우미. 테스트 파일이 아니라 **보조 파일**이라 `*.test.tsx` 가 아니고
// (`jest.config.js` 의 `testMatch` 가 이름으로 거른다), `layer-dependencies.test.ts` 의 "계층 밖 금지"
// 규칙에서도 `__tests__` 는 제외 대상이다.
//
// ## 왜 감싸야 하나
//
// 색이 `var(--color-*)` 라 **`ThemeProvider` 밖에서는 스타일 속성 자체가 사라진다**(NativeWind 는
// 못 찾은 변수를 조용히 버린다. `src/theme/theme-vars.ts` 참고). 감싸지 않고 찍은 스냅샷은
// "색이 없는 트리"를 기준선으로 굳혀서, 나중에 색이 진짜로 빠져도 초록으로 남는다.
//
// ## 기대값을 손으로 적지 않는다
//
// 색을 단언할 때는 `job-themes.json`(= `getThemeDefinition`)에서 읽는다(색은 사람이
// 확인해 커밋한 값이고, 테스트가 베끼면 두 벌이 된다). `theme/__tests__/ThemeProvider.test.tsx` 와
// 같은 방식이다.
import { getThemeDefinition } from '../../lib/theme/theme-registry'
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { PortalProvider } from '@gorhom/portal'
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context'

import { BottomBarOverlayHost } from '../../navigation/BottomBarOverlay'
import { ThemeProvider } from '../../theme/ThemeProvider'

/** 테스트가 보는 테마. `appearance-store` 의 초기값(`DEFAULT_THEME`)과 같아야 한다. */
export const 기본테마 = getThemeDefinition('머쉬맘')

export function renderAtom(ui: ReactElement): ReturnType<typeof render> {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

/**
 * 오버레이(organisms)용 렌더. `renderAtom` 에 `SafeAreaProvider` 를 하나 더 두른다.
 *
 * 안전영역을 **읽는 컴포넌트만** 이것을 쓴다. `renderAtom` 에 합치지 않은 이유는 그 프로바이더가
 * 뷰를 하나 더 그려 **기존 스냅샷 전부가 흔들리기** 때문이고, 안전영역이 필요 없는 컴포넌트에까지
 * 그 값을 흘려보내면 "왜 여기 있나"가 안 읽히기 때문이다.
 *
 * `initialMetrics` 를 주는 것은 선택이 아니라 필수다. 없으면 실제 측정이 올 때까지 프로바이더가
 * 자식을 아예 렌더하지 않아 테스트가 빈 트리를 본다(react-navigation 의 테스트 권장 방식과 같다).
 * 값은 iPhone 계열의 인셋(상 59· 하 34)이라 이 실측한 표와 같은 자리를 검사한다.
 */
export const 테스트_안전영역: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
}

export function renderOverlay(
  ui: ReactElement,
  metrics: Metrics = 테스트_안전영역,
): ReturnType<typeof render> {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        {/*
          **바 위 슬롯을 함께 세운다**. 화면이 소유한 오버레이 중 일부는 이제 자기가
          선 자리가 아니라 이 호스트에 그려지므로(`SpeedDial`), 호스트가 없으면 트리에서 통째로
          사라져 보인다. `BottomBarOverlay` 는 **호스트가 없으면 아무 데도 안 그린다** 가 계약이다.

          **기존 스냅샷은 안 흔들린다**. `PortalProvider` 도 호스트도 뷰를 하나도 안 그린다
          (`SafeAreaProvider` 를 `renderAtom` 에 합치지 않은 이유와 갈리는 지점).
        */}
        <PortalProvider shouldAddRootHost={false}>
          {ui}
          <BottomBarOverlayHost />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

/**
 * 쿼리가 돌려주는 엘리먼트. `react-test-renderer` 의 `ReactTestInstance` 와 같은 것이지만 그쪽에는
 * 타입 선언이 없어(`@types/react-test-renderer` 미설치) 렌더 결과에서 파생해 쓴다. 타입 하나
 * 때문에 devDependency 를 더하지 않는다.
 */
export type AtomElement = ReturnType<Awaited<ReturnType<typeof render>>['getByText']>

/** `style` 프롭이 배열로도 오므로 평평하게 편다. */
export function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle)) as Record<string, unknown>
  }
  if (style !== null && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

/** `toJSON` 이 내는 노드. */
export interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[] | null
}

/**
 * 렌더 트리에서 특정 호스트 노드를 전부 찾는 도우미. SVG 안쪽(`RNSVGClipPath`·`RNSVGMask` …)을 볼 때 쓴다.
 *
 * RNTL 의 쿼리로는 닿지 않는다: `getBy*` 는 testID·역할·글자로 찾고 SVG 내부 도형에는 그중 아무것도
 * 없다. `findAllByType` 같은 react-test-renderer API 도 RNTL 14 의 엘리먼트에는 없다(실측). 그래서
 * `toJSON` 결과를 직접 훑는다. 프롭이 이미 네이티브 값으로 정리돼 있어 오히려 읽기 쉽다.
 */
export function findAllOfType(node: unknown, type: string): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAllOfType(child, type))
  if (node === null || typeof node !== 'object') return []

  const current = node as TreeNode
  const found = current.type === type ? [current] : []
  return [...found, ...findAllOfType(current.children, type)]
}
