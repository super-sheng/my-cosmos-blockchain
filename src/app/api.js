/**
 * API路由定义
 */

const express = require('express');
const { logger } = require('../lib/logger');

/**
 * 创建API路由处理器
 * @param {Object} blockchain - 区块链实例
 * @returns {Router} Express路由器
 */
function createApiRouter(blockchain) {
  const router = express.Router();
  
  // 添加请求日志中间件
  router.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });
  
  // 路由: 获取区块链信息
  router.get('/info', (req, res) => {
    res.json({
      chainId: blockchain.chainId,
      latestBlockHeight: blockchain.getLatestBlockHeight(),
      isRunning: blockchain.isRunning(),
      modules: blockchain.modules.map(m => m.name)
    });
  });
  
  // 路由: 获取创世区块
  router.get('/genesis', (req, res) => {
    const genesis = blockchain.getGenesisBlock();
    if (!genesis) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Genesis block not found'
      });
    }
    
    res.json(genesis);
  });
  
  // 注册每个模块的API路由
  for (const module of blockchain.modules) {
    if (module.registerRoutes) {
      logger.info(`Registering API routes for module: ${module.name}`);
      module.registerRoutes(router, blockchain);
    }
  }
  
  // 查询指定高度的区块
  router.get('/blocks/:height', async (req, res) => {
    try {
      const height = parseInt(req.params.height, 10);
      
      if (isNaN(height) || height < 1) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Invalid block height'
        });
      }
      
      const block = await blockchain.db.get(`block:${height}`).catch(() => null);
      
      if (!block) {
        return res.status(404).json({
          error: 'NotFound',
          message: `Block at height ${height} not found`
        });
      }
      
      res.json(block);
    } catch (error) {
      logger.error(`Error fetching block: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch block data'
      });
    }
  });
  
  // 获取最新区块
  router.get('/blocks/latest', async (req, res) => {
    try {
      const height = blockchain.getLatestBlockHeight();
      
      if (height === 0) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'No blocks available'
        });
      }
      
      const block = await blockchain.db.get(`block:${height}`).catch(() => null);
      
      if (!block) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Latest block not found'
        });
      }
      
      res.json(block);
    } catch (error) {
      logger.error(`Error fetching latest block: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch latest block data'
      });
    }
  });
  
  // 错误处理中间件
  router.use((err, req, res, next) => {
    logger.error(`API Error: ${err.message}`);
    res.status(err.status || 500).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred'
    });
  });
  
  return router;
}

module.exports = createApiRouter;
