"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProviderConfigurationState } from "./provider-state";

interface ProviderStatusBadgeProps {
  state: ProviderConfigurationState;
  serverConnected: boolean;
}

export function ProviderStatusBadge({
  state,
  serverConnected,
}: ProviderStatusBadgeProps) {
  if (state.localState === "complete") {
    return (
      <Badge
        variant="secondary"
        className="h-6 gap-1 rounded-lg border-0 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
      >
        <CircleCheck className="size-3" strokeWidth={2.5} />
        Key set
      </Badge>
    );
  }

  if (state.localState === "partial") {
    return (
      <Badge
        variant="secondary"
        className="h-6 gap-1 rounded-lg border-0 bg-amber-500/10 px-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
      >
        <CircleAlert className="size-3" strokeWidth={2.5} />
        Incomplete
      </Badge>
    );
  }

  if (serverConnected) {
    return (
      <Badge
        variant="secondary"
        className="h-6 gap-1 rounded-lg border-0 bg-blue-500/10 px-2 text-[10px] font-semibold text-blue-700 dark:text-blue-400"
      >
        <CircleCheck className="size-3" strokeWidth={2.5} />
        Server key
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="h-6 gap-1 rounded-lg border-0 bg-muted px-2 text-[10px] font-medium text-muted-foreground"
    >
      <CircleX className="size-3" strokeWidth={2} />
      Not configured
    </Badge>
  );
}
