import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface MouthGuardBadgeProps {
  negotiationId: string;
}

export function MouthGuardBadge({ negotiationId }: MouthGuardBadgeProps) {
  const live = useQuery(api.negotiate.liveState, { negotiationId });

  if (live === undefined || live === null) return null;

  return (
    <span
      className={`mouth-guard-badge ${live.mouthGuardOverridden ? "overridden" : "armed"}`}
    >
      {live.mouthGuardOverridden
        ? "Mouth-guard · overridden — safe template"
        : "Mouth-guard · armed"}
    </span>
  );
}
