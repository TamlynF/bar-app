import * as React from "react";
import { Input } from "bar-app-ds";

const col: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  maxWidth: 320,
  padding: 16,
};

export const Default = () => (
  <div style={col}>
    <Input placeholder="Your name" />
    <Input type="email" placeholder="you@example.com" />
  </div>
);

export const WithValue = () => (
  <div style={col}>
    <Input defaultValue="Tamlyn Fourie" />
  </div>
);

export const Disabled = () => (
  <div style={col}>
    <Input placeholder="Unavailable" disabled />
  </div>
);
