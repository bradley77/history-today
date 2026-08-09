// QuickStrikeConfig.ts
//
// Era-specific values for the QuickStrike CTA end card, kept separate from
// QuickStrikeShared.tsx so the rendering engine stays generic/content-agnostic.
// Tweak sublines/eras here without touching rendering code.

export const CTA_CONFIG = {
  BLUEGRAY: { subline: 'COMMENT BLUEGRAY TO GET THE FREE 5-FACT CIVIL WAR PDF', era: 'Civil War' },
  FRONT:    { subline: 'COMMENT FRONT TO GET THE FREE 5-FACT WORLD WAR 2 PDF', era: 'WWII' },
  RECON:    { subline: 'COMMENT RECON TO GET THE FREE VIETNAM FACT SHEET', era: 'Vietnam' },
  SEVENTHCAV: { subline: 'COMMENT SEVENTHCAV TO GET THE FREE 5-FACT LITTLE BIGHORN PDF', era: 'Plains Indian Wars' },
  CITADEL:  { subline: 'COMMENT CITADEL TO GET THE FREE 5-FACT VIETNAM PDF', era: 'Vietnam' },
  MARYESANGEL: { subline: 'COMMENT MARYESANGEL TO GET THE FREE 5-FACT CIVIL WAR PDF', era: 'Civil War' },
} as const;

export type CTATriggerWord = keyof typeof CTA_CONFIG;
