// 계산기의 보스 선택 시트. 캐릭터 하나의 주간 보스를 12개까지 고르고 `적용` 으로 넘긴다.
// 타일을 눌러 넣고 빼는 규칙은 `features/boss-profit-calculator/__tests__/picker.spec.ts` 가 본다. 타일 누름은 초상을 재는
// `measureInWindow` 가 테스트 환경에서 돌아오지 않아 여기서 누르지 않는다.
import type { ReactNode } from 'react'

// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 시트 안에 무엇이 서는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { CalculatorBoss } from '../../../lib/boss/boss-profit-calculator'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { CalculatorBossPickerSheet } from '../boss-profit-calculator/CalculatorBossPickerSheet'

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
const CHARACTER = { ocid: 'ocid-1', name: '단풍전사', imageUrl: null, worldKey: 'scania' }

function boss(bossKey: string): CalculatorBoss {
  return { bossKey, difficulty: 'hard', partySize: 1, shares: EVEN }
}

beforeEach(() => {
  installNoopNativePorts()
})

describe('CalculatorBossPickerSheet', () => {
  it('지금 고른 보스를 담고 열고, 머리 배지는 n / 12 다', async () => {
    const view = await renderOverlay(
      <CalculatorBossPickerSheet character={CHARACTER} registered={[]} initial={[boss('lotus')]} onApply={jest.fn()} onClose={jest.fn()} />,
    )

    expect(view.getByText('보스 선택')).toBeTruthy()
    expect(view.getByText('단풍전사')).toBeTruthy()
    expect(view.getByText('1 / 12')).toBeTruthy()
  })

  it('12개를 고르면 나머지 타일은 고를 수 없다', async () => {
    const 열둘 = ['lotus', 'damien', 'lucid', 'will', 'gloom', 'verus_hilla', 'darknell', 'chosen_seren', 'guardian_kalos', 'first_adversary', 'guardian_angel_slime', 'papulatus'].map(boss)
    const view = await renderOverlay(
      <CalculatorBossPickerSheet
        character={CHARACTER}
        registered={[{ bossKey: 'kaling', difficulty: 'normal' }]}
        initial={열둘}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    )

    expect(view.getByLabelText('카링 고르기').props.accessibilityState.disabled).toBe(true)
  })
})
