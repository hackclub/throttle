// Single source of truth for grant and fuel maths. Anything that shows or
// stores money should go through these helpers.

export const TIERS = {
  1: {
    rate: 4.5,
    name: "Tier 1",
    blurb: "Beginner builds",
    examples: ["Foamboard glider", "Simple micro-flyer"],
  },
  2: {
    rate: 5,
    name: "Tier 2",
    blurb: "Intermediate builds",
    examples: ["Custom RC plane", "Sub-250 g quad", "Indoor blimp"],
  },
  3: {
    rate: 5.5,
    name: "Tier 3",
    blurb: "Advanced builds",
    examples: [
      "Custom flight controller PCB",
      "Autonomous or FPV system",
      "Complex propulsion",
    ],
  },
} as const;

export type Tier = keyof typeof TIERS;

export const FUEL_PER_HOUR = 10;

export const FUEL_MULTIPLIER: Record<Tier, number> = { 1: 1.0, 2: 1.1, 3: 1.2 };

export function isTier(value: unknown): value is Tier {
  return value === 1 || value === 2 || value === 3;
}

/** Hourly rate (USD) times hours, in whole cents. */
export function grantCents(hours: number, tier: Tier): number {
  return Math.round(hours * TIERS[tier].rate * 100);
}

export function fuelFor(hours: number, tier: Tier): number {
  return Math.round(hours * FUEL_PER_HOUR * FUEL_MULTIPLIER[tier]);
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** 5750 -> "$57.50" */
export function formatUSD(cents: number): string {
  return usd.format(cents / 100);
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/** Narrows a stored tier. The DB check keeps it in range, so anything else is a bug. */
export function toTier(value: number): Tier {
  if (!isTier(value)) throw new Error(`Unknown tier: ${value}`);
  return value;
}

/** Hourly rate in whole cents: tier 1 -> 450. */
export function rateCents(tier: Tier): number {
  return Math.round(TIERS[tier].rate * 100);
}

/** "$4.50 / h" */
export function formatRate(tier: Tier): string {
  return `${formatUSD(rateCents(tier))} / h`;
}

/** Fuel multiplier as shown in equations: "1.1". */
export function formatMultiplier(tier: Tier): string {
  return FUEL_MULTIPLIER[tier].toFixed(1);
}

/**
 * Like formatHours but keeps two decimals, so equations add up for
 * quarter-hour entries: 11.25 -> "11.25 h".
 */
export function formatHoursExact(hours: number): string {
  return `${Math.round(hours * 100) / 100} h`;
}

/** formatHours(11.5) or formatHours(690, "minutes") -> "11.5 h". Drops a trailing ".0". */
export function formatHours(
  value: number,
  unit: "hours" | "minutes" = "hours",
): string {
  const hours = unit === "minutes" ? minutesToHours(value) : value;
  return `${Math.round(hours * 10) / 10} h`;
}
