import { Transaction } from './transaction';
import { sha256 } from '../crypto/hash';

export interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  hash: string;
  nonce: number;
  difficulty: number;
  miner: string;
}

export function createGenesisBlock(): Block {
  const genesisBlock: Block = {
    index: 0,
    timestamp: Date.now(),
    transactions: [],
    previousHash: '0',
    hash: '',
    nonce: 0,
    difficulty: 4,
    miner: 'genesis'
  };

  genesisBlock.hash = calculateBlockHash(genesisBlock);
  return genesisBlock;
}

export function createNewBlock(
  index: number,
  previousHash: string,
  transactions: Transaction[],
  difficulty: number,
  miner: string
): Block {
  const newBlock: Block = {
    index,
    timestamp: Date.now(),
    transactions,
    previousHash,
    hash: '',
    nonce: 0,
    difficulty,
    miner
  };

  return newBlock;
}

export function calculateBlockHash(block: Block): string {
  return sha256(
    block.index.toString() +
    block.timestamp.toString() +
    block.previousHash +
    JSON.stringify(block.transactions) +
    block.nonce.toString() +
    block.difficulty.toString() +
    block.miner
  );
}

export function isValidBlockHash(hash: string, difficulty: number): boolean {
  const prefix = '0'.repeat(difficulty);
  return hash.startsWith(prefix);
}

export function isValidNewBlock(newBlock: Block, previousBlock: Block): boolean {
  if (previousBlock.index + 1 !== newBlock.index) {
    console.error('区块索引无效');
    return false;
  }

  if (previousBlock.hash !== newBlock.previousHash) {
    console.error('前一个区块的哈希值无效');
    return false;
  }

  if (calculateBlockHash(newBlock) !== newBlock.hash) {
    console.error('区块哈希值无效');
    return false;
  }

  if (!isValidBlockHash(newBlock.hash, newBlock.difficulty)) {
    console.error('区块哈希值不满足难度要求');
    return false;
  }

  return true;
}
