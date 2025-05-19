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
    console.error('\u533a\u5757\u7d22\u5f15\u65e0\u6548');
    return false;
  }

  if (previousBlock.hash !== newBlock.previousHash) {
    console.error('\u524d\u4e00\u4e2a\u533a\u5757\u7684\u54c8\u5e0c\u503c\u65e0\u6548');
    return false;
  }

  if (calculateBlockHash(newBlock) !== newBlock.hash) {
    console.error('\u533a\u5757\u54c8\u5e0c\u503c\u65e0\u6548');
    return false;
  }

  if (!isValidBlockHash(newBlock.hash, newBlock.difficulty)) {
    console.error('\u533a\u5757\u54c8\u5e0c\u503c\u4e0d\u6ee1\u8db3\u96be\u5ea6\u8981\u6c42');
    return false;
  }

  return true;
}
