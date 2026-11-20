import type { Project } from "@/lib/db/schema";

export type AircraftCategory = Project["category"];

export const CATEGORY_LABEL: Record<AircraftCategory, string> = {
  drone: "Drone",
  rc_plane: "RC plane",
  glider: "Glider",
  helicopter: "Helicopter",
  rocket: "Rocket",
  blimp: "Blimp",
  ornithopter: "Ornithopter",
  other: "Other",
};
