import Link from "next/link";
import { ArtSlot } from "@/components/ui/ArtSlot";

export default function NotFound() {
  return (
    <main className="sky flex min-h-svh flex-col items-center justify-center px-4 py-12 text-center">
      <ArtSlot name="lost.webp" ratio="1/1" className="max-w-[220px]" />
      <h1 className="mt-6 text-5xl font-bold tracking-tight text-white [text-shadow:0_3px_0_rgba(236,55,80,0.55)] sm:text-6xl">
        Where are we?
      </h1>
      <p className="mt-3 max-w-sm text-lg text-white [text-shadow:0_1px_4px_rgba(23,23,29,0.35)]">
        That page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-hc-red px-5 py-2.5 font-bold text-white transition hover:scale-105 active:scale-95"
        >
          Back to the runway
        </Link>
        <Link
          href="/hangar"
          className="rounded-xl bg-white px-5 py-2.5 font-bold text-hc-dark transition hover:scale-105 active:scale-95"
        >
          Hangar
        </Link>
      </div>
    </main>
  );
}
