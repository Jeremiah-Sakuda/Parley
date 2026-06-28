export const LEVER_LABELS: Record<string, string> = {
  freight_72h: "72h freight",
  net_60: "net-60",
  defect_guarantee: "defect guarantee",
  account_pricing: "account pricing",
};

export function leverLabel(id: string): string {
  return LEVER_LABELS[id] ?? id.replace(/_/g, " ");
}
