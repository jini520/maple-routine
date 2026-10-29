// 이 물음표의 계약은 둘이다. ① **원이 없다**(원 안에 놓이는 자리라 lucide 의 원이 겹친다)
// ② 물음표 선은 lucide `circle-question-mark` 와 **같다**(도움말 `?` 와 같은 앱 안에서 두 모양이 되지 않게).
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark'

import { findAllOfType, renderAtom } from '../../../__tests__/render-atom'
import { QuestionMarkIcon } from '../QuestionMarkIcon'

describe('QuestionMarkIcon', () => {
  it('원 없이 lucide 의 물음표 선만 그린다', async () => {
    const ours = (await renderAtom(<QuestionMarkIcon />)).toJSON()
    const lucide = (await renderAtom(<CircleQuestionMark />)).toJSON()
    const dOf = (tree: typeof ours): unknown[] =>
      findAllOfType(tree, 'RNSVGPath').map((path) => path.props.d)

    expect(findAllOfType(ours, 'RNSVGCircle')).toHaveLength(0)
    expect(dOf(ours)).toEqual(dOf(lucide))
  })
})
