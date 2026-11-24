/**
 * 메이플 ID 드롭다운. 캐릭터 관리 화면 아래 층의 머리에 서는 고르개.
 *
 * 값 규칙은 밖에 있다. 대표 캐릭터는 `summarizeAccount`, 이름은 `useMapleIdNameOf`, 넥슨 계정 묶음은
 * `groupAccountSummaries` 가 정하고 이 컴포넌트는 받은 것을 그리기만 한다. 저장소도 네트워크도 모른다.
 *
 * 재기 · 띄우기 · 펼치는 움직임 · 그림자는 `SelectField` 가 하고, 여기는 칸과 목록 줄의 모양만 넘긴다. 칸과 목록 줄이
 * 같은 `AccountRow` 다. 모양이 갈리면 지금 고른 것과 고를 수 있는 것이 다른 종류로 보인다.
 */
import { Image, Pressable, View } from 'react-native'

import type { AccountSummaryView } from '../../../features/character-manage/derivations'
import { worldEmblemUrl } from '../../../lib/assets/asset-lookup'
import { useMapleIdNameOf } from '../../../features/maple-id/names'
import { worldNameOf } from '../../../lib/world/worlds'

import { FACE_AVATAR_SIZE } from '../../../lib/face-crop'
import { CharacterAvatar } from '../../molecules/CharacterAvatar/CharacterAvatar'
import { UnknownCharacterFace } from '../../molecules/CharacterAvatar/UnknownCharacterFace'
import { Text } from '../../atoms'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { SelectChevron, SelectField, type SelectOption } from '../SelectField/SelectField'

// 얼굴 크롭 표는 `lib/face-crop` 하나뿐이다. 캐릭터 카드(`CharacterRow`)도 같은 것을 쓴다.

/** 칸의 안쪽 여백. */
const ROW_PADDING = 'px-3 py-2.5'

export interface AccountRowProps {
  summary: AccountSummaryView
  /** 캐시에 있을 때만 오는 초상 주소. 없으면 대표 이름의 첫 글자를 그린다. */
  portraitUrl: string | null
  /** 오른쪽 슬롯: 트리거만 `▾` 를 갖는다. */
  trailing?: React.ReactNode
}

/** 메이플 ID 표시 한 줄. 이름 아래에 대표 캐릭터를 둔다. 드롭다운 밖에서는 MVP 등급 모달의 ID 카드가 쓴다. */
export function AccountRow(props: AccountRowProps): React.JSX.Element {
  const { accountId, representative } = props.summary
  const emblem = worldEmblemUrl(representative.worldKey)
  const worldName = worldNameOf(representative.worldKey, representative.world)
  const nameOf = useMapleIdNameOf()

  return (
    <View className="flex-row items-center gap-2.5">
      {/* 초상화 규칙은 `CharacterRow` 와 같다. 두 자리가 갈리면 같은 얼굴이 화면마다 다르게
          없어진다. */}
      <CharacterAvatar
        overFrame
        imageTestID={`account-select-face-${accountId}`}
        mirrored
        imageUrl={props.portraitUrl}
        name={representative.name}
        size={FACE_AVATAR_SIZE}
        className="shrink-0"
        fallback={
          <UnknownCharacterFace testID={`account-select-face-fallback-${accountId}`} size={FACE_AVATAR_SIZE} />
        }
      />

      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-sm font-semibold text-text">
          {nameOf(accountId)}
        </Text>

        <View className="flex-row items-center gap-1">
          {emblem !== null && (
            <View testID={`account-select-emblem-${accountId}`} className="shrink-0">
              <Image
                accessibilityLabel={worldName}
                source={emblem}
                // 폭은 그림이 정한다. 안 적으면 엠블럼의 고유 폭이 남아 줄 왼쪽이 벌어진다.
                style={naturalAspectStyle(emblem, { height: 17 })}
                resizeMode="contain"
              />
            </View>
          )}
          <Text numberOfLines={1} className="min-w-0 flex-1 text-xs text-text-muted">
            {`${worldName} Lv.${representative.level} ${representative.name}`}
          </Text>
        </View>
      </View>

      {props.trailing}
    </View>
  )
}

export interface AccountSelectProps {
/** 파생값. 값 규칙(대표 · 월드 둘까지)은 이미 여기 담겨 온다. */
  accounts: AccountSummaryView[]
  /** 메이플 ID → 넥슨 계정 묶음 라벨. 없거나 비어 있으면 라벨을 두지 않는다 */
  groupOf?: Readonly<Record<string, string>>
  selectedAccountId: string
  /** 그 계정의 대표 캐릭터 얼굴. **캐시에 있을 때만**. 없으면 이니셜. */
  portraitByAccountId: Record<string, string | null>
  onSelect: (accountId: string) => void
}

export function AccountSelect(props: AccountSelectProps): React.JSX.Element {
  const nameOf = useMapleIdNameOf()

  // 고른 계정이 목록에 없을 수 있다(계정 목록이 갱신되는 순간). 렌더 중에 던지지 않는다.
  const selected = props.accounts.find((account) => account.accountId === props.selectedAccountId)
  if (selected === undefined) return <></>

  const byId = new Map(props.accounts.map((account) => [account.accountId, account]))
  // 이름은 스크린리더가 읽는다. 목록 줄이 보이는 그대로 이름과 대표 캐릭터 줄을 함께 싣는다.
  const options: SelectOption[] = props.accounts.map((account) => {
    const { representative } = account
    const worldName = worldNameOf(representative.worldKey, representative.world)
    return {
      value: account.accountId,
      label: `${nameOf(account.accountId)}, ${worldName} Lv.${representative.level} ${representative.name}`,
      group: props.groupOf?.[account.accountId],
    }
  })

  return (
    <SelectField
      label="메이플 ID"
      testID="account-select"
      options={options}
      selected={props.selectedAccountId}
      onSelect={(value) => {
        if (value !== null) props.onSelect(value)
      }}
      // 캐릭터 관리의 `캐릭터 추가` 카드 안에 서는 칸이라 `card-inset` 으로 칠한다.
      boxClassName={`rounded-[10px] bg-card-inset ${ROW_PADDING}`}
      renderTrigger={(open, isOpen) => (
        <Pressable testID="account-select-button" role="button" aria-expanded={isOpen} onPress={open} className="flex-1">
          <AccountRow
            summary={selected}
            portraitUrl={props.portraitByAccountId[selected.accountId] ?? null}
            trailing={<SelectChevron open={isOpen} />}
          />
        </Pressable>
      )}
      renderOption={(option) => {
        const account = option.value === null ? undefined : byId.get(option.value)
        return account === undefined ? null : (
          <AccountRow summary={account} portraitUrl={props.portraitByAccountId[account.accountId] ?? null} />
        )
      }}
    />
  )
}
