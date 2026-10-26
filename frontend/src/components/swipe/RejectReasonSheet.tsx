"use client";

import { getMessages, t } from "@/lib/i18n";
import type { RejectionReason } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export function RejectReasonSheet({
  open,
  reasons,
  onSelect,
  onSkip,
  onClose,
}: {
  open: boolean;
  reasons: RejectionReason[];
  onSelect: (reason: RejectionReason) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3">
      <div className="sn-card w-full max-w-md p-5 pb-6">
        <h2 className="text-xl font-bold text-[var(--sn-green)]">
          {t(messages, "discover.rejectTitle")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {reasons.map((reason) => (
            <button
              key={reason}
              className="rounded-2xl bg-[var(--sn-beige)] px-4 py-3.5 text-left text-sm font-semibold text-[var(--sn-green)] transition hover:bg-[rgba(167,196,184,0.35)]"
              onClick={() => onSelect(reason)}
            >
              {t(messages, `discover.${reason}`)}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="sn-btn sn-btn-secondary flex-1" onClick={onClose}>
            {t(messages, "explain.close")}
          </button>
          <button className="sn-btn sn-btn-primary flex-1" onClick={onSkip}>
            {t(messages, "discover.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
