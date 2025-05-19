import { Block, calculateBlockHash, isValidBlockHash } from '../models/block';
import { generateNextBlock, addBlock } from '../blockchain/blockchain';

interface MiningInfo {
  isActive: boolean;
  minerAddress: string | null;
  currentBlock: Block | null;
  hashesProcessed: number;
  startTime: number;
}

const miningInfo: MiningInfo = {
  isActive: false,
  minerAddress: null,
  currentBlock: null,
  hashesProcessed: 0,
  startTime: 0
};

export function getMiningInfo(): MiningInfo {
  return { ...miningInfo };
}

export async function startMining(minerAddress: string): Promise<boolean> {
  if (miningInfo.isActive) {
    console.log('挖矿已经在进行中');
    return false;
  }

  miningInfo.isActive = true;
  miningInfo.minerAddress = minerAddress;
  miningInfo.hashesProcessed = 0;
  miningInfo.startTime = Date.now();

  console.log(`开始挖矿，矿工地址: ${minerAddress}`);
  mine();
  return true;
}

export function stopMining(): boolean {
  if (!miningInfo.isActive) {
    console.log('当前没有挖矿活动');
    return false;
  }

  miningInfo.isActive = false;
  miningInfo.minerAddress = null;
  miningInfo.currentBlock = null;
  console.log('挖矿已停止');
  return true;
}

async function mine(): Promise<void> {
  if (!miningInfo.isActive || !miningInfo.minerAddress) {
    return;
  }

  try {
    // 生成下一个区块
    miningInfo.currentBlock = await generateNextBlock(miningInfo.minerAddress);
    let newBlock = miningInfo.currentBlock;

    console.log(`正在挖掘新区块 #${newBlock.index}`);

    // 挖矿过程 - 寻找满足难度要求的nonce
    while (miningInfo.isActive) {
      newBlock.nonce++;
      miningInfo.hashesProcessed++;
      
      // 每1000次哈希计算打印一次进度
      if (miningInfo.hashesProcessed % 1000 === 0) {
        const elapsedTime = (Date.now() - miningInfo.startTime) / 1000;
        const hashRate = miningInfo.hashesProcessed / elapsedTime;
        console.log(`已处理 ${miningInfo.hashesProcessed} 个哈希，哈希率: ${hashRate.toFixed(2)} H/s`);
      }

      // 计算区块哈希
      newBlock.hash = calculateBlockHash(newBlock);

      // 检查哈希是否满足难度要求
      if (isValidBlockHash(newBlock.hash, newBlock.difficulty)) {
        console.log(`成功挖掘区块 #${newBlock.index}，哈希: ${newBlock.hash}`);
        
        // 尝试添加到区块链
        const added = await addBlock(newBlock);
        if (added) {
          console.log(`区块 #${newBlock.index} 已添加到区块链`);
        } else {
          console.log(`区块 #${newBlock.index} 添加失败`);
        }
        
        // 如果挖矿仍在进行，继续挖下一个区块
        if (miningInfo.isActive) {
          setTimeout(() => mine(), 100);
        }
        
        break;
      }
    }
  } catch (error) {
    console.error('挖矿过程中出错:', error);
    if (miningInfo.isActive) {
      setTimeout(() => mine(), 5000);
    }
  }
}
