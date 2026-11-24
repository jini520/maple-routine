/**
 * 아이템 넣기 시트를 여는 떠 있는 버튼. 자리와 크기가 가계부 · 파티 스케줄의 ＋ 와 같아 어디서 더하는지 새로 익힐 것이 없다.
 * 그리는 자리는 `BottomBarOverlay` 포털 안이다. 화면 안에서 그리면 떠 있는 하단바 아래로 간다.
 */
import { PlusIcon } from '../../components/atoms'
import { Fab, FabAnchor } from '../../components/molecules/Fab/Fab'
import { BottomBarOverlay } from '../../components/organisms/BottomBar/BottomBarOverlay'

export function InventoryAddFab(props: { onPress: () => void }): React.JSX.Element {
  return (
    <BottomBarOverlay>
      <FabAnchor>
        <Fab testID="inventory-add-fab" label="아이템 넣기" onPress={props.onPress}>
          <PlusIcon className="h-6 w-6 text-on-primary" strokeWidth={2.2} aria-hidden />
        </Fab>
      </FabAnchor>
    </BottomBarOverlay>
  )
}
