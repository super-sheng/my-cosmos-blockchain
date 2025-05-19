import { Sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import crypto from 'crypto';

export function sha256(data: string): string {
  const hash = new Sha256();
  hash.update(Buffer.from(data));
  return toHex(hash.digest());
}

/**
 * 计算数据的 hash160 值
 * 先应用 SHA-256 哈希，然后对结果应用 RIPEMD-160 哈希
 * 
 * @param {string} data 要哈希的数据
 * @returns {string} hash160 哈希值（十六进制字符串）
 */
export function hash160(data: string): string {
  // 先计算 SHA-256 哈希
  const sha256Hash = sha256(data);
  
  // 然后计算 RIPEMD-160 哈希
  // Node.js 的 crypto 库支持 ripemd160
  return crypto.createHash('ripemd160')
    .update(Buffer.from(sha256Hash, 'hex'))
    .digest('hex');
}
