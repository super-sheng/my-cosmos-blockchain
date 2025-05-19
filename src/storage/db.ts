import { Level } from 'level';
import { Block } from '../models/block';
import { Transaction } from '../models/transaction';
import { Wallet } from '../crypto/wallet';
import { logger } from '../lib/logger';

interface BlockchainDB {
  getBlock (hash: string): Promise<Block | null>;
  getBlockByIndex (index: number): Promise<Block | null>;
  saveBlock (block: Block): Promise<void>;
  getLastBlock (): Promise<Block | null>;
  getTransaction (id: string): Promise<Transaction | null>;
  saveTransaction (tx: Transaction): Promise<void>;
  getWallet (address: string): Promise<Wallet | null>;
  saveWallet (wallet: Wallet): Promise<void>;
  getBalance (address: string): Promise<number>;
  updateBalance (address: string, amount: number): Promise<void>;
  initialize(): Promise<void>;
}

class LevelBlockchainDB implements BlockchainDB {
  private db: Level<string, Block | string | Transaction | Wallet>;
  private initialized: boolean = false;

  constructor() {
    this.db = new Level('./blockchain-data', { valueEncoding: 'json' });
  }

  async initialize(): Promise<void> {
    try {
      // 确保数据库已打开
      if (!this.db.status || this.db.status === 'closed') {
        await this.db.open();
      }
      this.initialized = true;
      logger.info('数据库连接成功初始化');
    } catch (error) {
      logger.error('数据库初始化失败', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async getBlock (hash: string): Promise<Block | null> {
    await this.ensureInitialized();
    try {
      return await this.db.get(`block:${hash}`) as Block;
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getBlockByIndex (index: number): Promise<Block | null> {
    await this.ensureInitialized();
    try {
      const blockHash = await this.db.get(`index:${index}`);
      return this.getBlock(blockHash as string);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async saveBlock (block: Block): Promise<void> {
    await this.ensureInitialized();
    const batch = this.db.batch();
    batch.put(`block:${block.hash}`, block);
    batch.put(`index:${block.index}`, block.hash);
    batch.put('lastBlock', block.hash);
    await batch.write();
  }

  async getLastBlock (): Promise<Block | null> {
    await this.ensureInitialized();
    try {
      const lastBlockHash = await this.db.get('lastBlock');
      return this.getBlock(lastBlockHash as string);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getTransaction (id: string): Promise<Transaction | null> {
    await this.ensureInitialized();
    try {
      return await this.db.get(`tx:${id}`) as Transaction;
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async saveTransaction (tx: Transaction): Promise<void> {
    await this.ensureInitialized();
    await this.db.put(`tx:${tx.id}`, tx);
  }

  async getWallet (address: string): Promise<Wallet | null> {
    await this.ensureInitialized();
    try {
      return await this.db.get(`wallet:${address}`) as Wallet;
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async saveWallet (wallet: Wallet): Promise<void> {
    await this.ensureInitialized();
    await this.db.put(`wallet:${wallet.address}`, wallet as unknown as string);
    // 初始化余额为0
    await this.updateBalance(wallet.address, 0);
  }

  async getBalance (address: string): Promise<number> {
    await this.ensureInitialized();
    try {
      return await this.db.get(`balance:${address}`) as unknown as number;
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return 0;
      }
      throw error;
    }
  }

  async updateBalance (address: string, amount: number): Promise<void> {
    await this.ensureInitialized();
    await this.db.put(`balance:${address}`, amount as unknown as string);
  }
}

let dbInstance: BlockchainDB | null = null;

export function getDB (): BlockchainDB {
  if (!dbInstance) {
    dbInstance = new LevelBlockchainDB();
  }
  return dbInstance;
}
