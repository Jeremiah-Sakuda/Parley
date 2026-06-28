/** Apply a dot-path update to a plain object (e.g. `levers.0.costCents`). */
export function patchField<T extends object>(obj: T, path: string, value: unknown): T {
  const result = structuredClone(obj);
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    cursor = /^\d+$/.test(key) ? cursor[Number(key)] : cursor[key];
  }

  const last = keys[keys.length - 1]!;
  if (/^\d+$/.test(last)) {
    cursor[Number(last)] = value;
  } else {
    cursor[last] = value;
  }

  return result;
}
