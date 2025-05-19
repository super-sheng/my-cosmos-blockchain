import { Sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';

export function sha256(data: string): string {
  const hash = new Sha256();
  hash.update(Buffer.from(data));
  return toHex(hash.digest());
}
