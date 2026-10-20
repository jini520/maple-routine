// 실루엣 머리는 넥슨 룩 얼굴보다 커서 `lib/face-crop` 표로 자르면 머리 안쪽만 잡혀 흰 덩어리가 된다.
import { findAllOfType, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { UnknownCharacterFace } from '../UnknownCharacterFace'

describe('UnknownCharacterFace', () => {
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
