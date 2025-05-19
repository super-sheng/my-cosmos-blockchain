import express from 'express';
import { createWallet, validateAddress } from '../crypto/wallet';
import { getBalance } from '../blockchain/blockchain';
import { getDB } from '../storage/db';

const router = express.Router();

// 创建新钱包
router.post('/create', async (req, res) => {
  try {
    const wallet = await createWallet();
    const db = getDB();
    await db.saveWallet(wallet);
    
    // 返回钱包信息，但隐藏私钥和助记词
    res.status(201).json({
      address: wallet.address,
      mnemonic: wallet.mnemonic, // 在实际应用中，不应该返回助记词，这里为了演示方便
      publicKey: wallet.publicKey
    });
  } catch (error) {
    console.error('创建钱包失败:', error);
    res.status(500).json({ error: '创建钱包失败' });
  }
});

// 获取钱包余额
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!validateAddress(address)) {
      return res.status(400).json({ error: '无效的钱包地址' });
    }
    
    const balance = await getBalance(address);
    res.json({ address, balance });
  } catch (error) {
    console.error('获取余额失败:', error);
    res.status(500).json({ error: '获取余额失败' });
  }
});

// 获取钱包信息
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!validateAddress(address)) {
      return res.status(400).json({ error: '无效的钱包地址' });
    }
    
    const db = getDB();
    const wallet = await db.getWallet(address);
    
    if (!wallet) {
      return res.status(404).json({ error: '钱包不存在' });
    }
    
    // 返回钱包信息，但隐藏私钥和助记词
    res.json({
      address: wallet.address,
      publicKey: wallet.publicKey
    });
  } catch (error) {
    console.error('获取钱包信息失败:', error);
    res.status(500).json({ error: '获取钱包信息失败' });
  }
});

export const walletRoutes = router;
