import { Block, createGenesisBlock, createNewBlock, isValidNewBlock } from '../models/block';
import { Transaction, TransactionType, createMiningRewardTransaction } from '../models/transaction';
import { getDB } from '../storage/db';

// 区块链配置
const BLOCK_GENERATION_INTERVAL = 10000; // 10秒
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10; // 每10个区块调整一次难度
const MINING_REWARD = 50; // 挖矿奖励
const MAX_TRANSACTIONS_PER_BLOCK = 5; // 每个区块最多包含的交易数

// 待处理交易池
let transactionPool: Transaction[] = [];

// 初始化区块链
export async function initBlockchain (): Promise<void> {
  const db = getDB();
  const lastBlock = await db.getLastBlock();

  if (!lastBlock) {
    // 如果不存在区块，创建创世区块
    const genesisBlock = createGenesisBlock();
    await db.saveBlock(genesisBlock);
    console.log('区块链已初始化，创世区块已创建');
  } else {
    console.log(`区块链已加载，当前高度: ${lastBlock.index}`);
  }
}

// 获取最后一个区块
export async function getLatestBlock (): Promise<Block> {
  const db = getDB();
  const lastBlock = await db.getLastBlock();
  if (!lastBlock) {
    throw new Error('区块链未初始化');
  }
  return lastBlock;
}

// 获取区块链的所有区块
export async function getBlockchain (): Promise<Block[]> {
  const db = getDB();
  const lastBlock = await db.getLastBlock();
  if (!lastBlock) {
    return [];
  }

  const blockchain: Block[] = [];
  for (let i = 0; i <= lastBlock.index; i++) {
    const block = await db.getBlockByIndex(i);
    if (block) {
      blockchain.push(block);
    }
  }

  return blockchain;
}

// 添加新区块到区块链
export async function addBlock (block: Block): Promise<boolean> {
  const db = getDB();
  const lastBlock = await getLatestBlock();

  if (isValidNewBlock(block, lastBlock)) {
    // 更新交易池 - 移除已被包含在区块中的交易
    transactionPool = transactionPool.filter(tx =>
      !block.transactions.some(blockTx => blockTx.id === tx.id)
    );

    // 更新余额
    for (const tx of block.transactions) {
      if (tx.type === TransactionType.TRANSFER) {
        // 转账交易
        const senderBalance = await db.getBalance(tx.from);
        const recipientBalance = await db.getBalance(tx.to);

        await db.updateBalance(tx.from, senderBalance - tx.amount - tx.fee);
        await db.updateBalance(tx.to, recipientBalance + tx.amount);
      } else if (tx.type === TransactionType.MINING_REWARD) {
        // 挖矿奖励
        const minerBalance = await db.getBalance(tx.to);
        await db.updateBalance(tx.to, minerBalance + tx.amount);
      }
    }

    // 保存区块
    await db.saveBlock(block);
    return true;
  }
  return false;
}

// 添加交易到交易池
export async function addToTransactionPool (transaction: Transaction): Promise<boolean> {
  const db = getDB();

  // 验证交易
  // 检查发送者余额是否足够
  if (transaction.type === TransactionType.TRANSFER) {
    const senderBalance = await db.getBalance(transaction.from);
    if (senderBalance < transaction.amount + transaction.fee) {
      console.error('余额不足');
      return false;
    }
  }

  // 将交易添加到池中
  transactionPool.push(transaction);
  await db.saveTransaction(transaction);
  return true;
}

// 获取交易池中的交易
export function getTransactionPool (): Transaction[] {
  return [...transactionPool];
}

// 生成新区块
export async function generateNextBlock (minerAddress: string): Promise<Block> {
  const lastBlock = await getLatestBlock();
  const nextIndex = lastBlock.index + 1;

  // 选择交易池中的交易
  const transactions = transactionPool
    .slice(0, MAX_TRANSACTIONS_PER_BLOCK);

  // 添加挖矿奖励交易
  const rewardTx = createMiningRewardTransaction(minerAddress, MINING_REWARD);
  transactions.push(rewardTx);

  // 计算难度
  const difficulty = await calculateDifficulty();

  // 创建新区块
  const newBlock = createNewBlock(
    nextIndex,
    lastBlock.hash,
    transactions,
    difficulty,
    minerAddress
  );

  return newBlock;
}

// 根据区块历史调整难度
async function calculateDifficulty (): Promise<number> {
  const db = getDB();
  const lastBlock = await db.getLastBlock();
  if (!lastBlock) {
    return 4; // 默认难度
  }

  if (lastBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0) {
    return lastBlock.difficulty;
  }

  // 需要调整难度
  const prevAdjustmentBlock = await db.getBlockByIndex(
    Math.max(0, lastBlock.index - DIFFICULTY_ADJUSTMENT_INTERVAL)
  );
  if (!prevAdjustmentBlock) {
    return lastBlock.difficulty;
  }

  // 计算预期的出块时间和实际出块时间
  const expectedTime = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken = lastBlock.timestamp - prevAdjustmentBlock.timestamp;

  // 调整难度
  if (timeTaken < expectedTime / 2) {
    return lastBlock.difficulty + 1; // 增加难度
  } else if (timeTaken > expectedTime * 2) {
    return Math.max(1, lastBlock.difficulty - 1); // 降低难度，但不低于1
  } else {
    return lastBlock.difficulty;
  }
}

// 验证区块链
export async function isBlockchainValid (): Promise<boolean> {
  const blockchain = await getBlockchain();

  for (let i = 1; i < blockchain.length; i++) {
    const currentBlock = blockchain[i];
    const previousBlock = blockchain[i - 1];

    if (!isValidNewBlock(currentBlock, previousBlock)) {
      return false;
    }
  }

  return true;
}

// 获取账户余额
export async function getBalance (address: string): Promise<number> {
  const db = getDB();
  return db.getBalance(address);
}
