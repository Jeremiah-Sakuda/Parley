import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { NEGOTIATION_ID } from "../constants";

interface DemoResetButtonProps {
  scenarioId: string;
}

export function DemoResetButton({ scenarioId }: DemoResetButtonProps) {
  const reset = useMutation(api.seed.reset);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await reset({ negotiationId: NEGOTIATION_ID, scenarioId });
    } finally {
      setResetting(false);
    }
  }

  return (
    <button
      type="button"
      className="demo-reset-btn"
      onClick={handleReset}
      disabled={resetting}
      title="Clear chat, concessions, and reset net value to list price"
    >
      {resetting ? "Resetting…" : "Reset demo"}
    </button>
  );
}
