/**
 * 区块链初始化和核心功能
 */

const { Level } = require('level');
const crypto = require('crypto');
const { logger } = require('../lib/logger');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

// 区块链存储路径
const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data');

/**
 * 初始化区块链实例
 * @param {Object} options - 初始化选项
 * @returns {Object} 区块链实例
 */
function initializeChain(options = {}) {
  const {
    chainId = 'my-cosmos-chain',
    dataDir = DEFAULT_DATA_DIR,
    modules = [],
    consensusParams = {}
  } = options;

  // 确保数据目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info(`Created data directory at ${dataDir}`);
  }

  // 初始化数据库
  const db = new Level(path.join(dataDir, 'chaindata'), { valueEncoding: 'json' });
  
  // 创建事件总线
  const events = new EventEmitter();
  
  // 初始化状态
  let isRunning = false;
  let latestBlockHeight = 0;
  let genesisBlock = null;
  
  // 加载创世区块
  async function loadGenesisBlock() {
    try {
      const genesisPath = path.join(dataDir, 'genesis.json');
      
      if (fs.existsSync(genesisPath)) {
        const genesisData = JSON.parse(fs.readFileSync(genesisPath, 'utf8'));
        genesisBlock = genesisData;
        logger.info(`Loaded genesis block: ${genesisData.chain_id}`);
        return genesisData;
      }
      
      // 如果不存在，创建一个新的创世块
      logger.info('No genesis block found, creating a new one');
      const timestamp = new Date().toISOString();
      const newGenesis = {
        chain_id: chainId,
        initial_height: "1",
        consensus_params: consensusParams,
        app_state: {},
        validators: [],
        app_hash: "",
        genesis_time: timestamp
      };
      
      // 运行所有模块的初始化函数
      for (const module of modules) {
        if (typeof module.initGenesis === 'function') {
          const moduleState = await module.initGenesis();
          newGenesis.app_state[module.name] = moduleState;
        }
      }
      
      // 计算应用状态哈希
      newGenesis.app_hash = calculateAppHash(newGenesis.app_state);
      
      // 保存创世块
      fs.writeFileSync(genesisPath, JSON.stringify(newGenesis, null, 2));
      genesisBlock = newGenesis;
      logger.info(`Created new genesis block for chain: ${chainId}`);
      
      return newGenesis;
    } catch (error) {
      logger.error(`Failed to load or create genesis block: ${error.message}`);
      throw error;
    }
  }
  
  // 计算应用状态哈希
  function calculateAppHash(appState) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(appState));
    return hash.digest('hex');
  }
  
  // 获取最新区块高度
  async function getLatestBlockHeight() {
    if (latestBlockHeight > 0) {
      return latestBlockHeight;
    }
    
    try {
      const heightStr = await db.get('latest_block_height').catch(() => '0');
      latestBlockHeight = parseInt(heightStr, 10) || 0;
      return latestBlockHeight;
    } catch (error) {
      logger.error(`Failed to get latest block height: ${error.message}`);
      return 0;
    }
  }
  
  // 启动区块链服务
  async function start() {
    if (isRunning) {
      logger.warn('Blockchain is already running');
      return;
    }
    
    logger.info(`Starting blockchain with chain ID: ${chainId}`);
    
    try {
      // 加载创世块
      await loadGenesisBlock();
      
      // 获取最新区块高度
      latestBlockHeight = await getLatestBlockHeight();
      
      // 初始化所有模块
      for (const module of modules) {
        if (typeof module.initialize === 'function') {
          await module.initialize({ db, events, chainId });
        }
        logger.info(`Initialized module: ${module.name}`);
      }
      
      // 标记为运行状态
      isRunning = true;
      
      // 如果是新链，需要创建初始区块
      if (latestBlockHeight === 0) {
        await createGenesisBlock();
      }
      
      // 触发启动事件
      events.emit('chain:started', { chainId, blockHeight: latestBlockHeight });
      
      logger.info(`Blockchain started successfully at height ${latestBlockHeight}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start blockchain: ${error.message}`);
      throw error;
    }
  }
  
  // 创建创世区块
  async function createGenesisBlock() {
    logger.info('Creating initial block');
    
    const block = {
      header: {
        height: 1,
        time: new Date().toISOString(),
        chain_id: chainId,
        app_hash: genesisBlock.app_hash
      },
      data: {
        txs: []
      },
      evidence: {
        evidence: []
      },
      last_commit: {
        signatures: []
      }
    };
    
    // 保存区块
    await db.put(`block:1`, block);
    await db.put('latest_block_height', '1');
    latestBlockHeight = 1;
    
    logger.info('Genesis block created and saved');
    events.emit('block:new', { height: 1, block });
    
    return block;
  }
  
  // 停止区块链服务
  async function stop() {
    if (!isRunning) {
      logger.warn('Blockchain is not running');
      return;
    }
    
    logger.info('Stopping blockchain');
    
    try {
      // 关闭所有模块
      for (const module of modules) {
        if (typeof module.shutdown === 'function') {
          await module.shutdown();
        }
      }
      
      // 关闭数据库
      await db.close();
      
      // 标记为非运行状态
      isRunning = false;
      
      // 触发停止事件
      events.emit('chain:stopped', { chainId });
      
      logger.info('Blockchain stopped successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to stop blockchain: ${error.message}`);
      throw error;
    }
  }
  
  // 返回区块链实例
  return {
    chainId,
    db,
    events,
    modules,
    start,
    stop,
    getLatestBlockHeight: () => latestBlockHeight,
    isRunning: () => isRunning,
    getGenesisBlock: () => genesisBlock
  };
}

module.exports = {
  initializeChain
};
