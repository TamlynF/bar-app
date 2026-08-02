# Event List Redesign - Design Spec / Token Sheet

Exact values from the approved prototype (`Event List.html` / `styles.css`).
Attach this alongside the Claude Code handoff prompt. Mobile canvas: **390 × 844** (iPhone 12 Pro).

---

## 1. Core color tokens
| Token | Hex | Use |
|---|---|---|
| cream (canvas) | `#F7F4EA` | page / sheet background |
| card | `#FFFFFF` | rows, cards |
| ink | `#1F1F1A` | primary text |
| muted | `#5F624F` | labels, secondary text |
| line | `#E6DFC8` | borders |
| line-2 | `#EFEAD9` | inner dividers |
| espresso (primary) | `#5C4033` | primary actions, default accent |
| gold | `#FDCC4B` | accent option |
| neon | `#FF6B35` | urgency ("Tonight"), eyebrows |

## 2. Category colors (per event subtype)
Keyed off `subtype.color` → map to: `{ ink, hot, bg, soft, line }`.
| Category | ink | hot | bg | soft | line |
|---|---|---|---|---|---|
| Bingo | `#C2410C` | `#DC2626` | `#FCE7E4` | `#FBEDEA` | `#F3C9C0` |
| Quiz | `#7E22CE` | `#9333EA` | `#F3E8FF` | `#F6EEFE` | `#E2C9F5` |
| Football | `#15803D` | `#16A34A` | `#DCFCE7` | `#E6FBEC` | `#BBE9C9` |
| Music | `#1D4ED8` | `#2563EB` | `#DBEAFE` | `#E6F0FE` | `#C2D8F7` |
| Party | `#C2410C` | `#EA580C` | `#FFEDD5` | `#FEF1E0` | `#F7D4AE` |
| Birthday | `#BE185D` | `#DB2777` | `#FCE7F3` | `#FCEEF5` | `#F5C9DF` |

Usage: `hot` = spine / dot / selected chip fill; `bg` = tag + date-badge fill; `soft` = inactive chip fill; `ink` = tag text; `line` = badge border.

## 3. Status colors
| Status | fg | bg | line |
|---|---|---|---|
| Tonight (today) | `#FFFFFF` on `#FF6B35` | - | - |
| Full | `#B91C1C` | `#FEE2E2` | - |
| Inactive | `#6B7280` | `#F3F4F6` | - |
| Confirmed | `#15803D` | `#DCFCE7` | `#BBE9C9` |
| Waitlisted | `#B45309` | `#FEF3C7` | `#F4D58D` |
| Cancelled | `#6B7280` | `#F1F0EA` | `#E1DCCB` |
| Quiz ok / warn / bad | `#16A34A` / `#D97706` / `#DC2626` | - | - |

---

## 4. Typography
Families (already wired in app): **Anton** = `--font-display`, **Archivo** = `--font-ui`, **Archivo Black** = `--font-black`.

| Element | Family | Size | Tracking / case |
|---|---|---|---|
| App header title | Anton | 23px | uppercase, `.03em` |
| Sheet / event title | Anton | 27px | uppercase, `.01em` |
| Date-badge day number | Anton | 17px (rows) / 24–30px (agenda) | - |
| Section header | Archivo Black | 10.5px | uppercase, `.05em` |
| Detail-row label | Archivo Black | 10.5px | uppercase, `.03em`, color muted |
| Detail-row value | Archivo Black | 11–12px | `.3px`, color ink, right-aligned |
| Row title | Archivo Black | 14.5px (compact 13.5px) | - |
| Row sub (time/host) | Archivo (600) | 11px | color muted |
| Tagline | Archivo (500 italic) | 11px | `#A39D86` |
| Category tag | Archivo Black | 9.5px (sm 9px) | uppercase, `.05em` |
| Chip | Archivo Black | 10px | uppercase, `.03em` |
| Sort btn / quick pill | Archivo Black | 9.5px | uppercase |
| Primary button | Archivo Black | 11–13px | uppercase, `.04em` |

Min text size on this surface: **9px** (tags only); body labels ≥10.5px.

---

## 5. Spacing, radius, sizing
| Item | Value |
|---|---|
| Phone screen radius / bezel | 42px / 52px (prototype only) |
| Section / card radius | 18px |
| Row / sub-card radius | 14–16px |
| Date badge | 42×44, radius 12px |
| Chip | pill (radius 99px) |
| Row padding | `11px 15px` |
| Section header padding | `12px 15px` |
| Detail-row padding | `11px 15px` |
| Form row padding | `11px 15px` |
| List horizontal padding | 14px |
| Gaps (rows / chips / meta) | 6–12px |
| Avatar (host initial) | 17px circle |
| Left color spine | 4px wide, inset 11px top/bottom |

## 6. Controls & tap targets
| Control | Size |
|---|---|
| Header "+ New" button | 34px tall |
| Search field / date button | 40px tall |
| Category chip | 29px tall |
| Sort button / quick pill | 27px tall |
| Toggle switch (default / sm) | 38×22 / 32×19; knob 18 / 15; ON = `#16A34A` |
| Sheet footer buttons | 48px tall |
| In-sheet action button | 38px tall |
| Booking row action buttons | 30px square |

## 7. Shadows & motion
- Card hover: `0 9px 22px -14px rgba(0,0,0,.28)`.
- Primary button: `0 10px 22px -10px rgba(92,64,51,.5)`.
- Bottom sheet: slides up `translateY(100%) → 0`, `.28s cubic-bezier(.22,1,.36,1)`; dim backdrop `rgba(20,16,8,.45)`.
- Pushed screen (bookings): slides in from right `translateX(14%) + fade`, same easing.
- "Tonight" ribbon: top-left corner, `top:-9px left:13px`, neon fill, glow `0 5px 12px -4px rgba(255,107,53,.7)`; card gets a 1px neon inset ring.
- Active press: `scale(.98–.96)`. Respect `prefers-reduced-motion`.

## 8. Layout rules
- Sticky header stack: header (search + "+ New") → chips row → sort/quick-filter row, all pinned together.
- List grouped by date with sticky day separators (Today / Tomorrow / weekday + date).
- Detail/edit/booking screens are **bottom sheets** on phone; max-height ~90%, scrollable body, fixed footer.
- Sheet sections: never let a column flexbox shrink them - set `flex: none` so the body scrolls instead of clipping rows.
