"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, className, confirmMessage, ariaLabel }: {
  children: ReactNode;
  pending: string;
  className?: string;
  confirmMessage?: string;
  ariaLabel?: string;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={busy}
      aria-busy={busy}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {busy ? pending : children}
    </button>
  );
}
