import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, TransactionType, createTransactionData } from '../models/transaction';
import { signTransaction } from '../crypto/signature';
import { addToTransactionPool, getTransactionPool } from '../blockchain/blockchain';
import { getDB } from '../storage/db';

const router = express.Router();

// 发送交易
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { from, to, amount, privateKey } = req.body;
    
    if (!from || !to || !amount || !privateKey) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查金额是否有效
    if (amount <= 0) {
      return res.status(400).json({ error: '金额必须大于0' });
    }
    
    // 从DB中获取钱包信息
    const db = getDB();
    const wallet = await db.getWallet(from);
    
    if (!wallet) {
      return res.status(404).json({ error: '发送者钱包不存在' });
    }
    
    // 提取助记词（在实际应用中，应该使用更安全的方式处理私钥）
    // 这里简化处理，假设privateKey包含了助记词信息
    const mnemonic = privateKey.replace('PRIVATE_KEY_', '');
    const mnemonic_decoded = Buffer.from(mnemonic, 'hex').toString();
    
    // 创建交易数据
    const txData = createTransactionData(from, to, amount);
    
    // 签名交易
    const signature = await signTransaction(txData, mnemonic_decoded);
    
    // 创建完整交易
    const transaction: Transaction = {
      id: uuidv4(),
      ...txData,
      signature,
      publicKey: wallet.publicKey
    };
    
    // 添加到交易池
    const success = await addToTransactionPool(transaction);
    
    if (success) {
      res.status(201).json({
        message: '交易已提交',
        transaction: {
          id: transaction.id,
          from: transaction.from,
          to: transaction.to,
          amount: transaction.amount,
          timestamp: transaction.timestamp,
          type: transaction.type
        }
      });
    } else {
      res.status(400).json({ error: '交易提交失败，可能是余额不足' });
    }
  } catch (error) {
    console.error('发送交易失败:', error);
    res.status(500).json({ error: '发送交易失败' });
  }
});

// 获取待处理交易
router.get('/pending', (req: Request, res: Response) => {
  try {
    const transactions = getTransactionPool();
    res.json({ transactions });
  } catch (error) {
    console.error('获取待处理交易失败:', error);
    res.status(500).json({ error: '获取待处理交易失败' });
  }
});

// 获取交易详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDB();
    const transaction = await db.getTransaction(id);
    
    if (!transaction) {
      return res.status(404).json({ error: '交易不存在' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('获取交易详情失败:', error);
    res.status(500).json({ error: '获取交易详情失败' });
  }
});

export const transactionRoutes = router;
