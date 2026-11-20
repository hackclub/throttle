"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/grants", label: "Grants" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/activity", label: "Activity" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Same shape as the docs nav: a scroll row on mobile, a sticky column from md. */
export function StaffNav({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff" className="overflow-x-auto md:sticky md:top-6 md:overflow-visible">
      <p className="hidden pb-3 font-mono text-[11px] uppercase tracking-widest text-hc-muted md:block md:pl-3">
        Staff · {role}
      </p>
      <ul className="flex gap-4 whitespace-nowrap md:flex-col md:gap-0.5">
        <li className="flex items-center font-mono text-[11px] uppercase tracking-widest text-hc-muted md:hidden">
          Staff · {role}
        </li>
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "block border-b-2 py-2.5 text-sm transition-colors md:border-b-0 md:border-l-2 md:py-1.5 md:pl-3",
                  active
                    ? "border-hc-blue font-bold text-hc-dark"
                    : "border-transparent text-hc-muted hover:text-hc-dark",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StaffNavSkeleton() {
  return (
    <div aria-hidden className="flex gap-4 py-2.5 md:flex-col md:gap-2 md:py-0 md:pl-3">
      {ITEMS.map((item) => (
        <div key={item.href} className="h-4 w-16 rounded bg-line/70 md:w-24" />
      ))}
    </div>
  );
}
