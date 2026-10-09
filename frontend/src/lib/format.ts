import { bytesToString } from '@/lib/format/size.ts';

// chips are tiny, so drop the decimals once the number has two digits ("5.9 GiB", "102 MiB")
export function compactBytes(bytes: number) {
  const full = bytesToString(bytes, 1, true);
  const value = Number.parseFloat(full);

  return Number.isFinite(value) && value >= 10 ? bytesToString(bytes, 0, true) : full;
}
