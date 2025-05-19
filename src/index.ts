import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { logger } from './lib/logger';
import { initBlockchain } from './blockchain/blockchain';
import { walletRoutes } from './api/wallet';
import { transactionRoutes } from './api/transaction';
import { miningRoutes } from './api/mining';
import { blockchainRoutes } from './api/blockchain';
import assetRoutes from './modules/asset';

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(bodyParser.json());

// 路由
app.use('/api/wallet', walletRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/asset', assetRoutes);

// 首页
app.get('/', (_, res) => {
  res.send('欢迎使用My Cosmos Blockchain');
});

// 初始化区块链
initBlockchain().then(() => {
  // 启动服务器
  app.listen(PORT, () => {
    logger.info(`区块链节点已启动，监听端口: ${PORT}`);
    console.log(`区块链节点已启动，监听端口: ${PORT}`);
  });
}).catch(error => {
  logger.error('区块链初始化失败', error);
  console.error('区块链初始化失败:', error);
  process.exit(1);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', error);
  console.error('未捕获的异常:', error);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, _) => {
  logger.error(`未处理的Promise拒绝: ${reason}`);
  console.error('未处理的Promise拒绝:', reason);
});
