export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  signature: string;
  publicKey?: string;
  type: TransactionType;
  fee: number;
}

export enum TransactionType {
  TRANSFER = 'TRANSFER',
  MINING_REWARD = 'MINING_REWARD'
}

export interface TransactionData {
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  type: TransactionType;
  fee: number;
}

export function createTransactionData(
  from: string,
  to: string,
  amount: number,
  type: TransactionType = TransactionType.TRANSFER,
  fee: number = 0.001
): TransactionData {
  return {
    from,
    to,
    amount,
    timestamp: Date.now(),
    type,
    fee
  };
}

export function createMiningRewardTransaction(
  minerAddress: string,
  reward: number
): Transaction {
  return {
    id: `reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: 'BLOCKCHAIN_REWARD',
    to: minerAddress,
    amount: reward,
    timestamp: Date.now(),
    signature: 'SYSTEM_GENERATED',
    type: TransactionType.MINING_REWARD,
    fee: 0
  };
}
