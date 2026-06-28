import { useQuery } from "convex/react";
import { contractApi } from "../lib/contractApi";
import type { LiveState } from "../lib/contractApi";

interface MouthGuardBadgeProps {
  negotiationId: string;
}

export function MouthGuardBadge({ negotiationId }: MouthGuardBadgeProps) {
  const live = useQuery(contractApi.negotiate.liveState, { negotiationId }) as LiveState | null | undefined;

  if (live === undefined || live === null) return null;

  const overridden = Boolean(live.mouthGuardOverridden);

  return (
    <span className={`mouth-guard-badge ${overridden ? "overridden" : "armed"}`}>
      {overridden ? "Mouth-guard · overridden — safe template" : "Mouth-guard · armed"}
    </span>
  );
}
