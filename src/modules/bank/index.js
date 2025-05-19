/**
 * 银行模块
 * 
 * 该模块实现了基本的代币转账和余额查询功能
 */

const { createModuleLogger } = require('../../lib/logger');
const logger = createModuleLogger('bank');

// 模块名称
const MODULE_NAME = 'bank';

// 帐户前缀（用于数据库键）
const ACCOUNT_KEY_PREFIX = 'account:';

/**
 * 初始化创世状态
 * @returns {Object} 初始状态
 */
async function initGenesis() {
  logger.info('Initializing bank module genesis state');
  
  return {
    params: {
      send_enabled: true,
      default_send_fee: "0.01",
      min_send_amount: "0.000001"
    },
    balances: [
      {
        address: "cosmos1genesis",
        coins: [
          {
            denom: "mcoin",
            amount: "1000000000"
          }
        ]
      },
      {
        address: "cosmos1faucet",
        coins: [
          {
            denom: "mcoin",
            amount: "10000000"
          }
        ]
      }
    ]
  };
}

/**
 * 初始化模块
 * @param {Object} options - 初始化选项
 */
async function initialize(options) {
  const { db, events, chainId } = options;
  
  logger.info('Initializing bank module');
  
  // 存储模块实例变量
  this.db = db;
  this.events = events;
  this.chainId = chainId;
  
  // 注册事件监听器
  events.on('tx:send', handleSendTransaction.bind(this));
  
  logger.info('Bank module initialized');
  
  // 初始化创世账户
  const genesis = await this.db.get('genesis').catch(() => null);
  
  if (genesis && genesis.app_state && genesis.app_state.bank) {
    const { balances } = genesis.app_state.bank;
    
    if (Array.isArray(balances)) {
      for (const account of balances) {
        await this.db.put(`${ACCOUNT_KEY_PREFIX}${account.address}`, {
          address: account.address,
          coins: account.coins || [],
          sequence: 0,
          account_number: 0,
          created_at: Date.now()
        });
        
        logger.info(`Initialized account ${account.address} with ${JSON.stringify(account.coins)}`);
      }
    }
  }
}

/**
 * 处理发送交易
 * @param {Object} tx - 交易数据
 */
async function handleSendTransaction(tx) {
  logger.info(`Processing send tx: ${JSON.stringify(tx)}`);
  
  try {
    const { from_address, to_address, amount } = tx;
    
    if (!from_address || !to_address || !amount) {
      throw new Error('Missing required fields: from_address, to_address, amount');
    }
    
    if (from_address === to_address) {
      throw new Error('Cannot send to same address');
    }
    
    // 获取发送者账户
    const fromAccount = await this.db.get(`${ACCOUNT_KEY_PREFIX}${from_address}`)
      .catch(() => ({
        address: from_address,
        coins: [],
        sequence: 0,
        account_number: 0,
        created_at: Date.now()
      }));
    
    // 验证余额
    const amountValue = parseFloat(amount.amount);
    const coinIndex = fromAccount.coins.findIndex(c => c.denom === amount.denom);
    
    if (coinIndex === -1 || parseFloat(fromAccount.coins[coinIndex].amount) < amountValue) {
      throw new Error(`Insufficient balance of ${amount.denom}`);
    }
    
    // 获取接收者账户
    const toAccount = await this.db.get(`${ACCOUNT_KEY_PREFIX}${to_address}`)
      .catch(() => ({
        address: to_address,
        coins: [],
        sequence: 0,
        account_number: 0,
        created_at: Date.now()
      }));
    
    // 更新发送者余额
    fromAccount.coins[coinIndex].amount = (parseFloat(fromAccount.coins[coinIndex].amount) - amountValue).toString();
    fromAccount.sequence += 1;
    
    // 更新接收者余额
    const toCoinIndex = toAccount.coins.findIndex(c => c.denom === amount.denom);
    
    if (toCoinIndex === -1) {
      toAccount.coins.push({
        denom: amount.denom,
        amount: amount.amount
      });
    } else {
      toAccount.coins[toCoinIndex].amount = (parseFloat(toAccount.coins[toCoinIndex].amount) + amountValue).toString();
    }
    
    // 保存账户状态
    await this.db.put(`${ACCOUNT_KEY_PREFIX}${from_address}`, fromAccount);
    await this.db.put(`${ACCOUNT_KEY_PREFIX}${to_address}`, toAccount);
    
    // 触发事件
    this.events.emit('bank:coins_sent', {
      from_address,
      to_address,
      amount
    });
    
    logger.info(`Sent ${amount.amount} ${amount.denom} from ${from_address} to ${to_address}`);
    
    return {
      success: true,
      from: fromAccount,
      to: toAccount,
      amount
    };
  } catch (error) {
    logger.error(`Failed to process send transaction: ${error.message}`);
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
  
  // 获取账户余额
  router.get('/bank/balances/:address', async (req, res) => {
    try {
      const address = req.params.address;
      
      const account = await db.get(`${ACCOUNT_KEY_PREFIX}${address}`)
        .catch(() => null);
      
      if (!account) {
        return res.json({
          address,
          coins: []
        });
      }
      
      res.json({
        address: account.address,
        coins: account.coins || []
      });
    } catch (error) {
      logger.error(`Error fetching balance: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch account balance'
      });
    }
  });
  
  // 获取账户详情
  router.get('/bank/accounts/:address', async (req, res) => {
    try {
      const address = req.params.address;
      
      const account = await db.get(`${ACCOUNT_KEY_PREFIX}${address}`)
        .catch(() => null);
      
      if (!account) {
        return res.status(404).json({
          error: 'NotFound',
          message: `Account ${address} not found`
        });
      }
      
      res.json(account);
    } catch (error) {
      logger.error(`Error fetching account: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch account'
      });
    }
  });
  
  // 获取所有账户
  router.get('/bank/accounts', async (req, res) => {
    try {
      const accounts = [];
      
      // 创建账户前缀流
      const stream = db.createReadStream({
        gt: ACCOUNT_KEY_PREFIX,
        lt: ACCOUNT_KEY_PREFIX + '\uffff'
      });
      
      // 收集所有账户
      for await (const data of stream) {
        accounts.push(data.value);
      }
      
      res.json(accounts);
    } catch (error) {
      logger.error(`Error fetching accounts: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch accounts'
      });
    }
  });
  
  // 转账
  router.post('/bank/send', async (req, res) => {
    try {
      const { from_address, to_address, amount } = req.body;
      
      if (!from_address || !to_address || !amount || !amount.denom || !amount.amount) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Missing required fields: from_address, to_address, amount (with denom and amount)'
        });
      }
      
      // 触发发送交易
      events.emit('tx:send', {
        from_address,
        to_address,
        amount
      });
      
      res.status(202).json({
        success: true,
        message: 'Send transaction submitted'
      });
    } catch (error) {
      logger.error(`Error sending coins: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to send coins'
      });
    }
  });
  
  // 水龙头（免费获取测试代币）
  router.post('/bank/faucet', async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Address is required'
        });
      }
      
      // 获取水龙头账户
      const faucetAccount = await db.get(`${ACCOUNT_KEY_PREFIX}cosmos1faucet`)
        .catch(() => null);
      
      if (!faucetAccount || !faucetAccount.coins || !faucetAccount.coins.length) {
        return res.status(503).json({
          error: 'ServiceUnavailable',
          message: 'Faucet is not available'
        });
      }
      
      // 发送测试代币
      events.emit('tx:send', {
        from_address: 'cosmos1faucet',
        to_address: address,
        amount: {
          denom: 'mcoin',
          amount: '100'
        }
      });
      
      res.status(202).json({
        success: true,
        message: 'Faucet tokens sent'
      });
    } catch (error) {
      logger.error(`Error using faucet: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to send faucet tokens'
      });
    }
  });
}

/**
 * 模块关闭函数
 */
async function shutdown() {
  logger.info('Shutting down bank module');
  // 清理资源或执行其他关闭操作
}

module.exports = {
  name: MODULE_NAME,
  initGenesis,
  initialize,
  registerRoutes,
  shutdown
};
