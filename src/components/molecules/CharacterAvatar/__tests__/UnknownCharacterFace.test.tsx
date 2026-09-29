// 실루엣 머리는 넥슨 룩 얼굴보다 커서 `lib/face-crop` 표로 자르면 머리 안쪽만 잡혀 흰 덩어리가 된다.
import { processColor } from 'react-native'

import { unknownCharacterAsset } from '../../../../lib/assets/asset-lookup'
import { findAllOfType, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { UnknownCharacterFace } from '../UnknownCharacterFace'

describe('UnknownCharacterFace', () => {
  it('남색 그라데이션 원 위에 흰 실루엣을 세운다. `?` 는 없다', async () => {
    const view = await renderAtom(<UnknownCharacterFace testID="빈 얼굴" size={36} />)

    expect(view.queryByText('?')).toBeNull()
    // 왼쪽 위가 어둡고 오른쪽 아래로 밝아진다. 사용자가 준 참고 이미지에서 딴 두 끝이다.
    const 바탕 = view.getByTestId('빈 얼굴')
    // `LinearGradient` 는 색을 네이티브 정수로 바꿔 넘긴다. 같은 변환을 태워 비교한다.
    expect(바탕.props.colors).toEqual(['#19223d', '#333f63'].map(processColor))

    const images = findAllOfType(view.toJSON(), 'Image')
    expect(images).toHaveLength(1)
    expect(images[0].props.source).toBe(unknownCharacterAsset())
  })

  it('실루엣은 머리와 어깨까지 원에 들어오게 자른다', async () => {
    const view = await renderAtom(<UnknownCharacterFace size={36} />)

    // 180px 그림에서 (86, 95) 중심의 60px 박스가 36px 원을 채운다. 배율 0.6.
    expect(flattenStyle(findAllOfType(view.toJSON(), 'Image')[0].props.style)).toMatchObject({
      width: 108,
      height: 108,
      left: -33.6,
      top: -39,
    })
  })
})
