/**
 * my-cosmos-blockchain
 * 基于JavaScript的Cosmos区块链实现
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger } = require('./lib/logger');
const { initializeChain } = require('./app/chain');
const apiRoutes = require('./app/api');

// 导入模块
const assetModule = require('./modules/asset');
const votingModule = require('./modules/voting');
const bankModule = require('./modules/bank');

// 初始化应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 初始化区块链
const blockchain = initializeChain({
  chainId: process.env.CHAIN_ID || 'my-cosmos-chain',
  modules: [
    bankModule,
    assetModule,
    votingModule
  ]
});

// 注册API路由
app.use('/api', apiRoutes(blockchain));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    chainId: blockchain.chainId,
    latestBlockHeight: blockchain.getLatestBlockHeight(),
    version: require('../package.json').version
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error(`API Error: ${err.message}`);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred'
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  logger.info(`🚀 my-cosmos-blockchain node started on port ${PORT}`);
  logger.info(`Chain ID: ${blockchain.chainId}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动区块链服务
  blockchain.start()
    .then(() => {
      logger.info('✅ Blockchain services initialized successfully');
    })
    .catch(err => {
      logger.error(`❌ Failed to initialize blockchain: ${err.message}`);
      process.exit(1);
    });
});

// 处理终止信号
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  await blockchain.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  await blockchain.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, blockchain };
