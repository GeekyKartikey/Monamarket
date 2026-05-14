"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";

interface Props {
  trigger: ReactNode;
  children: ReactNode;
  title?: string;
}

export function BuySheet({ trigger, children, title }: Props) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl outline-none"
          style={{
            background: "var(--surface)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            maxHeight: "90dvh",
          }}
          aria-label={title ?? "Buy shares"}
        >
          {/* Drag handle */}
          <div
            aria-hidden="true"
            className="mx-auto mt-3 mb-2 w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />

          {title && (
            <div
              className="px-5 py-3 border-b"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <h2 className="text-sm font-semibold">{title}</h2>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
