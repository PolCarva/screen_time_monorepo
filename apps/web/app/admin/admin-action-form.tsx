"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { AdminActionState } from "./actions";

type AdminAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;
const initialState: AdminActionState = { status: "idle", message: "" };

function Submit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className="button button--dark" disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminActionForm({
  action,
  children,
  label,
  pendingLabel,
}: {
  action: AdminAction;
  children?: ReactNode;
  label: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction}>
      {children}
      <Submit label={label} pendingLabel={pendingLabel} />
      {state.status !== "idle" ? (
        <p
          aria-live="polite"
          className={`notice notice--${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
