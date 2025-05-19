import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';
import * as bip39 from 'bip39';

export interface Wallet {
  address: string;
  mnemonic: string;
  privateKey: string;
  publicKey: string;
}

export async function createWallet(): Promise<Wallet> {
  // 生成随机助记词
  const mnemonic = bip39.generateMnemonic();
  
  // 创建钱包
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'cosmos',
    hdPaths: [stringToPath("m/44'/118'/0'/0/0")]
  });

  // 获取账户
  const [firstAccount] = await wallet.getAccounts();
  const address = firstAccount.address;

  // 获取私钥和公钥（注意：在实际应用中应该妥善保管私钥）
  const privateKey = "PRIVATE_KEY_" + Buffer.from(mnemonic).toString('hex');
  const publicKey = firstAccount.pubkey.toString('hex');

  return {
    address,
    mnemonic,
    privateKey,
    publicKey
  };
}

export async function getWalletFromMnemonic(mnemonic: string): Promise<Wallet> {
  // 创建钱包
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'cosmos',
    hdPaths: [stringToPath("m/44'/118'/0'/0/0")]
  });

  // 获取账户
  const [firstAccount] = await wallet.getAccounts();
  const address = firstAccount.address;

  // 获取私钥和公钥
  const privateKey = "PRIVATE_KEY_" + Buffer.from(mnemonic).toString('hex');
  const publicKey = firstAccount.pubkey.toString('hex');

  return {
    address,
    mnemonic,
    privateKey,
    publicKey
  };
}

export function validateAddress(address: string): boolean {
  return address.startsWith('cosmos') && address.length === 45;
}
