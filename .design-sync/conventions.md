# Don Fenticas (bar-app) — design-system POC

This is a **proof-of-concept** import of two primitives (`Button`, `Input`) from the
`bar-app` Next.js app. Read this before composing UI with them.

## Critical: there is no semantic token layer

These shadcn-derived primitives reference colour utilities like `bg-primary`,
`text-primary-foreground`, `bg-secondary`, `bg-destructive`, `bg-accent`,
`border-input`, and `ring-ring`. **The app defines none of the underlying theme
variables** (`--primary`, `--secondary`, `--destructive`, …) — there is no
`@theme` / `:root` token block in its `globals.css`. As a result those colour
utilities resolve to nothing:

- `Input` looks correct — its styling (border, radius, padding, focus ring shape)
  does not depend on the missing colour tokens.
- `Button` renders **structurally only**: sizing and the `outline` border apply,
  but `default`/`secondary`/`ghost`/`destructive` have **no background fill** and
  render as plain text. Do not rely on `variant` for colour.

## How to colour things instead

bar-app styles by **explicit utility classes / hex**, not semantic tokens. It has
two surfaces, kept visually separate:

- **Public** ("gritty bar"): deep olive background `#26300D` / `#1a2008`, gold
  accent `#FDCC4B`, on dark — e.g. `className="bg-[#FDCC4B] text-[#26300D]"`.
- **Admin portal**: cream background `#F7F4EA`, espresso primary `#5C4033`,
  soft borders `#E6DFC8`.

When you place a `Button`, give it explicit colour classes for the target surface
rather than expecting `variant="default"` to supply a fill. Never mix the two
palettes on one surface.

## Components

- **`Button`** — props: `variant` (`default | destructive | outline | secondary
  | ghost | link`), `size` (`default | xs | sm | lg | icon | icon-xs | icon-sm |
  icon-lg`), `asChild`, plus all native `<button>` attributes. Sizing/spacing
  utilities work; colour variants need the token layer (absent here).
- **`Input`** — all native `<input>` attributes; renders a bordered, rounded
  field. Safe to use as-is.

## Build snippet (public surface)

```tsx
import { Button, Input } from "bar-app-ds";

<form className="flex flex-col gap-3">
  <Input placeholder="Your name" />
  <Button className="bg-[#FDCC4B] text-[#26300D] hover:bg-[#FDCC4B]/90">
    Book now
  </Button>
</form>
```
