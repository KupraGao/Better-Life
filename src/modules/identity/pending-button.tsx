"use client";

import { useFormStatus } from "react-dom";

export function PendingButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {label}
    </button>
  );
}
