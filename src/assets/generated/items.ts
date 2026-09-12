/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: 아이템·반지 아이콘. `lib/item-icons.ts` 가 `iconFile`(확장자 포함)로 찾는다
 * 원본: src/assets/items/*.{png,webp} · src/assets/items/rings/*.{png,webp}
 *
 * 값의 타입은 번들러가 정한다. Metro 는 에셋 id(숫자)를 준다. 그것을
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 다.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../items/rings/Berserker_Ring.png'
import a1 from '../items/rings/Clean_Defense_Ring.png'
import a2 from '../items/rings/Clean_Stance_Ring.png'
import a3 from '../items/rings/Cleansing_Ring.png'
import a4 from '../items/rings/Continuous_Ring.webp'
import a5 from '../items/rings/Crisis_HM_Ring.webp'
import a6 from '../items/rings/Crisis_H_Ring.webp'
import a7 from '../items/rings/Crisis_M_Ring.png'
import a8 from '../items/rings/Critical_Damage_Ring.webp'
import a9 from '../items/rings/Critical_Defense_Ring.png'
import a10 from '../items/rings/Critical_Shift_Ring.png'
import a11 from '../items/rings/Durability_Ring.png'
import a12 from '../items/rings/Health_Cut_Ring.png'
import a13 from '../items/rings/Level_Jump_Ring.png'
import a14 from '../items/rings/Limit_Ring.webp'
import a15 from '../items/rings/Mana_Cut_Ring.png'
import a16 from '../items/rings/Overdrive_Ring.png'
import a17 from '../items/rings/Reflective_Ring.png'
import a18 from '../items/rings/Ring_of_Restraint.webp'
import a19 from '../items/rings/Risk_Taker_Ring.webp'
import a20 from '../items/rings/Stance_Shift_Ring.png'
import a21 from '../items/rings/Swift_Ring.png'
import a22 from '../items/rings/Totalling_Ring.webp'
import a23 from '../items/rings/Tower_Boost_Ring.png'
import a24 from '../items/rings/Ultimatum_Ring.webp'
import a25 from '../items/rings/Weapon_Jump_Ring.webp'
import a26 from '../items/additional_cube.webp'
import a27 from '../items/additional_potential_reset.png'
import a28 from '../items/adversary_resolve.webp'
import a29 from '../items/adversary_resolve_piece.webp'
import a30 from '../items/alleria_elixir.webp'
import a31 from '../items/amazing_positive_chaos_scroll.webp'
import a32 from '../items/arcane_river_spiegelmann.webp'
import a33 from '../items/black_circulator.webp'
import a34 from '../items/black_cube.webp'
import a35 from '../items/blueberry_farm_ticket.webp'
import a36 from '../items/boss_ring_box_black.png'
import a37 from '../items/boss_ring_box_green.png'
import a38 from '../items/boss_ring_box_life.png'
import a39 from '../items/boss_ring_box_red.png'
import a40 from '../items/boss_ring_box_white.png'
import a41 from '../items/box_eternel_adversary.png'
import a42 from '../items/box_eternel_bardrix.png'
import a43 from '../items/box_eternel_bellona.webp'
import a44 from '../items/box_eternel_destiny.webp'
import a45 from '../items/box_eternel_jupiter.png'
import a46 from '../items/box_eternel_kaling.png'
import a47 from '../items/box_eternel_kalos.png'
import a48 from '../items/box_eternel_limbo.png'
import a49 from '../items/box_eternel_maerin.webp'
import a50 from '../items/box_eternel_maleficStar.png'
import a51 from '../items/box_solerda_maerin_high.webp'
import a52 from '../items/bright_boss_eye_acc.webp'
import a53 from '../items/bright_boss_face_acc.png'
import a54 from '../items/bright_boss_merit.png'
import a55 from '../items/bright_boss_pendant.png'
import a56 from '../items/bright_boss_ring.png'
import a57 from '../items/bright_boss_ring2.png'
import a58 from '../items/cerzar.webp'
import a59 from '../items/collector_elixir.webp'
import a60 from '../items/core_gemstone_mirror.png'
import a61 from '../items/core_gemstone_mitra.png'
import a62 from '../items/cube_bronze_additional.png'
import a63 from '../items/cube_gold.png'
import a64 from '../items/cube_silver.png'
import a65 from '../items/dark_boss_badge.png'
import a66 from '../items/dark_boss_belt.png'
import a67 from '../items/dark_boss_box.png'
import a68 from '../items/dark_boss_box_maerin.webp'
import a69 from '../items/dark_boss_complete_heart.png'
import a70 from '../items/dark_boss_earring.png'
import a71 from '../items/dark_boss_emblem.png'
import a72 from '../items/dark_boss_eye_acc.png'
import a73 from '../items/dark_boss_face_acc.png'
import a74 from '../items/dark_boss_pendant.png'
import a75 from '../items/dark_boss_pocket.png'
import a76 from '../items/dark_boss_ring.png'
import a77 from '../items/dawn_boss_earring.png'
import a78 from '../items/dawn_boss_face_acc.png'
import a79 from '../items/dawn_boss_pendant.png'
import a80 from '../items/dawn_boss_ring.png'
import a81 from '../items/equipment_enhancement_scroll.png'
import a82 from '../items/erion_piece.png'
import a83 from '../items/except_belt.png'
import a84 from '../items/except_earring.png'
import a85 from '../items/except_eye_acc.png'
import a86 from '../items/except_face_acc.png'
import a87 from '../items/except_merit.png'
import a88 from '../items/frag_destiny.webp'
import a89 from '../items/frag_eternel_bardrix.png'
import a90 from '../items/frag_eternel_bellona.webp'
import a91 from '../items/frag_eternel_jupiter.png'
import a92 from '../items/frag_eternel_limbo.png'
import a93 from '../items/grandis_spiegelmann.webp'
import a94 from '../items/honor_elixir.webp'
import a95 from '../items/intense_power_crystal_monthly.webp'
import a96 from '../items/intense_power_crystal_weekly.webp'
import a97 from '../items/kaling_link.webp'
import a98 from '../items/kaling_link_piece.webp'
import a99 from '../items/kalos_will.webp'
import a100 from '../items/kalos_will_piece.webp'
import a101 from '../items/karma_amazing_positive_chaos_scroll.webp'
import a102 from '../items/karma_premium_accessory_attack_scroll.webp'
import a103 from '../items/karma_premium_accessory_magic_scroll.webp'
import a104 from '../items/karma_premium_pet_equip_attack_scroll.webp'
import a105 from '../items/karma_premium_pet_equip_magic_scroll.webp'
import a106 from '../items/luminous_moonshine_potion.png'
import a107 from '../items/magical_onehand_attack_scroll.webp'
import a108 from '../items/magical_onehand_magic_scroll.webp'
import a109 from '../items/magical_twohand_attack_scroll.webp'
import a110 from '../items/magical_weapon_scroll_coupon.png'
import a111 from '../items/maleficstar_shard.webp'
import a112 from '../items/maleficstar_shard_piece.webp'
import a113 from '../items/mechaberry_farm_ticket.webp'
import a114 from '../items/meso.webp'
import a115 from '../items/meso_pouch.webp'
import a116 from '../items/mihoroid.webp'
import a117 from '../items/monster_park_ticket.webp'
import a118 from '../items/npc_mr_newname.webp'
import a119 from '../items/papulatus_mark.png'
import a120 from '../items/pet_equip_attack_scroll.webp'
import a121 from '../items/pet_equip_innocent_scroll.webp'
import a122 from '../items/pet_equip_magic_scroll.webp'
import a123 from '../items/pet_equip_pure_white_scroll.webp'
import a124 from '../items/pet_equip_return_scroll.webp'
import a125 from '../items/potential_reset.png'
import a126 from '../items/premium_accessory_attack_scroll.webp'
import a127 from '../items/premium_accessory_magic_scroll.webp'
import a128 from '../items/premium_accessory_scroll_coupon.png'
import a129 from '../items/premium_pet_equip_attack_scroll.webp'
import a130 from '../items/premium_pet_equip_magic_scroll.webp'
import a131 from '../items/premium_petequip_scroll_coupon.png'
import a132 from '../items/return_scroll.webp'
import a133 from '../items/scroll_10_percent.webp'
import a134 from '../items/seiram_elixir.webp'
import a135 from '../items/sol_erda_fragment.webp'
import a136 from '../items/sole_10.png'
import a137 from '../items/sole_1000.webp'
import a138 from '../items/sole_200.png'
import a139 from '../items/sole_500.webp'
import a140 from '../items/soul_ether_1.webp'
import a141 from '../items/soul_ether_2.webp'
import a142 from '../items/soul_ether_3.webp'
import a143 from '../items/soul_ether_4.webp'
import a144 from '../items/spell_trace.webp'
import a145 from '../items/union_wealth.webp'
import a146 from '../items/vip_sauna_ticket.webp'
import a147 from '../items/wealth_acquisition_potion.webp'
import a148 from '../items/wealth_acquisition_potion_small.webp'
import a149 from '../items/whetstone_faith.png'
import a150 from '../items/whetstone_life.png'

export const ITEM_ASSETS: Record<string, ImageAssetRef> = {
  "Berserker_Ring.png": a0,
  "Clean_Defense_Ring.png": a1,
  "Clean_Stance_Ring.png": a2,
  "Cleansing_Ring.png": a3,
  "Continuous_Ring.webp": a4,
  "Crisis_HM_Ring.webp": a5,
  "Crisis_H_Ring.webp": a6,
  "Crisis_M_Ring.png": a7,
  "Critical_Damage_Ring.webp": a8,
  "Critical_Defense_Ring.png": a9,
  "Critical_Shift_Ring.png": a10,
  "Durability_Ring.png": a11,
  "Health_Cut_Ring.png": a12,
  "Level_Jump_Ring.png": a13,
  "Limit_Ring.webp": a14,
  "Mana_Cut_Ring.png": a15,
  "Overdrive_Ring.png": a16,
  "Reflective_Ring.png": a17,
  "Ring_of_Restraint.webp": a18,
  "Risk_Taker_Ring.webp": a19,
  "Stance_Shift_Ring.png": a20,
  "Swift_Ring.png": a21,
  "Totalling_Ring.webp": a22,
  "Tower_Boost_Ring.png": a23,
  "Ultimatum_Ring.webp": a24,
  "Weapon_Jump_Ring.webp": a25,
  "additional_cube.webp": a26,
  "additional_potential_reset.png": a27,
  "adversary_resolve.webp": a28,
  "adversary_resolve_piece.webp": a29,
  "alleria_elixir.webp": a30,
  "amazing_positive_chaos_scroll.webp": a31,
  "arcane_river_spiegelmann.webp": a32,
  "black_circulator.webp": a33,
  "black_cube.webp": a34,
  "blueberry_farm_ticket.webp": a35,
  "boss_ring_box_black.png": a36,
  "boss_ring_box_green.png": a37,
  "boss_ring_box_life.png": a38,
  "boss_ring_box_red.png": a39,
  "boss_ring_box_white.png": a40,
  "box_eternel_adversary.png": a41,
  "box_eternel_bardrix.png": a42,
  "box_eternel_bellona.webp": a43,
  "box_eternel_destiny.webp": a44,
  "box_eternel_jupiter.png": a45,
  "box_eternel_kaling.png": a46,
  "box_eternel_kalos.png": a47,
  "box_eternel_limbo.png": a48,
  "box_eternel_maerin.webp": a49,
  "box_eternel_maleficStar.png": a50,
  "box_solerda_maerin_high.webp": a51,
  "bright_boss_eye_acc.webp": a52,
  "bright_boss_face_acc.png": a53,
  "bright_boss_merit.png": a54,
  "bright_boss_pendant.png": a55,
  "bright_boss_ring.png": a56,
  "bright_boss_ring2.png": a57,
  "cerzar.webp": a58,
  "collector_elixir.webp": a59,
  "core_gemstone_mirror.png": a60,
  "core_gemstone_mitra.png": a61,
  "cube_bronze_additional.png": a62,
  "cube_gold.png": a63,
  "cube_silver.png": a64,
  "dark_boss_badge.png": a65,
  "dark_boss_belt.png": a66,
  "dark_boss_box.png": a67,
  "dark_boss_box_maerin.webp": a68,
  "dark_boss_complete_heart.png": a69,
  "dark_boss_earring.png": a70,
  "dark_boss_emblem.png": a71,
  "dark_boss_eye_acc.png": a72,
  "dark_boss_face_acc.png": a73,
  "dark_boss_pendant.png": a74,
  "dark_boss_pocket.png": a75,
  "dark_boss_ring.png": a76,
  "dawn_boss_earring.png": a77,
  "dawn_boss_face_acc.png": a78,
  "dawn_boss_pendant.png": a79,
  "dawn_boss_ring.png": a80,
  "equipment_enhancement_scroll.png": a81,
  "erion_piece.png": a82,
  "except_belt.png": a83,
  "except_earring.png": a84,
  "except_eye_acc.png": a85,
  "except_face_acc.png": a86,
  "except_merit.png": a87,
  "frag_destiny.webp": a88,
  "frag_eternel_bardrix.png": a89,
  "frag_eternel_bellona.webp": a90,
  "frag_eternel_jupiter.png": a91,
  "frag_eternel_limbo.png": a92,
  "grandis_spiegelmann.webp": a93,
  "honor_elixir.webp": a94,
  "intense_power_crystal_monthly.webp": a95,
  "intense_power_crystal_weekly.webp": a96,
  "kaling_link.webp": a97,
  "kaling_link_piece.webp": a98,
  "kalos_will.webp": a99,
  "kalos_will_piece.webp": a100,
  "karma_amazing_positive_chaos_scroll.webp": a101,
  "karma_premium_accessory_attack_scroll.webp": a102,
  "karma_premium_accessory_magic_scroll.webp": a103,
  "karma_premium_pet_equip_attack_scroll.webp": a104,
  "karma_premium_pet_equip_magic_scroll.webp": a105,
  "luminous_moonshine_potion.png": a106,
  "magical_onehand_attack_scroll.webp": a107,
  "magical_onehand_magic_scroll.webp": a108,
  "magical_twohand_attack_scroll.webp": a109,
  "magical_weapon_scroll_coupon.png": a110,
  "maleficstar_shard.webp": a111,
  "maleficstar_shard_piece.webp": a112,
  "mechaberry_farm_ticket.webp": a113,
  "meso.webp": a114,
  "meso_pouch.webp": a115,
  "mihoroid.webp": a116,
  "monster_park_ticket.webp": a117,
  "npc_mr_newname.webp": a118,
  "papulatus_mark.png": a119,
  "pet_equip_attack_scroll.webp": a120,
  "pet_equip_innocent_scroll.webp": a121,
  "pet_equip_magic_scroll.webp": a122,
  "pet_equip_pure_white_scroll.webp": a123,
  "pet_equip_return_scroll.webp": a124,
  "potential_reset.png": a125,
  "premium_accessory_attack_scroll.webp": a126,
  "premium_accessory_magic_scroll.webp": a127,
  "premium_accessory_scroll_coupon.png": a128,
  "premium_pet_equip_attack_scroll.webp": a129,
  "premium_pet_equip_magic_scroll.webp": a130,
  "premium_petequip_scroll_coupon.png": a131,
  "return_scroll.webp": a132,
  "scroll_10_percent.webp": a133,
  "seiram_elixir.webp": a134,
  "sol_erda_fragment.webp": a135,
  "sole_10.png": a136,
  "sole_1000.webp": a137,
  "sole_200.png": a138,
  "sole_500.webp": a139,
  "soul_ether_1.webp": a140,
  "soul_ether_2.webp": a141,
  "soul_ether_3.webp": a142,
  "soul_ether_4.webp": a143,
  "spell_trace.webp": a144,
  "union_wealth.webp": a145,
  "vip_sauna_ticket.webp": a146,
  "wealth_acquisition_potion.webp": a147,
  "wealth_acquisition_potion_small.webp": a148,
  "whetstone_faith.png": a149,
  "whetstone_life.png": a150,
}
