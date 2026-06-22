# Don Fenticas (bar-app) — design-system POC

A **proof-of-concept** import of two primitives (`Button`, `Input`) from the
`bar-app` Next.js app. Read this before composing UI with them.

## The token layer (admin espresso/cream)

These shadcn-derived primitives reference semantic colour utilities — `bg-primary`,
`text-primary-foreground`, `bg-secondary`, `bg-destructive`, `bg-accent`,
`border-input`, `ring-ring`. The app's `globals.css` now defines the backing theme
variables in a `:root` block, re-exported through `@theme inline` as `--color-*`,
so **these utilities resolve to real colour** and `Button` variants render with fill.

The token values are the **admin-portal** palette (the working-tool surface), *not*
the public marketing palette:

| Token | Value | Meaning |
|---|---|---|
| `--primary` / `--ring` | `#5C4033` | espresso |
| `--primary-foreground` / `--background` / `--accent` | `#F7F4EA` | cream |
| `--secondary` / `--border` / `--input` | `#E6DFC8` | soft tan border |
| `--destructive` | `#DC2626` | status red |
| `--foreground` | `#1F1F1A` | near-black ink |

So out of the box `Button` looks like an **admin** button: espresso fill, cream text.

## Two surfaces — pick the colour strategy per surface

bar-app has two intentionally-separate surfaces:

- **Admin portal** — cream canvas `#F7F4EA`, espresso primary `#5C4033`. Here the
  `variant` props match the surface: use `Button` / `Button variant="secondary"` /
  `variant="destructive"` as-is; they already carry the right colours.
- **Public site** ("gritty bar") — deep olive `#26300D`/`#14180a`, gold accent
  `#FDCC4B`. The token layer is admin-only, so on this surface **override colour with
  explicit classes** rather than relying on `variant` — e.g.
  `className="bg-[#FDCC4B] text-[#26300D] hover:bg-[#FDCC4B]/90"`.

Never mix the two palettes on one surface.

## Components

- **`Button`** — `variant`: `default | destructive | outline | secondary | ghost |
  link`; `size`: `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`;
  `asChild`; plus all native `<button>` attributes. Both axes now render fully
  (sizing **and** colour).
- **`Input`** — all native `<input>` attributes; a bordered, rounded field with a
  focus ring. Safe to use as-is on either surface.

## Build snippets

Admin surface — variants supply the colour:

```tsx
import { Button, Input } from "bar-app-ds";

<form className="flex flex-col gap-3">
  <Input placeholder="Customer name" />
  <Button>Save booking</Button>
  <Button variant="secondary">Cancel</Button>
</form>
```

Public surface — override colour to gold-on-olive:

```tsx
<Button className="bg-[#FDCC4B] text-[#26300D] hover:bg-[#FDCC4B]/90">
  Book now
</Button>
```
