/* Ordering and filtering of whatever list a provider hands back, so the
   settings page reads newest-first whichever provider it is looking at. */

import type { AiKind, AiModel } from "./providers/types";

const FAMILY_VERSION = /(\d+(?:\.\d+)?)/;
const PRERELEASE = /preview|exp|latest|beta/i;

export function familyVersion(id: string): number {
  const match = id.match(FAMILY_VERSION);
  return match ? parseFloat(match[1]) : 0;
}

export function isPrerelease(id: string): boolean {
  return PRERELEASE.test(id);
}

export function sortNewestFirst(models: AiModel[]): AiModel[] {
  return [...models].sort((a, b) => {
    const version = familyVersion(b.id) - familyVersion(a.id);
    if (version !== 0) return version;
    const stable = Number(isPrerelease(a.id)) - Number(isPrerelease(b.id));
    if (stable !== 0) return stable;
    return a.id.localeCompare(b.id);
  });
}

export function modelsForKind(models: AiModel[], kind: AiKind): AiModel[] {
  return models.filter((model) => model.kinds.includes(kind));
}

export function findModel(models: AiModel[], id: string): AiModel | undefined {
  return models.find((model) => model.id === id);
}
