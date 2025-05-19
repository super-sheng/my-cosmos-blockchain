/**
 * 资产模块
 * 
 * 该模块实现了资产创建、转移、更新和查询功能
 */

const { v4: uuidv4 } = require('uuid');
const { createModuleLogger } = require('../lib/logger');
const logger = createModuleLogger('asset');

// 模块名称
const MODULE_NAME = 'asset';

// 资产前缀（用于数据库键）
const ASSET_KEY_PREFIX = 'asset:';
const OWNER_ASSETS_PREFIX = 'owner_assets:';

/**
 * 初始化创世状态
 * @returns {Object} 初始状态
 */
async function initGenesis() {
  logger.info('Initializing asset module genesis state');
  
  return {
    params: {
      min_asset_name_length: 3,
      max_asset_name_length: 64,
      max_description_length: 1024
    },
    assets: []
  };
}

/**
 * 初始化模块
 * @param {Object} options - 初始化选项
 */
async function initialize(options) {
  const { db, events, chainId } = options;
  
  logger.info('Initializing asset module');
  
  // 存储模块实例变量
  this.db = db;
  this.events = events;
  this.chainId = chainId;
  
  // 注册事件监听器
  events.on('tx:create_asset', handleCreateAsset.bind(this));
  events.on('tx:update_asset', handleUpdateAsset.bind(this));
  events.on('tx:transfer_asset', handleTransferAsset.bind(this));
  events.on('tx:delete_asset', handleDeleteAsset.bind(this));
  
  logger.info('Asset module initialized');
}

/**
 * 处理创建资产交易
 * @param {Object} tx - 交易数据
 */
async function handleCreateAsset(tx) {
  logger.info(`Processing create asset tx: ${JSON.stringify(tx)}`);
  
  try {
    const { creator, name, description, price } = tx;
    
    // 验证资产数据
    if (!name || name.length < 3) {
      throw new Error('Asset name must be at least 3 characters');
    }
    
    if (!creator) {
      throw new Error('Creator address is required');
    }
    
    // 创建新资产
    const assetId = uuidv4();
    const timestamp = Date.now();
    
    const asset = {
      id: assetId,
      name,
      description: description || '',
      owner: creator,
      price: price || '0',
      created_at: timestamp,
      updated_at: timestamp
    };
    
    // 存储资产数据
    await this.db.put(`${ASSET_KEY_PREFIX}${assetId}`, asset);
    
    // 更新所有者的资产列表
    const ownerAssets = await this.db.get(`${OWNER_ASSETS_PREFIX}${creator}`)
      .catch(() => ({ assets: [] }));
    
    ownerAssets.assets.push(assetId);
    await this.db.put(`${OWNER_ASSETS_PREFIX}${creator}`, ownerAssets);
    
    // 触发资产创建事件
    this.events.emit('asset:created', asset);
    
    logger.info(`Asset created: ${assetId}`);
    return asset;
  } catch (error) {
    logger.error(`Failed to create asset: ${error.message}`);
    throw error;
  }
}

/**
 * 处理更新资产交易
 * @param {Object} tx - 交易数据
 */
async function handleUpdateAsset(tx) {
  logger.info(`Processing update asset tx: ${JSON.stringify(tx)}`);
  
  try {
    const { creator, id, name, description, price } = tx;
    
    // 获取现有资产
    const asset = await this.db.get(`${ASSET_KEY_PREFIX}${id}`)
      .catch(() => null);
    
    if (!asset) {
      throw new Error(`Asset ${id} not found`);
    }
    
    // 验证所有权
    if (asset.owner !== creator) {
      throw new Error('Only the owner can update the asset');
    }
    
    // 更新资产数据
    const updatedAsset = {
      ...asset,
      name: name || asset.name,
      description: description !== undefined ? description : asset.description,
      price: price || asset.price,
      updated_at: Date.now()
    };
    
    // 存储更新后的资产
    await this.db.put(`${ASSET_KEY_PREFIX}${id}`, updatedAsset);
    
    // 触发资产更新事件
    this.events.emit('asset:updated', updatedAsset);
    
    logger.info(`Asset updated: ${id}`);
    return updatedAsset;
  } catch (error) {
    logger.error(`Failed to update asset: ${error.message}`);
    throw error;
  }
}

/**
 * 处理资产转移交易
 * @param {Object} tx - 交易数据
 */
async function handleTransferAsset(tx) {
  logger.info(`Processing transfer asset tx: ${JSON.stringify(tx)}`);
  
  try {
    const { creator, id, new_owner } = tx;
    
    if (!new_owner) {
      throw new Error('New owner address is required');
    }
    
    // 获取现有资产
    const asset = await this.db.get(`${ASSET_KEY_PREFIX}${id}`)
      .catch(() => null);
    
    if (!asset) {
      throw new Error(`Asset ${id} not found`);
    }
    
    // 验证所有权
    if (asset.owner !== creator) {
      throw new Error('Only the owner can transfer the asset');
    }
    
    // 更新资产所有者
    const updatedAsset = {
      ...asset,
      owner: new_owner,
      updated_at: Date.now()
    };
    
    // 存储更新后的资产
    await this.db.put(`${ASSET_KEY_PREFIX}${id}`, updatedAsset);
    
    // 从旧所有者的资产列表中移除
    const oldOwnerAssets = await this.db.get(`${OWNER_ASSETS_PREFIX}${creator}`)
      .catch(() => ({ assets: [] }));
    
    oldOwnerAssets.assets = oldOwnerAssets.assets.filter(assetId => assetId !== id);
    await this.db.put(`${OWNER_ASSETS_PREFIX}${creator}`, oldOwnerAssets);
    
    // 添加到新所有者的资产列表
    const newOwnerAssets = await this.db.get(`${OWNER_ASSETS_PREFIX}${new_owner}`)
      .catch(() => ({ assets: [] }));
    
    newOwnerAssets.assets.push(id);
    await this.db.put(`${OWNER_ASSETS_PREFIX}${new_owner}`, newOwnerAssets);
    
    // 触发资产转移事件
    this.events.emit('asset:transferred', {
      asset: updatedAsset,
      from: creator,
      to: new_owner
    });
    
    logger.info(`Asset transferred: ${id} from ${creator} to ${new_owner}`);
    return updatedAsset;
  } catch (error) {
    logger.error(`Failed to transfer asset: ${error.message}`);
    throw error;
  }
}

/**
 * 处理删除资产交易
 * @param {Object} tx - 交易数据
 */
async function handleDeleteAsset(tx) {
  logger.info(`Processing delete asset tx: ${JSON.stringify(tx)}`);
  
  try {
    const { creator, id } = tx;
    
    // 获取现有资产
    const asset = await this.db.get(`${ASSET_KEY_PREFIX}${id}`)
      .catch(() => null);
    
    if (!asset) {
      throw new Error(`Asset ${id} not found`);
    }
    
    // 验证所有权
    if (asset.owner !== creator) {
      throw new Error('Only the owner can delete the asset');
    }
    
    // 删除资产
    await this.db.del(`${ASSET_KEY_PREFIX}${id}`);
    
    // 从所有者的资产列表中移除
    const ownerAssets = await this.db.get(`${OWNER_ASSETS_PREFIX}${creator}`)
      .catch(() => ({ assets: [] }));
    
    ownerAssets.assets = ownerAssets.assets.filter(assetId => assetId !== id);
    await this.db.put(`${OWNER_ASSETS_PREFIX}${creator}`, ownerAssets);
    
    // 触发资产删除事件
    this.events.emit('asset:deleted', {
      id,
      owner: creator
    });
    
    logger.info(`Asset deleted: ${id}`);
    return { success: true, id };
  } catch (error) {
    logger.error(`Failed to delete asset: ${error.message}`);
    throw error;
  }
}

/**
 * 注册API路由
 * @param {Router} router - Express路由器
 * @param {Object} blockchain - 区块链实例
 */
function registerRoutes(router, blockchain) {
  const { db, events } = blockchain;
  
  // 获取所有资产
  router.get('/assets', async (req, res) => {
    try {
      const assets = [];
      
      // 创建资产前缀流
      const stream = db.createReadStream({
        gt: ASSET_KEY_PREFIX,
        lt: ASSET_KEY_PREFIX + '\uffff'
      });
      
      // 收集所有资产
      for await (const data of stream) {
        assets.push(data.value);
      }
      
      res.json(assets);
    } catch (error) {
      logger.error(`Error fetching assets: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch assets'
      });
    }
  });
  
  // 获取单个资产
  router.get('/assets/:id', async (req, res) => {
    try {
      const assetId = req.params.id;
      
      const asset = await db.get(`${ASSET_KEY_PREFIX}${assetId}`)
        .catch(() => null);
      
      if (!asset) {
        return res.status(404).json({
          error: 'NotFound',
          message: `Asset ${assetId} not found`
        });
      }
      
      res.json(asset);
    } catch (error) {
      logger.error(`Error fetching asset: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch asset'
      });
    }
  });
  
  // 获取所有者的资产
  router.get('/assets/owner/:address', async (req, res) => {
    try {
      const ownerAddress = req.params.address;
      
      const ownerAssetsList = await db.get(`${OWNER_ASSETS_PREFIX}${ownerAddress}`)
        .catch(() => ({ assets: [] }));
      
      if (!ownerAssetsList.assets.length) {
        return res.json([]);
      }
      
      // 获取所有资产详情
      const assets = [];
      for (const assetId of ownerAssetsList.assets) {
        const asset = await db.get(`${ASSET_KEY_PREFIX}${assetId}`)
          .catch(() => null);
        
        if (asset) {
          assets.push(asset);
        }
      }
      
      res.json(assets);
    } catch (error) {
      logger.error(`Error fetching owner assets: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch owner assets'
      });
    }
  });
  
  // 创建资产
  router.post('/assets', async (req, res) => {
    try {
      const { creator, name, description, price } = req.body;
      
      if (!creator || !name) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Creator and name are required'
        });
      }
      
      // 触发创建资产交易
      events.emit('tx:create_asset', {
        creator,
        name,
        description,
        price
      });
      
      res.status(202).json({
        success: true,
        message: 'Asset creation transaction submitted'
      });
    } catch (error) {
      logger.error(`Error creating asset: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to create asset'
      });
    }
  });
  
  // 转移资产
  router.post('/assets/:id/transfer', async (req, res) => {
    try {
      const assetId = req.params.id;
      const { creator, new_owner } = req.body;
      
      if (!creator || !new_owner) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Creator and new_owner are required'
        });
      }
      
      // 触发转移资产交易
      events.emit('tx:transfer_asset', {
        creator,
        id: assetId,
        new_owner
      });
      
      res.status(202).json({
        success: true,
        message: 'Asset transfer transaction submitted'
      });
    } catch (error) {
      logger.error(`Error transferring asset: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to transfer asset'
      });
    }
  });
  
  // 更新资产
  router.put('/assets/:id', async (req, res) => {
    try {
      const assetId = req.params.id;
      const { creator, name, description, price } = req.body;
      
      if (!creator) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Creator is required'
        });
      }
      
      // 触发更新资产交易
      events.emit('tx:update_asset', {
        creator,
        id: assetId,
        name,
        description,
        price
      });
      
      res.status(202).json({
        success: true,
        message: 'Asset update transaction submitted'
      });
    } catch (error) {
      logger.error(`Error updating asset: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to update asset'
      });
    }
  });
  
  // 删除资产
  router.delete('/assets/:id', async (req, res) => {
    try {
      const assetId = req.params.id;
      const { creator } = req.body;
      
      if (!creator) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Creator is required'
        });
      }
      
      // 触发删除资产交易
      events.emit('tx:delete_asset', {
        creator,
        id: assetId
      });
      
      res.status(202).json({
        success: true,
        message: 'Asset deletion transaction submitted'
      });
    } catch (error) {
      logger.error(`Error deleting asset: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to delete asset'
      });
    }
  });
}

/**
 * 模块关闭函数
 */
async function shutdown() {
  logger.info('Shutting down asset module');
  // 清理资源或执行其他关闭操作
}

module.exports = {
  name: MODULE_NAME,
  initGenesis,
  initialize,
  registerRoutes,
  shutdown
};
