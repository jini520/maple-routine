// 앱 글자 배수의 **산수**만 보는 테스트. 렌더는 옆 파일(`Text.test.tsx`)이 본다.
//
// 표의 모든 칸과 네 단계를 다 돌린다. 지키는 것은 "곱한다" 가 아니라 **줄 높이와 글자 크기의 비율이
// 어느 단계에서도 그대로인가** 다. 줄 높이만 빠지면 큰 단계에서 글자가 줄 상자에 잘린다.
import { TEXT_SIZES, TEXT_SIZE_SCALE } from '../../../../lib/text-size'
import { scaleTextStyle } from '../font-scaling'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fontSize: 글자표 } = require('../../../../../typography.cjs') as {
  fontSize: Record<string, [string, { lineHeight: string }]>
}

const px = (value: string): number => Number(value.replace('px', ''))

describe('scaleTextStyle: 글자 크기와 줄 높이에 같은 배수를 곱한다', () => {
  it('표의 모든 칸 · 네 단계에서 크기에 배수를 곱하고, 줄 높이 비율은 그대로다', () => {
    const 어긋남: string[] = []
    for (const size of TEXT_SIZES) {
      const scale = TEXT_SIZE_SCALE[size]
      for (const [name, [fontSize, { lineHeight }]] of Object.entries(글자표)) {
        const style = scaleTextStyle({ fontSize: px(fontSize), lineHeight: px(lineHeight) }, scale)
        const 크기맞음 = Math.abs(style.fontSize! - px(fontSize) * scale) < 1e-9
        const 비율맞음 =
          Math.abs(style.lineHeight! / style.fontSize! - px(lineHeight) / px(fontSize)) < 1e-9
        if (!크기맞음 || !비율맞음) 어긋남.push(`${size} · text-${name}`)
      }
    }
    expect(어긋남).toEqual([])
  })

  it('크기가 없는 글자는 손대지 않는다. 바깥 Text 의 크기를 물려받아야 한다', () => {
    expect(scaleTextStyle({ color: '#000', fontWeight: '700' }, 1.2)).toEqual({
      color: '#000',
      fontWeight: '700',
    })
  })

  it('줄 높이만 준 글자도 줄 높이를 곱한다. 크기는 물려받은 것이라 그대로 비워 둔다', () => {
    expect(scaleTextStyle({ lineHeight: 12 }, 1.1)).toEqual({ lineHeight: 12 * 1.1 })
  })
})
