import express from 'express';
import { startMining, stopMining, getMiningInfo } from '../mining/miner';
import { validateAddress } from '../crypto/wallet';

const router = express.Router();

// 开始挖矿
router.post('/start', async (req, res) => {
  try {
    const { minerAddress } = req.body;
    
    if (!minerAddress) {
      return res.status(400).json({ error: '缺少矿工地址' });
    }
    
    if (!validateAddress(minerAddress)) {
      return res.status(400).json({ error: '无效的矿工地址' });
    }
    
    const success = await startMining(minerAddress);
    
    if (success) {
      res.json({ message: '挖矿已启动', minerAddress });
    } else {
      res.status(400).json({ error: '挖矿启动失败，可能已经在进行中' });
    }
  } catch (error) {
    console.error('启动挖矿失败:', error);
    res.status(500).json({ error: '启动挖矿失败' });
  }
});

// 停止挖矿
router.post('/stop', (req, res) => {
  try {
    const success = stopMining();
    
    if (success) {
      res.json({ message: '挖矿已停止' });
    } else {
      res.status(400).json({ error: '挖矿停止失败，可能没有进行中的挖矿' });
    }
  } catch (error) {
    console.error('停止挖矿失败:', error);
    res.status(500).json({ error: '停止挖矿失败' });
  }
});

// 获取挖矿状态
router.get('/status', (req, res) => {
  try {
    const miningInfo = getMiningInfo();
    
    // 计算哈希率
    let hashRate = 0;
    if (miningInfo.isActive && miningInfo.startTime > 0) {
      const elapsedTime = (Date.now() - miningInfo.startTime) / 1000;
      hashRate = miningInfo.hashesProcessed / elapsedTime;
    }
    
    res.json({
      isActive: miningInfo.isActive,
      minerAddress: miningInfo.minerAddress,
      hashesProcessed: miningInfo.hashesProcessed,
      hashRate: hashRate.toFixed(2),
      currentBlockIndex: miningInfo.currentBlock?.index || null
    });
  } catch (error) {
    console.error('获取挖矿状态失败:', error);
    res.status(500).json({ error: '获取挖矿状态失败' });
  }
});

export const miningRoutes = router;
