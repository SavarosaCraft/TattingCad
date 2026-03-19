# TattingCAD — Translation Reference
*Use this document when translating the app into any language.*
*It captures craft-specific vocabulary decisions so they stay consistent across sessions and languages.*

---

## Core Craft Vocabulary

| English | Hungarian | Notes |
|---|---|---|
| Tatting | Hajócsipke | |
| Picot | picó | Kept as loanword |
| Chain | ív | |
| Ring | gyűrű | |
| Stitch | csomó | Generic stitch |
| Double stitch / DS | dupla csomó | Keep "DS" abbreviation as-is in notation |
| Single stitch / SS | csomó | Just "csomó" — no "egyes" prefix |
| Thread | fonal | |
| Split | osztott | e.g. split ring = osztott gyűrű |
| Split ring | osztott gyűrű | |
| Split chain | osztott ív | |
| Join / Join picot | összekötő / összekötő picó | |
| Reverse work (RW) | munka megfordítása | |
| Round (Round 1, Round 2) | sor | Not "kör" — tatters use "sor" |
| Notation | minta | Same word as "pattern" — both are "minta" |
| Pattern | minta | Same word as "notation" — both are "minta" |
| Bead | gyöngy | |
| Material | anyag | |
| Guide picot | illesztő picó | |

## Picot Sizes

| English | Hungarian |
|---|---|
| Small picot | kicsi picó |
| Medium picot | közepes picó |
| Large / Long picot | hosszú picó |

Note: "hosszú" (long) preferred over "nagy" (large/big) — picots are measured by length.

## UI / App Vocabulary

| English | Hungarian | Notes |
|---|---|---|
| Schematic (render mode) | alaprajz | |
| Realistic (render mode) | valóságos | |
| Snap (grid snapping) | illesztés | |
| Ungrouped | Csoportosítatlan | |
| Round N (order groups) | N. sor | e.g. "Round 1" = "1. sor" |

## Notation Tokens — Keep in English

The following are kept as-is in all languages (they appear in the notation field and pattern output):

`DS`, `SS`, `RDS`, `LSS`, `RSS`, `jp`, `jpg`, `bjp`, `gjp`, `gp`, `p`, `sp`, `lp`, `bp`, `bc`, `bcp`, `bcjp`, `be`, `r`, `c`, `sc`, `sr`, `ch`, `RW`

These are tatting shorthand that the international tatting community uses regardless of language.

## General Translation Notes

- **Abbreviations in output:** DS, RW, SR, SC etc. stay in English in pattern output — these are universal tatting shorthand
- **UI button labels:** translate fully
- **Error messages:** translate fully
- **Placeholder text:** translate (e.g. "Group name…" → "Csoport neve…")
- **Tooltip text:** translate

---

## Languages Completed

| Language | File | Keys | Status |
|---|---|---|---|
| English | `translations_en.json` | 492 | ✅ Complete |
| Hungarian | `translations_hu.json` | 492 | ✅ Complete (session 30) |

---

*Add new language sections above as translations are completed.*
*Update the Languages Completed table with each new translation.*

---

## Spanish (Español) Terminology

*Source: Frivolite - Encaje de Lanzadera (craftree image reference)*

| English | Spanish | Notes |
|---|---|---|
| Tatting | Frivolité | French loanword, same as Hungarian |
| Chain | Arco | "Cadena" also exists but "Arco" chosen — matches Hungarian "ív" (arc) |
| Ring | Anillo | |
| Close (ring) | Cerrar | |
| Double Stitch / DS | Punto Doble | Keep "DS" in notation |
| First Half Stitch | Nudo Izquierdo | |
| Second Half Stitch | Nudo Derecho | |
| Stitch | Punto | |
| Picot | Picot | Kept as loanword — "Baquilla" also exists but Picot is more universal |
| Join | Unir | "Enganchar" also valid |
| Reverse Work (RW) | Vuelta a la labor | Keep "RW" in notation |
| Split | Dividido/a | |
| Split Ring | Anillo Dividido | |
| Split Chain | Arco Dividido | |
| Thread | Hilo | |
| Shuttle | Lanzadera | |
| Switch Shuttles | Intercambiar lanzaderas | |
| Shoelace Trick | Amarre de Zapato | |
| Josephine Knot | Nudo Josefina | |
| Needle | Aguja | |
| Bead | Cuenta | "Abalorio" also valid but "Cuenta" more common in craft context |
| Material | Material | |
| Pattern / Notation | Patrón | Same word for both, like Hungarian "minta" |
| Round (Round 1, Round 2) | Vuelta | Note: "Vuelta a la labor" = Reverse Work — context makes it clear |
| Schematic | Esquemático | |
| Realistic | Realista | |
| Snap (grid) | Ajuste | |
| Guide picot | Picot guía | |
| Small picot | Picot pequeño | |
| Medium picot | Picot mediano | |
| Long picot | Picot largo | |
| Join picot | Picot de unión | |

## Notation Tokens — Keep in English (Spanish same as all languages)

`DS`, `SS`, `RDS`, `LSS`, `RSS`, `jp`, `jpg`, `bjp`, `gjp`, `gp`, `p`, `sp`, `lp`, `bp`, `bc`, `bcp`, `bcjp`, `be`, `r`, `c`, `sc`, `sr`, `ch`, `RW`


---

## Japanese (日本語) Terminology Notes

*Source: Tatting Glossary Japanese/English (craftree reference image)*  
*Note: Full translation not yet done — craft vocabulary reference only*

### Key observation: Two parallel forms
Japanese has two accepted forms for "tatting" — the common form and a variant:

| Concept | Common form | Variant form |
|---|---|---|
| Tatting (prefix) | タティング (Ta-Te-i-N-Gu) | タッチング (Ta-t-Chi-N-Gu) |
| Tatting (noun) | タティングレース | タッチングレース |
| Tatting shuttle | タティングシャトル | タッチングシャトル |

**Recommendation:** Use the common form (タティング) throughout the app for consistency.

### Craft terms from glossary

| English | Japanese | Pronunciation |
|---|---|---|
| Tatting | タティング | Ta-Te-i-N-Gu |
| Tatting hook (Takashima) | たかちま タッチング針 | Ta-Ka-Shi-Ma Ta-t-Chi-N-Gu |
| Shuttle | シャトル | Shi-ya-To-Ru |
| Split Ring | スプリットリング | Su-Pu-Ri-i-To-Ri-N-Gu |
| Josephine Knot | ジョゼフィンノット | Jji-yo-Ze-Fu-i-N-No-o-To |
| Edging | エジング | E-Ji-N-Gu |
| Shawl | ショール | Shi-yo-o-Ru |

### Terms needing research before translation
The glossary above covers only a subset. These common app terms will need verification from a Japanese tatter or tatting resource:

- Ring → 輪 (wa) or リング (ringu)?
- Chain → チェーン (chēn) or specific tatting term?
- Picot → ピコ (piko) — likely used as loanword
- Double Stitch / DS → ダブルステッチ or Japanese equivalent?
- Join → 繋ぎ (tsunagi)?
- Reverse Work → 裏返し (uraganeshi)?
- Round (order groups) → 段 (dan) or 周 (shū)?

### Status
- [ ] Full Japanese translation pending — needs native speaker with tatting knowledge
- [ ] Craft term research needed for Ring, Chain, Picot, DS, Join, RW, Round

