// ⚠️ 이 파일은 생성물이다 — **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
//
// 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs · [[ADR-129]])
// 무엇: 아이템·반지 아이콘 — `lib/item-icons.ts` 가 `iconFile`(확장자 포함)로 찾는다([[ADR-011]] 결정 6)
// 원본: src/assets/items/*.{png,webp} · src/assets/items/rings/*.{png,webp}
//
// 값의 타입은 번들러가 정한다 — 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.

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
import a26 from '../items/adversary_resolve.webp'
import a27 from '../items/adversary_resolve_piece.webp'
import a28 from '../items/boss_ring_box_black.png'
import a29 from '../items/boss_ring_box_green.png'
import a30 from '../items/boss_ring_box_life.png'
import a31 from '../items/boss_ring_box_red.png'
import a32 from '../items/boss_ring_box_white.png'
import a33 from '../items/box_eternel_adversary.png'
import a34 from '../items/box_eternel_bardrix.png'
import a35 from '../items/box_eternel_bellona.webp'
import a36 from '../items/box_eternel_destiny.webp'
import a37 from '../items/box_eternel_jupiter.png'
import a38 from '../items/box_eternel_kaling.png'
import a39 from '../items/box_eternel_kalos.png'
import a40 from '../items/box_eternel_limbo.png'
import a41 from '../items/box_eternel_maerin.webp'
import a42 from '../items/box_eternel_maleficStar.png'
import a43 from '../items/box_solerda_maerin_high.webp'
import a44 from '../items/bright_boss_eye_acc.webp'
import a45 from '../items/bright_boss_face_acc.png'
import a46 from '../items/bright_boss_merit.png'
import a47 from '../items/bright_boss_pendant.png'
import a48 from '../items/bright_boss_ring.png'
import a49 from '../items/bright_boss_ring2.png'
import a50 from '../items/core_gemstone_mirror.png'
import a51 from '../items/core_gemstone_mitra.png'
import a52 from '../items/cube_bronze_additional.png'
import a53 from '../items/cube_gold.png'
import a54 from '../items/cube_silver.png'
import a55 from '../items/dark_boss_badge.png'
import a56 from '../items/dark_boss_belt.png'
import a57 from '../items/dark_boss_box.png'
import a58 from '../items/dark_boss_box_maerin.webp'
import a59 from '../items/dark_boss_complete_heart.png'
import a60 from '../items/dark_boss_earring.png'
import a61 from '../items/dark_boss_emblem.png'
import a62 from '../items/dark_boss_eye_acc.png'
import a63 from '../items/dark_boss_face_acc.png'
import a64 from '../items/dark_boss_pendant.png'
import a65 from '../items/dark_boss_pocket.png'
import a66 from '../items/dark_boss_ring.png'
import a67 from '../items/dawn_boss_earring.png'
import a68 from '../items/dawn_boss_face_acc.png'
import a69 from '../items/dawn_boss_pendant.png'
import a70 from '../items/dawn_boss_ring.png'
import a71 from '../items/erion_piece.png'
import a72 from '../items/except_belt.png'
import a73 from '../items/except_earring.png'
import a74 from '../items/except_eye_acc.png'
import a75 from '../items/except_face_acc.png'
import a76 from '../items/except_merit.png'
import a77 from '../items/frag_destiny.webp'
import a78 from '../items/frag_eternel_bardrix.png'
import a79 from '../items/frag_eternel_bellona.webp'
import a80 from '../items/frag_eternel_jupiter.png'
import a81 from '../items/frag_eternel_limbo.png'
import a82 from '../items/intense_power_crystal_monthly.webp'
import a83 from '../items/intense_power_crystal_weekly.webp'
import a84 from '../items/kaling_link.webp'
import a85 from '../items/kaling_link_piece.webp'
import a86 from '../items/kalos_will.webp'
import a87 from '../items/kalos_will_piece.webp'
import a88 from '../items/luminous_moonshine_potion.png'
import a89 from '../items/magical_weapon_scroll_coupon.png'
import a90 from '../items/maleficstar_shard.webp'
import a91 from '../items/maleficstar_shard_piece.webp'
import a92 from '../items/papulatus_mark.png'
import a93 from '../items/premium_accessory_scroll_coupon.png'
import a94 from '../items/premium_petequip_scroll_coupon.png'
import a95 from '../items/sole_10.png'
import a96 from '../items/sole_1000.webp'
import a97 from '../items/sole_200.png'
import a98 from '../items/sole_500.webp'
import a99 from '../items/spell_trace.webp'
import a100 from '../items/whetstone_faith.png'
import a101 from '../items/whetstone_life.png'

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
  "adversary_resolve.webp": a26,
  "adversary_resolve_piece.webp": a27,
  "boss_ring_box_black.png": a28,
  "boss_ring_box_green.png": a29,
  "boss_ring_box_life.png": a30,
  "boss_ring_box_red.png": a31,
  "boss_ring_box_white.png": a32,
  "box_eternel_adversary.png": a33,
  "box_eternel_bardrix.png": a34,
  "box_eternel_bellona.webp": a35,
  "box_eternel_destiny.webp": a36,
  "box_eternel_jupiter.png": a37,
  "box_eternel_kaling.png": a38,
  "box_eternel_kalos.png": a39,
  "box_eternel_limbo.png": a40,
  "box_eternel_maerin.webp": a41,
  "box_eternel_maleficStar.png": a42,
  "box_solerda_maerin_high.webp": a43,
  "bright_boss_eye_acc.webp": a44,
  "bright_boss_face_acc.png": a45,
  "bright_boss_merit.png": a46,
  "bright_boss_pendant.png": a47,
  "bright_boss_ring.png": a48,
  "bright_boss_ring2.png": a49,
  "core_gemstone_mirror.png": a50,
  "core_gemstone_mitra.png": a51,
  "cube_bronze_additional.png": a52,
  "cube_gold.png": a53,
  "cube_silver.png": a54,
  "dark_boss_badge.png": a55,
  "dark_boss_belt.png": a56,
  "dark_boss_box.png": a57,
  "dark_boss_box_maerin.webp": a58,
  "dark_boss_complete_heart.png": a59,
  "dark_boss_earring.png": a60,
  "dark_boss_emblem.png": a61,
  "dark_boss_eye_acc.png": a62,
  "dark_boss_face_acc.png": a63,
  "dark_boss_pendant.png": a64,
  "dark_boss_pocket.png": a65,
  "dark_boss_ring.png": a66,
  "dawn_boss_earring.png": a67,
  "dawn_boss_face_acc.png": a68,
  "dawn_boss_pendant.png": a69,
  "dawn_boss_ring.png": a70,
  "erion_piece.png": a71,
  "except_belt.png": a72,
  "except_earring.png": a73,
  "except_eye_acc.png": a74,
  "except_face_acc.png": a75,
  "except_merit.png": a76,
  "frag_destiny.webp": a77,
  "frag_eternel_bardrix.png": a78,
  "frag_eternel_bellona.webp": a79,
  "frag_eternel_jupiter.png": a80,
  "frag_eternel_limbo.png": a81,
  "intense_power_crystal_monthly.webp": a82,
  "intense_power_crystal_weekly.webp": a83,
  "kaling_link.webp": a84,
  "kaling_link_piece.webp": a85,
  "kalos_will.webp": a86,
  "kalos_will_piece.webp": a87,
  "luminous_moonshine_potion.png": a88,
  "magical_weapon_scroll_coupon.png": a89,
  "maleficstar_shard.webp": a90,
  "maleficstar_shard_piece.webp": a91,
  "papulatus_mark.png": a92,
  "premium_accessory_scroll_coupon.png": a93,
  "premium_petequip_scroll_coupon.png": a94,
  "sole_10.png": a95,
  "sole_1000.webp": a96,
  "sole_200.png": a97,
  "sole_500.webp": a98,
  "spell_trace.webp": a99,
  "whetstone_faith.png": a100,
  "whetstone_life.png": a101,
}
