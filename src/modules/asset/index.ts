/**
 * 资产模块 - 管理区块链上的资产
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../lib/logger';
import { getDB } from '../../storage/db';
import { addToTransactionPool } from '../../blockchain/blockchain';
import { TransactionType } from '../../models/transaction';

const router = express.Router();

interface AssetMetadata {
  [key: string]: any;
}

// 资产记录结构
class Asset {
  id: string;
  name: string;
  description: string;
  owner: string; // 拥有者地址
  value: number; // 资产价值
  metadata: AssetMetadata; // 额外元数据
  createdAt: number;
  updatedAt: number;

  constructor(id: string | null, name: string, description: string, owner: string, value: number, metadata: AssetMetadata = {}) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description;
    this.owner = owner;
    this.value = value;
    this.metadata = metadata;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }
}

// 内存中的资产存储
let assets: Asset[] = [];

/**
 * 创建新资产
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, owner, value, metadata } = req.body;
    
    if (!name || !owner) {
      return res.status(400).json({ error: '资产名称和拥有者地址是必需的' });
    }
    
    // 验证拥有者地址是否存在
    const db = getDB();
    const wallet = await db.getWallet(owner);
    
    if (!wallet) {
      return res.status(404).json({ error: '拥有者钱包地址不存在' });
    }
    
    // 创建新资产
    const asset = new Asset(null, name, description, owner, value, metadata);
    assets.push(asset);
    
    logger.info(`创建了新资产: ${asset.id} (${asset.name})`);
    res.status(201).json(asset);
  } catch (error) {
    logger.error('创建资产失败', error as Error);
    res.status(500).json({ error: '创建资产失败' });
  }
});

/**
 * 获取所有资产
 */
router.get('/', (req: Request, res: Response) => {
  res.json(assets);
});

/**
 * 获取特定资产
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const asset = assets.find(a => a.id === id);
  
  if (!asset) {
    return res.status(404).json({ error: '资产不存在' });
  }
  
  res.json(asset);
});

/**
 * 转移资产所有权
 */
router.post('/:id/transfer', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to, privateKey } = req.body;
    
    if (!from || !to || !privateKey) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const asset = assets.find(a => a.id === id);
    
    if (!asset) {
      return res.status(404).json({ error: '资产不存在' });
    }
    
    if (asset.owner !== from) {
      return res.status(403).json({ error: '您不是该资产的所有者' });
    }
    
    // 创建资产转移交易
    const transaction = {
      id: uuidv4(),
      from,
      to,
      amount: 0, // 资产转移交易金额为0
      timestamp: Date.now(),
      signature: 'ASSET_TRANSFER',
      type: TransactionType.TRANSFER,
      fee: 0.001,
      metadata: {
        type: 'ASSET_TRANSFER',
        assetId: asset.id
      }
    };
    
    // 将交易添加到交易池
    const success = await addToTransactionPool(transaction);
    
    if (success) {
      // 更新资产所有者
      asset.owner = to;
      asset.updatedAt = Date.now();
      
      logger.info(`资产 ${asset.id} 所有权已从 ${from} 转移到 ${to}`);
      res.json({
        message: '资产转移交易已提交',
        transaction: {
          id: transaction.id,
          from: transaction.from,
          to: transaction.to,
          timestamp: transaction.timestamp
        },
        asset
      });
    } else {
      res.status(400).json({ error: '资产转移交易提交失败' });
    }
  } catch (error) {
    logger.error('资产转移失败', error as Error);
    res.status(500).json({ error: '资产转移失败' });
  }
});

/**
 * 更新资产信息
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, value, metadata } = req.body;
  
  const assetIndex = assets.findIndex(a => a.id === id);
  
  if (assetIndex === -1) {
    return res.status(404).json({ error: '资产不存在' });
  }
  
  // 更新资产信息
  if (name) assets[assetIndex].name = name;
  if (description) assets[assetIndex].description = description;
  if (value !== undefined) assets[assetIndex].value = value;
  if (metadata) assets[assetIndex].metadata = { ...assets[assetIndex].metadata, ...metadata };
  
  assets[assetIndex].updatedAt = Date.now();
  
  logger.info(`资产 ${id} 信息已更新`);
  res.json(assets[assetIndex]);
});

/**
 * 删除资产
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const assetIndex = assets.findIndex(a => a.id === id);
  
  if (assetIndex === -1) {
    return res.status(404).json({ error: '资产不存在' });
  }
  
  // 删除资产
  const deletedAsset = assets.splice(assetIndex, 1)[0];
  
  logger.info(`资产 ${id} (${deletedAsset.name}) 已删除`);
  res.json({ message: '资产已删除', asset: deletedAsset });
});

// 导出路由
export default router;
