import Link from "next/link";
import type { ReactNode } from "react";
import Waitlist from "@/components/Waitlist";
import SkyPlane from "@/components/SkyPlane";
import { ArtSlot } from "@/components/ui/ArtSlot";
import { Icon } from "@/components/ui/Icon";
import { TIERS, formatRate, type Tier } from "@/lib/tiers";

const clouds = [
  { top: "5%", size: 180, dur: 75, delay: -10 },
  { top: "18%", size: 90, dur: 60, delay: -45 },
  { top: "66%", size: 220, dur: 95, delay: -70 },
  { top: "80%", size: 140, dur: 80, delay: -20 },
  { top: "88%", size: 110, dur: 55, delay: -30 },
];

const launched = process.env.NEXT_PUBLIC_LAUNCHED === "true";

const steps = [
  {
    art: "step-design.svg",
    title: "1. Design & log",
    body: "Plan your aircraft, log every session with notes and photos.",
  },
  {
    art: "step-funded.svg",
    title: "2. Get funded",
    body: "Submit your design. Approved hours turn into an HCB grant for parts.",
  },
  {
    art: "step-fly.svg",
    title: "3. Build it & fly it",
    body: "Build it, film the maiden flight, ship it and earn fuel for the shop.",
  },
];

const flyers: { name: string; note: string }[] = [
  { name: "Drones", note: "quads, hexes, FPV, VTOL" },
  { name: "RC planes", note: "foamies, warbirds, flying wings" },
  { name: "Gliders", note: "hand-launch, slope, sailplanes" },
  { name: "Helicopters", note: "coaxial, single rotor, autogyros" },
  { name: "Rockets", note: "low-power, certified motors" },
  { name: "Blimps", note: "indoor airships, balloons" },
  { name: "Ornithopters", note: "flapping-wing flyers" },
  { name: "Something new", note: "if it leaves the ground, it counts" },
];

const tiers: Tier[] = [1, 2, 3];

const faqs: { q: string; a: string }[] = [
  {
    q: "Do I need experience?",
    a: "No. Lots of people start with a foamboard glider. Pick Tier 1, log what you learn, and ask in #throttle when you get stuck.",
  },
  {
    q: "How much can I get?",
    a: "There's no cap. Your grant is your approved design hours × your tier rate, so 20 hours at Tier 2 is $100.",
  },
  {
    q: "Who picks my tier?",
    a: "You do, when you create your aircraft. Reviewers can move it up or down at Design Review if it doesn't match the build.",
  },
  {
    q: "What do I need to ship?",
    a: "A public repo, a bom.csv in the repo root, a journal of your hours, and a video of the maiden flight.",
  },
  {
    q: "What if it crashes?",
    a: "Rebuild it and log the repair. You need one good flight on video, not a perfect first try.",
  },
  {
    q: "Can I submit to another program too?",
    a: "No. A project can only be funded once, so no double-dipping across Hack Club programs.",
  },
];

const navLink =
  "font-bold text-white [text-shadow:0_1px_4px_rgba(23,23,29,0.35)] transition-opacity hover:opacity-80";

export default function Home() {
  return (
    <>
      {/* The sky and its fade are opaque, so the grid only shows under the sections. */}
      <main className="blueprint">
        <div className="sky relative flex min-h-svh flex-col overflow-hidden">
          {/* Official Hack Club flag banner (hackclub.com/brand) */}
          <a href="https://hackclub.com/" className="absolute left-2.5 top-0 z-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://assets.hackclub.com/flag-orpheus-top.svg" alt="Hack Club" className="w-36 sm:w-56" />
          </a>

          <nav aria-label="Main" className="absolute right-4 top-4 z-20 flex items-center gap-5 sm:right-6 sm:top-5 sm:gap-6">
            <Link href="/docs" className={navLink}>
              Docs
            </Link>
            <Link href="/signin" className={navLink}>
              Sign in
            </Link>
          </nav>

          {/* Clouds */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {clouds.map((c, i) => (
              <svg
                key={i}
                viewBox="0 0 120 50"
                className="cloud absolute left-0 opacity-90"
                style={{ top: c.top, width: c.size, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
              >
                <path d="M20 45h80a15 15 0 0 0 0-30 22 22 0 0 0-40-6 16 16 0 0 0-28 8A14 14 0 0 0 20 45Z" fill="#fff" />
              </svg>
            ))}
          </div>

          {/* Plane */}
          <SkyPlane />

          {/* Centre */}
          <section className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-40 text-center sm:pt-44">
            <h1 className="text-7xl font-bold leading-[0.9] tracking-[-0.03em] text-white [text-shadow:0_4px_0_rgba(236,55,80,0.55)] sm:text-[9rem]">
              Throttle
            </h1>
            <p className="mt-5 text-2xl font-bold leading-tight text-white [text-shadow:0_2px_6px_rgba(23,23,29,0.35)] sm:text-3xl">
              Build anything that can fly. <span className="text-hc-yellow">We fund it.</span>
            </p>
            <p className="mt-2 text-base text-white/90 [text-shadow:0_1px_4px_rgba(23,23,29,0.35)] sm:text-lg">
              A Hack Club You Ship, We Ship program for teens 13–18.
            </p>

            {launched ? (
              <div className="mt-10 flex flex-col items-center gap-3">
                <Link
                  href="/signin"
                  className="rounded-xl bg-hc-red px-7 py-3.5 text-lg font-bold text-white shadow-md transition hover:scale-105 active:scale-95"
                >
                  Start your aircraft →
                </Link>
                <Link
                  href="/docs"
                  className="text-white/80 underline underline-offset-4 [text-shadow:0_1px_4px_rgba(23,23,29,0.35)] hover:text-white"
                >
                  or read the docs
                </Link>
              </div>
            ) : (
              <div id="rsvp" className="mt-10 w-full max-w-md rounded-2xl bg-white p-4 text-left shadow-xl sm:p-5">
                <p className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-hc-muted">
                  RSVP to hear when it opens
                </p>
                <Waitlist />
              </div>
            )}
          </section>

          <p className="relative z-10 pb-5 text-center text-sm text-hc-dark/70">
            Questions? Ask in{" "}
            <a href="https://hackclub.com/slack" className="font-bold underline">
              #throttle
            </a>{" "}
            on the Hack Club Slack.
          </p>
        </div>

        {/* The sky's last colour fades into the page */}
        <div className="h-24 bg-linear-to-b from-[#bfe9f7] to-paper" aria-hidden="true" />

        <div className="mx-auto max-w-4xl divide-y divide-line px-4 sm:px-6">
          <Section id="how-it-works" eyebrow="How it works" title="From sketch to first flight.">
            <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((s) => (
                <li key={s.art}>
                  <ArtSlot name={s.art} ratio="4/3" />
                  <h3 className="mt-4 text-lg font-bold text-hc-dark">{s.title}</h3>
                  <p className="mt-1 text-hc-dark/80">{s.body}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="what-counts" eyebrow="What counts" title="If it flies, it counts.">
            <ul className="grid gap-x-10 gap-y-2.5 md:grid-cols-2">
              {flyers.map((f) => (
                <li key={f.name} className="flex items-baseline gap-3 text-hc-dark/80">
                  <span aria-hidden className="size-1.5 shrink-0 -translate-y-0.5 bg-hc-blue" />
                  <span>
                    <span className="font-bold text-hc-dark">{f.name}:</span> {f.note}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-hc-muted">
              <span className="font-bold text-hc-dark/70">Out of scope:</span> ready-to-fly kits you
              didn&apos;t design, weapons or payload drops, anything that carries a person, high-power
              rockets.
            </p>
          </Section>

          <Section id="funding" eyebrow="Funding" title="Paid by the hour. No cap.">
            <ul className="divide-y divide-line border-y border-line">
              {tiers.map((t) => {
                const tier = TIERS[t];
                return (
                  <li
                    key={t}
                    className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-6 gap-y-3 py-5 sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="w-24">
                      <ArtSlot name={`tier-wings-${t}.svg`} ratio="3/1" />
                    </div>
                    <div>
                      <p className="font-bold text-hc-dark">{tier.name}</p>
                      <p className="text-sm text-hc-muted">{tier.blurb}</p>
                    </div>
                    <p className="col-start-2 text-sm text-hc-dark/80 sm:col-start-auto">
                      {tier.examples.join(", ")}
                    </p>
                    <p className="col-start-2 font-mono text-2xl font-bold tabular-nums text-hc-dark sm:col-start-auto sm:text-right sm:text-3xl">
                      {formatRate(t)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-hc-dark/80">
              Grant = design hours × your tier rate, sent as an HCB card for parts. Build hours earn
              fuel for the shop.
            </p>
          </Section>

          <Section id="safety" eyebrow="Safety" title="Who can join, and how to fly.">
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-bold text-hc-dark">Who can join</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-hc-dark/80">
                  <li>Teens 13–18, anywhere in the world (under 19 when you submit).</li>
                  <li>One Hack Club account per person.</li>
                  <li>Real work only: no AI-generated journal entries or images.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-hc-dark">Flying rules</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-hc-dark/80">
                  <li>Keep LiPos in a LiPo bag and never charge them unattended.</li>
                  <li>Props off whenever you work on it powered.</li>
                  <li>Follow your local airspace rules and register if you need to.</li>
                  <li>Never fly over people, roads or airports.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="faq" eyebrow="FAQ" title="Questions">
            <div className="divide-y divide-line border-y border-line">
              {faqs.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-hc-dark [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Icon
                      name="plus"
                      size={18}
                      className="shrink-0 text-hc-muted transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="mt-2 max-w-2xl text-hc-dark/80">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-sm text-hc-muted">
              More in the{" "}
              <Link href="/docs/faq" className="text-hc-blue underline underline-offset-2">
                full FAQ
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>

      <footer className="bg-hc-dark text-white/70">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <p>
            <span className="font-bold text-white">Throttle</span> A Hack Club program.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/docs" className="hover:text-white">
                Docs
              </Link>
            </li>
            <li>
              <a href="https://hackclub.com/slack" className="hover:text-white">
                #throttle on Slack
              </a>
            </li>
            <li>
              <a href="https://hackclub.com/conduct" className="hover:text-white">
                Code of Conduct
              </a>
            </li>
            <li>
              <a href="https://hackclub.com" className="hover:text-white">
                Hack Club
              </a>
            </li>
          </ul>
          <p className="mt-6 text-xs text-white/50">
            Hack Club is a 501(c)(3) nonprofit (EIN: 81-2908499).
          </p>
        </div>
      </footer>
    </>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="py-16 sm:py-20">
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-hc-blue">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-3xl font-bold tracking-tight text-hc-dark">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}
