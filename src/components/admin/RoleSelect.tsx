"use client";

import { useActionState } from "react";
import { setUserRole } from "@/app/(workspace)/admin/users/actions";
import { ROLES, type Role, type RoleState } from "@/app/(workspace)/admin/users/form-state";

const initial: RoleState = {};

/** Saves as soon as a new role is picked. Your own row is locked. */
export function RoleSelect({ userId, role, self }: { userId: string; role: Role; self: boolean }) {
  const [state, action, pending] = useActionState(setUserRole, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={self || pending}
        title={self ? "You can't change your own role" : undefined}
        aria-label="Role"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-hc-dark focus:border-hc-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40 disabled:cursor-not-allowed disabled:text-hc-muted"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {state.error && (
        <span role="alert" className="text-xs text-hc-red">
          {state.error}
        </span>
      )}
    </form>
  );
}
