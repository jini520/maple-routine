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
import a33 from '../items/arcane_symbol_arcana.webp'
import a34 from '../items/arcane_symbol_chew_chew.webp'
import a35 from '../items/arcane_symbol_esfera.webp'
import a36 from '../items/arcane_symbol_lacheln.webp'
import a37 from '../items/arcane_symbol_morass.webp'
import a38 from '../items/arcane_symbol_road_of_vanishing.webp'
import a39 from '../items/arcane_symbol_selection_coupon.webp'
import a40 from '../items/authentic_symbol_arcs.webp'
import a41 from '../items/authentic_symbol_arteria.webp'
import a42 from '../items/authentic_symbol_carcion.webp'
import a43 from '../items/authentic_symbol_cernium.webp'
import a44 from '../items/authentic_symbol_dowonkyung.webp'
import a45 from '../items/authentic_symbol_odium.webp'
import a46 from '../items/authentic_symbol_selection_coupon.webp'
import a47 from '../items/black_circulator.webp'
import a48 from '../items/black_cube.webp'
import a49 from '../items/blueberry_farm_ticket.webp'
import a50 from '../items/boss_ring_box_black.png'
import a51 from '../items/boss_ring_box_green.png'
import a52 from '../items/boss_ring_box_life.png'
import a53 from '../items/boss_ring_box_red.png'
import a54 from '../items/boss_ring_box_white.png'
import a55 from '../items/box_eternel_adversary.png'
import a56 from '../items/box_eternel_bardrix.png'
import a57 from '../items/box_eternel_bellona.webp'
import a58 from '../items/box_eternel_destiny.webp'
import a59 from '../items/box_eternel_jupiter.png'
import a60 from '../items/box_eternel_kaling.png'
import a61 from '../items/box_eternel_kalos.png'
import a62 from '../items/box_eternel_limbo.png'
import a63 from '../items/box_eternel_maerin.webp'
import a64 from '../items/box_eternel_maleficStar.png'
import a65 from '../items/box_solerda_maerin_high.webp'
import a66 from '../items/bright_boss_eye_acc.webp'
import a67 from '../items/bright_boss_face_acc.png'
import a68 from '../items/bright_boss_merit.png'
import a69 from '../items/bright_boss_pendant.png'
import a70 from '../items/bright_boss_ring.png'
import a71 from '../items/bright_boss_ring2.png'
import a72 from '../items/cerzar.webp'
import a73 from '../items/collector_elixir.webp'
import a74 from '../items/core_gemstone_mirror.png'
import a75 from '../items/core_gemstone_mitra.png'
import a76 from '../items/cube_bronze_additional.png'
import a77 from '../items/cube_gold.png'
import a78 from '../items/cube_silver.png'
import a79 from '../items/dark_boss_badge.png'
import a80 from '../items/dark_boss_belt.png'
import a81 from '../items/dark_boss_box.png'
import a82 from '../items/dark_boss_box_maerin.webp'
import a83 from '../items/dark_boss_complete_heart.png'
import a84 from '../items/dark_boss_earring.png'
import a85 from '../items/dark_boss_emblem.png'
import a86 from '../items/dark_boss_eye_acc.png'
import a87 from '../items/dark_boss_face_acc.png'
import a88 from '../items/dark_boss_pendant.png'
import a89 from '../items/dark_boss_pocket.png'
import a90 from '../items/dark_boss_ring.png'
import a91 from '../items/dawn_boss_earring.png'
import a92 from '../items/dawn_boss_face_acc.png'
import a93 from '../items/dawn_boss_pendant.png'
import a94 from '../items/dawn_boss_ring.png'
import a95 from '../items/equipment_enhancement_scroll.png'
import a96 from '../items/erion_piece.png'
import a97 from '../items/except_belt.png'
import a98 from '../items/except_earring.png'
import a99 from '../items/except_eye_acc.png'
import a100 from '../items/except_face_acc.png'
import a101 from '../items/except_merit.png'
import a102 from '../items/frag_destiny.webp'
import a103 from '../items/frag_eternel_bardrix.png'
import a104 from '../items/frag_eternel_bellona.webp'
import a105 from '../items/frag_eternel_jupiter.png'
import a106 from '../items/frag_eternel_limbo.png'
import a107 from '../items/grand_authentic_symbol_geardrak.webp'
import a108 from '../items/grand_authentic_symbol_tallahart.webp'
import a109 from '../items/grandis_spiegelmann.webp'
import a110 from '../items/honor_elixir.webp'
import a111 from '../items/intense_power_crystal_monthly.webp'
import a112 from '../items/intense_power_crystal_weekly.webp'
import a113 from '../items/kaling_link.webp'
import a114 from '../items/kaling_link_piece.webp'
import a115 from '../items/kalos_will.webp'
import a116 from '../items/kalos_will_piece.webp'
import a117 from '../items/karma_amazing_positive_chaos_scroll.webp'
import a118 from '../items/karma_premium_accessory_attack_scroll.webp'
import a119 from '../items/karma_premium_accessory_magic_scroll.webp'
import a120 from '../items/karma_premium_pet_equip_attack_scroll.webp'
import a121 from '../items/karma_premium_pet_equip_magic_scroll.webp'
import a122 from '../items/luminous_moonshine_potion.png'
import a123 from '../items/magical_onehand_attack_scroll.webp'
import a124 from '../items/magical_onehand_magic_scroll.webp'
import a125 from '../items/magical_twohand_attack_scroll.webp'
import a126 from '../items/magical_weapon_scroll_coupon.png'
import a127 from '../items/maleficstar_shard.webp'
import a128 from '../items/maleficstar_shard_piece.webp'
import a129 from '../items/mechaberry_farm_ticket.webp'
import a130 from '../items/meso.webp'
import a131 from '../items/meso_pouch.webp'
import a132 from '../items/mihoroid.webp'
import a133 from '../items/monster_park_ticket.webp'
import a134 from '../items/npc_mr_newname.webp'
import a135 from '../items/papulatus_mark.png'
import a136 from '../items/pet_equip_attack_scroll.webp'
import a137 from '../items/pet_equip_innocent_scroll.webp'
import a138 from '../items/pet_equip_magic_scroll.webp'
import a139 from '../items/pet_equip_pure_white_scroll.webp'
import a140 from '../items/pet_equip_return_scroll.webp'
import a141 from '../items/potential_reset.png'
import a142 from '../items/premium_accessory_attack_scroll.webp'
import a143 from '../items/premium_accessory_magic_scroll.webp'
import a144 from '../items/premium_accessory_scroll_coupon.png'
import a145 from '../items/premium_pet_equip_attack_scroll.webp'
import a146 from '../items/premium_pet_equip_magic_scroll.webp'
import a147 from '../items/premium_petequip_scroll_coupon.png'
import a148 from '../items/return_scroll.webp'
import a149 from '../items/scroll_10_percent.webp'
import a150 from '../items/seiram_elixir.webp'
import a151 from '../items/selazar_coin.webp'
import a152 from '../items/sol_erda_fragment.webp'
import a153 from '../items/sole_10.png'
import a154 from '../items/sole_1000.webp'
import a155 from '../items/sole_200.png'
import a156 from '../items/sole_500.webp'
import a157 from '../items/soul_ether_1.webp'
import a158 from '../items/soul_ether_2.webp'
import a159 from '../items/soul_ether_3.webp'
import a160 from '../items/soul_ether_4.webp'
import a161 from '../items/soul_weapon_potential.webp'
import a162 from '../items/spell_trace.webp'
import a163 from '../items/union_wealth.webp'
import a164 from '../items/vip_sauna_ticket.webp'
import a165 from '../items/wealth_acquisition_potion.webp'
import a166 from '../items/wealth_acquisition_potion_small.webp'
import a167 from '../items/whetstone_faith.png'
import a168 from '../items/whetstone_life.png'

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
  "arcane_symbol_arcana.webp": a33,
  "arcane_symbol_chew_chew.webp": a34,
  "arcane_symbol_esfera.webp": a35,
  "arcane_symbol_lacheln.webp": a36,
  "arcane_symbol_morass.webp": a37,
  "arcane_symbol_road_of_vanishing.webp": a38,
  "arcane_symbol_selection_coupon.webp": a39,
  "authentic_symbol_arcs.webp": a40,
  "authentic_symbol_arteria.webp": a41,
  "authentic_symbol_carcion.webp": a42,
  "authentic_symbol_cernium.webp": a43,
  "authentic_symbol_dowonkyung.webp": a44,
  "authentic_symbol_odium.webp": a45,
  "authentic_symbol_selection_coupon.webp": a46,
  "black_circulator.webp": a47,
  "black_cube.webp": a48,
  "blueberry_farm_ticket.webp": a49,
  "boss_ring_box_black.png": a50,
  "boss_ring_box_green.png": a51,
  "boss_ring_box_life.png": a52,
  "boss_ring_box_red.png": a53,
  "boss_ring_box_white.png": a54,
  "box_eternel_adversary.png": a55,
  "box_eternel_bardrix.png": a56,
  "box_eternel_bellona.webp": a57,
  "box_eternel_destiny.webp": a58,
  "box_eternel_jupiter.png": a59,
  "box_eternel_kaling.png": a60,
  "box_eternel_kalos.png": a61,
  "box_eternel_limbo.png": a62,
  "box_eternel_maerin.webp": a63,
  "box_eternel_maleficStar.png": a64,
  "box_solerda_maerin_high.webp": a65,
  "bright_boss_eye_acc.webp": a66,
  "bright_boss_face_acc.png": a67,
  "bright_boss_merit.png": a68,
  "bright_boss_pendant.png": a69,
  "bright_boss_ring.png": a70,
  "bright_boss_ring2.png": a71,
  "cerzar.webp": a72,
  "collector_elixir.webp": a73,
  "core_gemstone_mirror.png": a74,
  "core_gemstone_mitra.png": a75,
  "cube_bronze_additional.png": a76,
  "cube_gold.png": a77,
  "cube_silver.png": a78,
  "dark_boss_badge.png": a79,
  "dark_boss_belt.png": a80,
  "dark_boss_box.png": a81,
  "dark_boss_box_maerin.webp": a82,
  "dark_boss_complete_heart.png": a83,
  "dark_boss_earring.png": a84,
  "dark_boss_emblem.png": a85,
  "dark_boss_eye_acc.png": a86,
  "dark_boss_face_acc.png": a87,
  "dark_boss_pendant.png": a88,
  "dark_boss_pocket.png": a89,
  "dark_boss_ring.png": a90,
  "dawn_boss_earring.png": a91,
  "dawn_boss_face_acc.png": a92,
  "dawn_boss_pendant.png": a93,
  "dawn_boss_ring.png": a94,
  "equipment_enhancement_scroll.png": a95,
  "erion_piece.png": a96,
  "except_belt.png": a97,
  "except_earring.png": a98,
  "except_eye_acc.png": a99,
  "except_face_acc.png": a100,
  "except_merit.png": a101,
  "frag_destiny.webp": a102,
  "frag_eternel_bardrix.png": a103,
  "frag_eternel_bellona.webp": a104,
  "frag_eternel_jupiter.png": a105,
  "frag_eternel_limbo.png": a106,
  "grand_authentic_symbol_geardrak.webp": a107,
  "grand_authentic_symbol_tallahart.webp": a108,
  "grandis_spiegelmann.webp": a109,
  "honor_elixir.webp": a110,
  "intense_power_crystal_monthly.webp": a111,
  "intense_power_crystal_weekly.webp": a112,
  "kaling_link.webp": a113,
  "kaling_link_piece.webp": a114,
  "kalos_will.webp": a115,
  "kalos_will_piece.webp": a116,
  "karma_amazing_positive_chaos_scroll.webp": a117,
  "karma_premium_accessory_attack_scroll.webp": a118,
  "karma_premium_accessory_magic_scroll.webp": a119,
  "karma_premium_pet_equip_attack_scroll.webp": a120,
  "karma_premium_pet_equip_magic_scroll.webp": a121,
  "luminous_moonshine_potion.png": a122,
  "magical_onehand_attack_scroll.webp": a123,
  "magical_onehand_magic_scroll.webp": a124,
  "magical_twohand_attack_scroll.webp": a125,
  "magical_weapon_scroll_coupon.png": a126,
  "maleficstar_shard.webp": a127,
  "maleficstar_shard_piece.webp": a128,
  "mechaberry_farm_ticket.webp": a129,
  "meso.webp": a130,
  "meso_pouch.webp": a131,
  "mihoroid.webp": a132,
  "monster_park_ticket.webp": a133,
  "npc_mr_newname.webp": a134,
  "papulatus_mark.png": a135,
  "pet_equip_attack_scroll.webp": a136,
  "pet_equip_innocent_scroll.webp": a137,
  "pet_equip_magic_scroll.webp": a138,
  "pet_equip_pure_white_scroll.webp": a139,
  "pet_equip_return_scroll.webp": a140,
  "potential_reset.png": a141,
  "premium_accessory_attack_scroll.webp": a142,
  "premium_accessory_magic_scroll.webp": a143,
  "premium_accessory_scroll_coupon.png": a144,
  "premium_pet_equip_attack_scroll.webp": a145,
  "premium_pet_equip_magic_scroll.webp": a146,
  "premium_petequip_scroll_coupon.png": a147,
  "return_scroll.webp": a148,
  "scroll_10_percent.webp": a149,
  "seiram_elixir.webp": a150,
  "selazar_coin.webp": a151,
  "sol_erda_fragment.webp": a152,
  "sole_10.png": a153,
  "sole_1000.webp": a154,
  "sole_200.png": a155,
  "sole_500.webp": a156,
  "soul_ether_1.webp": a157,
  "soul_ether_2.webp": a158,
  "soul_ether_3.webp": a159,
  "soul_ether_4.webp": a160,
  "soul_weapon_potential.webp": a161,
  "spell_trace.webp": a162,
  "union_wealth.webp": a163,
  "vip_sauna_ticket.webp": a164,
  "wealth_acquisition_potion.webp": a165,
  "wealth_acquisition_potion_small.webp": a166,
  "whetstone_faith.png": a167,
  "whetstone_life.png": a168,
}
