/**
 * Green when the group owes the user, red when the user owes the group. A
 * settled balance gets no class, so the color of the caller stays.
 */
export function balanceToneClass(netMinor: number) {
  if (netMinor === 0) return undefined;

  return netMinor > 0 ? "text-success" : "text-destructive";
}
