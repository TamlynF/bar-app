# Don Fenticas (bar-app) - design-system POC

A **proof-of-concept** import of two primitives (`Button`, `Input`) from the
`bar-app` Next.js app. Read this before composing UI with them.

## The token layer (admin olive/cream)

These shadcn-derived primitives reference semantic colour utilities - `bg-primary`,
`text-primary-foreground`, `bg-secondary`, `bg-destructive`, `bg-accent`,
`border-input`, `ring-ring`. The app's `globals.css` now defines the backing theme
variables in a `:root` block, re-exported through `@theme inline` as `--color-*`,
so **these utilities resolve to real colour** and `Button` variants render with fill.

The token values are the **admin-portal** palette (the working-tool surface), *not*
the public marketing palette:

| Token | Value | Meaning |
|---|---|---|
| `--primary` | `#34451F` | admin olive |
| `--primary-foreground` / `--card` | `#FFFEFA` | near-white card |
| `--background` | `#F4F1E8` | cream canvas |
| `--secondary` / `--muted` | `#ECE9DE` | soft neutral surface |
| `--accent` | `#E5EBD8` | soft olive tint |
| `--border` / `--input` | `#D8D5C8` | hairline border |
| `--foreground` / `--secondary-foreground` / `--accent-foreground` | `#20231A` | near-black ink |
| `--muted-foreground` | `#5E6654` | muted text |
| `--destructive` | `#B33A32` | status red |
| `--ring` | `#D7A928` | brand gold - focus rings only |

So out of the box `Button` looks like an **admin** button: olive fill, near-white text.
Gold is the focus-ring colour only - never a button fill.

## Two surfaces - pick the colour strategy per surface

bar-app has two intentionally-separate surfaces:

- **Admin portal** - cream canvas `#F4F1E8`, olive primary `#34451F`. Here the
  `variant` props match the surface: use `Button` / `Button variant="secondary"` /
  `variant="destructive"` as-is; they already carry the right colours.
- **Public site** ("gritty bar") - deep olive `#26300D`/`#14180a`, gold accent
  `#FDCC4B`. The token layer is admin-only, so on this surface **override colour with
  explicit classes** rather than relying on `variant` - e.g.
  `className="bg-[#FDCC4B] text-[#26300D] hover:bg-[#FDCC4B]/90"`.

Never mix the two palettes on one surface.

## Components

- **`Button`** - `variant`: `default | destructive | outline | secondary | ghost |
  link`; `size`: `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`;
  `asChild`; plus the native `<button>` attributes declared in `Button.d.ts`
  (`type`, `disabled`, `onClick`, `name`, `value`, `form`, `title`, `aria-label`,
  `tabIndex`). Both axes render fully (sizing **and** colour).
- **`Input`** - the native `<input>` attributes declared in `Input.d.ts`: `type`,
  `placeholder`, `value`/`defaultValue`, `onChange`/`onBlur`/`onFocus`, `disabled`,
  `readOnly`, `required`, `name`, `autoComplete`, `min`/`max`/`step`, `maxLength`,
  `pattern`, `inputMode`, `aria-label`. A bordered, rounded field with a focus
  ring. Safe to use as-is on either surface.

Both spread any further props straight onto the underlying DOM element, so an
attribute missing from the `.d.ts` still works at runtime - but prefer the
declared ones; they are the contract.

## Build snippets

Admin surface - variants supply the colour:

```tsx
import { Button, Input } from "bar-app-ds";

<form className="flex flex-col gap-3">
  <Input placeholder="Customer name" />
  <Button>Save booking</Button>
  <Button variant="secondary">Cancel</Button>
</form>
```

Public surface - override colour to gold-on-olive:

```tsx
<Button className="bg-[#FDCC4B] text-[#26300D] hover:bg-[#FDCC4B]/90">
  Book now
</Button>
```
