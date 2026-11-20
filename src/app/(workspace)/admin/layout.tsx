import { Suspense, type ReactNode } from "react";
import { StaffNav, StaffNavSkeleton } from "@/components/admin/StaffNav";
import { requireReviewer } from "@/lib/auth/session";

// The grid prerenders into the shell. The sub-nav waits for the reviewer
// check, so the staff area isn't advertised to anyone else; each page also
// runs requireReviewer() inside its own <Suspense>.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <aside className="-mx-4 mb-8 border-b border-line px-4 sm:-mx-6 sm:px-6 md:mx-0 md:mb-0 md:border-r md:border-b-0 md:px-0">
        <Suspense fallback={<StaffNavSkeleton />}>
          <StaffSidebar />
        </Suspense>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function StaffSidebar() {
  const user = await requireReviewer();
  return <StaffNav role={user.role} />;
}
