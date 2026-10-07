import * as React from "react";
import { Button } from "bar-app-ds";

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  padding: 16,
};

const publicRow: React.CSSProperties = {
  ...row,
  background: "#14180a",
  borderRadius: 12,
};

export const Variants = () => (
  <div style={row}>
    <Button>Book now</Button>
    <Button variant="secondary">Details</Button>
    <Button variant="destructive">Cancel</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Learn more</Button>
  </div>
);

export const PublicSurface = () => (
  <div style={publicRow}>
    <Button variant="gold" size="cta">Book for the quiz</Button>
    <Button variant="goldOutline" size="cta">See the menu</Button>
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="cta">Call to action</Button>
  </div>
);

export const States = () => (
  <div style={row}>
    <Button>Enabled</Button>
    <Button disabled>Disabled</Button>
  </div>
);
