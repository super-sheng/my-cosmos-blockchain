/**
 * 投票治理模块
 * 
 * 该模块实现了基本的链上治理和投票功能
 */

const { v4: uuidv4 } = require('uuid');
const { createModuleLogger } = require('../../lib/logger');
const logger = createModuleLogger('voting');

// 模块名称
const MODULE_NAME = 'voting';

// 提案前缀和投票前缀
const PROPOSAL_KEY_PREFIX = 'proposal:';
const VOTE_KEY_PREFIX = 'vote:';

// 提案状态
const ProposalStatus = {
  VOTING_PERIOD: 'VOTING_PERIOD',
  PASSED: 'PASSED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED'
};

// 投票选项
const VoteOption = {
  YES: 'YES',
  NO: 'NO',
  ABSTAIN: 'ABSTAIN',
  NO_WITH_VETO: 'NO_WITH_VETO'
};

// 默认投票参数
const DEFAULT_VOTING_PARAMS = {
  voting_period: 60 * 60 * 24 * 3, // 3天（秒）
  quorum: "0.334", // 33.4%
  threshold: "0.5", // 50%
  veto_threshold: "0.334" // 33.4%
};

/**
 * 初始化创世状态
 * @returns {Object} 初始状态
 */
async function initGenesis() {
  logger.info('Initializing voting module genesis state');
  
  return {
    params: DEFAULT_VOTING_PARAMS,
    proposals: [],
    votes: []
  };
}

/**
 * 初始化模块
 * @param {Object} options - 初始化选项
 */
async function initialize(options) {
  const { db, events, chainId } = options;
  
  logger.info('Initializing voting module');
  
  // 存储模块实例变量
  this.db = db;
  this.events = events;
  this.chainId = chainId;
  
  // 注册事件监听器
  events.on('tx:submit_proposal', handleSubmitProposal.bind(this));
  events.on('tx:vote', handleVote.bind(this));
  
  // 启动定时任务检查提案状态
  setInterval(checkProposalsStatus.bind(this), 60000); // 每分钟检查一次
  
  logger.info('Voting module initialized');
}

/**
 * 处理提交提案交易
 * @param {Object} tx - 交易数据
 */
async function handleSubmitProposal(tx) {
  logger.info(`Processing submit proposal tx: ${JSON.stringify(tx)}`);
  
  try {
    const { proposer, title, description, type, deposit } = tx;
    
    // 基本验证
    if (!proposer || !title || !description || !type) {
      throw new Error('Missing required fields: proposer, title, description, type');
    }
    
    // 创建新提案
    const proposalId = uuidv4();
    const timestamp = Date.now();
    const votingEndTime = timestamp + DEFAULT_VOTING_PARAMS.voting_period * 1000;
    
    const proposal = {
      id: proposalId,
      title,
      description,
      type,
      proposer,
      status: ProposalStatus.VOTING_PERIOD,
      submit_time: timestamp,
      voting_end_time: votingEndTime,
      deposit: deposit || { denom: 'mcoin', amount: '0' },
      final_tally_result: {
        yes: '0',
        no: '0',
        abstain: '0',
        no_with_veto: '0'
      },
      total_votes: 0
    };
    
    // 存储提案
    await this.db.put(`${PROPOSAL_KEY_PREFIX}${proposalId}`, proposal);
    
    // 触发提案提交事件
    this.events.emit('voting:proposal_submitted', proposal);
    
    logger.info(`Proposal submitted: ${proposalId}`);
    return proposal;
  } catch (error) {
    logger.error(`Failed to submit proposal: ${error.message}`);
    throw error;
  }
}

/**
 * 处理投票交易
 * @param {Object} tx - 交易数据
 */
async function handleVote(tx) {
  logger.info(`Processing vote tx: ${JSON.stringify(tx)}`);
  
  try {
    const { voter, proposal_id, option } = tx;
    
    // 基本验证
    if (!voter || !proposal_id || !option) {
      throw new Error('Missing required fields: voter, proposal_id, option');
    }
    
    // 检查投票选项是否有效
    if (!Object.values(VoteOption).includes(option)) {
      throw new Error(`Invalid vote option: ${option}`);
    }
    
    // 获取提案
    const proposal = await this.db.get(`${PROPOSAL_KEY_PREFIX}${proposal_id}`)
      .catch(() => null);
    
    if (!proposal) {
      throw new Error(`Proposal ${proposal_id} not found`);
    }
    
    // 检查提案是否在投票期
    if (proposal.status !== ProposalStatus.VOTING_PERIOD) {
      throw new Error(`Proposal ${proposal_id} is not in voting period`);
    }
    
    // 检查是否已经投过票
    const voteKey = `${VOTE_KEY_PREFIX}${proposal_id}:${voter}`;
    const existingVote = await this.db.get(voteKey).catch(() => null);
    
    if (existingVote) {
      throw new Error(`Voter ${voter} has already voted on proposal ${proposal_id}`);
    }
    
    // 创建新投票
    const vote = {
      proposal_id,
      voter,
      option,
      timestamp: Date.now()
    };
    
    // 存储投票
    await this.db.put(voteKey, vote);
    
    // 更新提案计票结果
    switch (option) {
      case VoteOption.YES:
        proposal.final_tally_result.yes = (parseInt(proposal.final_tally_result.yes, 10) + 1).toString();
        break;
      case VoteOption.NO:
        proposal.final_tally_result.no = (parseInt(proposal.final_tally_result.no, 10) + 1).toString();
        break;
      case VoteOption.ABSTAIN:
        proposal.final_tally_result.abstain = (parseInt(proposal.final_tally_result.abstain, 10) + 1).toString();
        break;
      case VoteOption.NO_WITH_VETO:
        proposal.final_tally_result.no_with_veto = (parseInt(proposal.final_tally_result.no_with_veto, 10) + 1).toString();
        break;
    }
    
    proposal.total_votes += 1;
    
    // 更新提案
    await this.db.put(`${PROPOSAL_KEY_PREFIX}${proposal_id}`, proposal);
    
    // 触发投票事件
    this.events.emit('voting:vote_cast', {
      proposal_id,
      voter,
      option
    });
    
    logger.info(`Vote cast by ${voter} on proposal ${proposal_id}: ${option}`);
    return vote;
  } catch (error) {
    logger.error(`Failed to cast vote: ${error.message}`);
    throw error;
  }
}

/**
 * 检查所有提案状态并更新过期提案
 */
async function checkProposalsStatus() {
  try {
    logger.debug('Checking proposals status');
    
    // 查找所有处于投票期的提案
    const stream = this.db.createReadStream({
      gt: PROPOSAL_KEY_PREFIX,
      lt: PROPOSAL_KEY_PREFIX + '\uffff'
    });
    
    const now = Date.now();
    const updatedProposals = [];
    
    for await (const data of stream) {
      const proposal = data.value;
      
      // 只处理投票期内的提案
      if (proposal.status === ProposalStatus.VOTING_PERIOD) {
        // 检查投票期是否结束
        if (now >= proposal.voting_end_time) {
          logger.info(`Proposal ${proposal.id} voting period ended, finalizing result`);
          
          // 计算投票结果
          const yes = parseInt(proposal.final_tally_result.yes, 10);
          const no = parseInt(proposal.final_tally_result.no, 10);
          const abstain = parseInt(proposal.final_tally_result.abstain, 10);
          const noWithVeto = parseInt(proposal.final_tally_result.no_with_veto, 10);
          const totalVotes = proposal.total_votes;
          
          // 检查是否达到法定人数
          const quorum = parseFloat(DEFAULT_VOTING_PARAMS.quorum);
          const votedRatio = totalVotes > 0 ? 1 : 0; // 简化模型，假设总投票权为固定值
          
          if (votedRatio < quorum) {
            proposal.status = ProposalStatus.REJECTED;
            proposal.result_message = `Proposal rejected: Quorum not reached (${votedRatio.toFixed(3)} < ${quorum})`;
          } else {
            // 检查是否有足够的否决票
            const vetoThreshold = parseFloat(DEFAULT_VOTING_PARAMS.veto_threshold);
            const vetoRatio = totalVotes > 0 ? noWithVeto / totalVotes : 0;
            
            if (vetoRatio >= vetoThreshold) {
              proposal.status = ProposalStatus.REJECTED;
              proposal.result_message = `Proposal rejected: Too many veto votes (${vetoRatio.toFixed(3)} >= ${vetoThreshold})`;
            } else {
              // 检查是否达到通过阈值
              const threshold = parseFloat(DEFAULT_VOTING_PARAMS.threshold);
              const yesRatio = totalVotes > 0 ? yes / (yes + no + noWithVeto) : 0;
              
              if (yesRatio >= threshold) {
                proposal.status = ProposalStatus.PASSED;
                proposal.result_message = `Proposal passed with ${yesRatio.toFixed(3)} yes ratio (threshold: ${threshold})`;
              } else {
                proposal.status = ProposalStatus.REJECTED;
                proposal.result_message = `Proposal rejected: Not enough yes votes (${yesRatio.toFixed(3)} < ${threshold})`;
              }
            }
          }
          
          // 触发提案结果事件
          this.events.emit('voting:proposal_finalized', {
            proposal_id: proposal.id,
            status: proposal.status,
            message: proposal.result_message
          });
          
          // 将更新后的提案添加到列表中
          updatedProposals.push(proposal);
        }
      }
    }
    
    // 更新修改过的提案
    for (const proposal of updatedProposals) {
      await this.db.put(`${PROPOSAL_KEY_PREFIX}${proposal.id}`, proposal);
      logger.info(`Updated proposal ${proposal.id} status to ${proposal.status}`);
    }
    
    if (updatedProposals.length > 0) {
      logger.info(`Finalized ${updatedProposals.length} proposals`);
    }
  } catch (error) {
    logger.error(`Error checking proposals status: ${error.message}`);
  }
}

/**
 * 注册API路由
 * @param {Router} router - Express路由器
 * @param {Object} blockchain - 区块链实例
 */
function registerRoutes(router, blockchain) {
  const { db, events } = blockchain;
  
  // 获取治理参数
  router.get('/gov/params', (req, res) => {
    res.json(DEFAULT_VOTING_PARAMS);
  });
  
  // 获取所有提案
  router.get('/gov/proposals', async (req, res) => {
    try {
      const proposals = [];
      
      // 创建提案前缀流
      const stream = db.createReadStream({
        gt: PROPOSAL_KEY_PREFIX,
        lt: PROPOSAL_KEY_PREFIX + '\uffff'
      });
      
      // 收集所有提案
      for await (const data of stream) {
        proposals.push(data.value);
      }
      
      // 按提交时间排序
      proposals.sort((a, b) => b.submit_time - a.submit_time);
      
      res.json(proposals);
    } catch (error) {
      logger.error(`Error fetching proposals: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch proposals'
      });
    }
  });
  
  // 获取单个提案
  router.get('/gov/proposals/:id', async (req, res) => {
    try {
      const proposalId = req.params.id;
      
      const proposal = await db.get(`${PROPOSAL_KEY_PREFIX}${proposalId}`)
        .catch(() => null);
      
      if (!proposal) {
        return res.status(404).json({
          error: 'NotFound',
          message: `Proposal ${proposalId} not found`
        });
      }
      
      res.json(proposal);
    } catch (error) {
      logger.error(`Error fetching proposal: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch proposal'
      });
    }
  });
  
  // 获取提案投票
  router.get('/gov/proposals/:id/votes', async (req, res) => {
    try {
      const proposalId = req.params.id;
      const votes = [];
      
      // 创建投票前缀流
      const votePrefix = `${VOTE_KEY_PREFIX}${proposalId}:`;
      const stream = db.createReadStream({
        gt: votePrefix,
        lt: votePrefix + '\uffff'
      });
      
      // 收集所有投票
      for await (const data of stream) {
        votes.push(data.value);
      }
      
      res.json(votes);
    } catch (error) {
      logger.error(`Error fetching proposal votes: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch proposal votes'
      });
    }
  });
  
  // 提交提案
  router.post('/gov/proposals', async (req, res) => {
    try {
      const { proposer, title, description, type, deposit } = req.body;
      
      if (!proposer || !title || !description || !type) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Missing required fields: proposer, title, description, type'
        });
      }
      
      // 触发提交提案交易
      events.emit('tx:submit_proposal', {
        proposer,
        title,
        description,
        type,
        deposit
      });
      
      res.status(202).json({
        success: true,
        message: 'Proposal submission transaction submitted'
      });
    } catch (error) {
      logger.error(`Error submitting proposal: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to submit proposal'
      });
    }
  });
  
  // 投票
  router.post('/gov/proposals/:id/votes', async (req, res) => {
    try {
      const proposalId = req.params.id;
      const { voter, option } = req.body;
      
      if (!voter || !option) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Missing required fields: voter, option'
        });
      }
      
      // 检查投票选项是否有效
      if (!Object.values(VoteOption).includes(option)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: `Invalid vote option: ${option}. Valid options: ${Object.values(VoteOption).join(', ')}`
        });
      }
      
      // 触发投票交易
      events.emit('tx:vote', {
        voter,
        proposal_id: proposalId,
        option
      });
      
      res.status(202).json({
        success: true,
        message: 'Vote transaction submitted'
      });
    } catch (error) {
      logger.error(`Error casting vote: ${error.message}`);
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to cast vote'
      });
    }
  });
}

/**
 * 模块关闭函数
 */
async function shutdown() {
  logger.info('Shutting down voting module');
  // 清理资源或执行其他关闭操作
}

module.exports = {
  name: MODULE_NAME,
  initGenesis,
  initialize,
  registerRoutes,
  shutdown,
  ProposalStatus,
  VoteOption
};
