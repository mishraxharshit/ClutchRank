export const CATEGORIES = [
  { slug: "streamers", name: "Streamers & creators" },
  { slug: "mods", name: "Mods & custom content" },
  { slug: "esports", name: "Esports orgs & teams" },
  { slug: "indie-games", name: "Indie games" },
  { slug: "gear", name: "Gaming gear" },
  { slug: "communities", name: "Communities & Discords" },
  { slug: "other", name: "Other" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
