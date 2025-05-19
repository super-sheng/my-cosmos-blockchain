import express, { Request, Response } from 'express';
import { getBlockchain, getLatestBlock, isBlockchainValid } from '../blockchain/blockchain';

const router = express.Router();

// 获取区块链信息
router.get('/info', async (req: Request, res: Response) => {
  try {
    const lastBlock = await getLatestBlock();
    const isValid = await isBlockchainValid();
    
    res.json({
      currentBlockHeight: lastBlock.index,
      latestBlockHash: lastBlock.hash,
      difficulty: lastBlock.difficulty,
      isValid
    });
  } catch (error) {
    console.error('获取区块链信息失败:', error);
    res.status(500).json({ error: '获取区块链信息失败' });
  }
});

// 获取所有区块
router.get('/blocks', async (req: Request, res: Response) => {
  try {
    const blockchain = await getBlockchain();
    res.json({ blocks: blockchain });
  } catch (error) {
    console.error('获取区块列表失败:', error);
    res.status(500).json({ error: '获取区块列表失败' });
  }
});

// 获取特定区块
router.get('/block/:index', async (req: Request, res: Response) => {
  try {
    const index = parseInt(req.params.index);
    
    if (isNaN(index)) {
      return res.status(400).json({ error: '无效的区块索引' });
    }
    
    const blockchain = await getBlockchain();
    const block = blockchain.find(b => b.index === index);
    
    if (!block) {
      return res.status(404).json({ error: '区块不存在' });
    }
    
    res.json(block);
  } catch (error) {
    console.error('获取区块信息失败:', error);
    res.status(500).json({ error: '获取区块信息失败' });
  }
});

// 验证区块链
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const isValid = await isBlockchainValid();
    res.json({ isValid });
  } catch (error) {
    console.error('验证区块链失败:', error);
    res.status(500).json({ error: '验证区块链失败' });
  }
});

export const blockchainRoutes = router;
