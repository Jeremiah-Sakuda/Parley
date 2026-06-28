import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface MouthGuardBadgeProps {
  negotiationId: string;
}

export function MouthGuardBadge({ negotiationId }: MouthGuardBadgeProps) {
  const live = useQuery(api.negotiate.liveState, { negotiationId });

  if (live === undefined) return null;

  const overridden = live?.mouthGuardOverridden ?? false;

  return (
    <span
      className={`mouth-guard-badge ${overridden ? "overridden" : "armed"}`}
      title={
        overridden
          ? "LLM prose replaced with safe template. Engine numbers unchanged."
          : "Watching seller text. Engine commits all numbers."
      }
    >
      <span className={`mouth-guard-dot${overridden ? " overridden" : ""}`} aria-hidden />
      {overridden ? "Mouth-guard · overridden" : "Mouth-guard · armed"}
    </span>
  );
}
