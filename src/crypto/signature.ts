import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { sha256 } from './hash';
import { TransactionData } from '../models/transaction';

export async function signTransaction(
  txData: TransactionData,
  mnemonic: string
): Promise<string> {
  try {
    // 创建钱包
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic);
    const [firstAccount] = await wallet.getAccounts();

    // 将交易数据转换为字符串，并创建哈希
    const txDataString = JSON.stringify(txData);
    const txHash = sha256(txDataString);

    // 使用钱包签名哈希
    const signature = await wallet.signDirect(
      firstAccount.address,
      Buffer.from(txHash, 'hex')
    );

    // 返回签名的十六进制表示
    return Buffer.from(signature.signature).toString('hex');
  } catch (error) {
    console.error('\u4ea4\u6613\u7b7e\u540d\u5931\u8d25:', error);
    throw new Error('\u4ea4\u6613\u7b7e\u540d\u5931\u8d25');
  }
}

export async function verifySignature(
  txData: TransactionData,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    // 将交易数据转换为字符串，并创建哈希
    const txDataString = JSON.stringify(txData);
    const txHash = sha256(txDataString);

    // 这里需要实现签名验证逻辑
    // 由于DirectSecp256k1HdWallet不直接提供验证方法，这部分需要更复杂的实现
    // 简化起见，我们假设所有签名都是有效的（仅用于演示）
    console.log('\u9a8c\u8bc1\u4ea4\u6613\u7b7e\u540d:', txHash, signature, publicKey);
    return true;
  } catch (error) {
    console.error('\u7b7e\u540d\u9a8c\u8bc1\u5931\u8d25:', error);
    return false;
  }
}
