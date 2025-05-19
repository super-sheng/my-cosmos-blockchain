import { Level } from 'level';
import { Block } from '../models/block';
import { Transaction } from '../models/transaction';
import { Wallet } from '../crypto/wallet';

interface BlockchainDB {
  getBlock(hash: string): Promise<Block | null>;
  getBlockByIndex(index: number): Promise<Block | null>;
  saveBlock(block: Block): Promise<void>;
  getLastBlock(): Promise<Block | null>;
  getTransaction(id: string): Promise<Transaction | null>;
  saveTransaction(tx: Transaction): Promise<void>;
  getWallet(address: string): Promise<Wallet | null>;
  saveWallet(wallet: Wallet): Promise<void>;
  getBalance(address: string): Promise<number>;
  updateBalance(address: string, amount: number): Promise<void>;
}

class LevelBlockchainDB implements BlockchainDB {
  private db: Level;

  constructor() {
    this.db = new Level('./blockchain-data', { valueEncoding: 'json' });
  }

  async getBlock(hash: string): Promise<Block | null> {
    try {
      return await this.db.get(`block:${hash}`);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getBlockByIndex(index: number): Promise<Block | null> {
    try {
      const blockHash = await this.db.get(`index:${index}`);
      return this.getBlock(blockHash);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async saveBlock(block: Block): Promise<void> {
    const batch = this.db.batch();
    batch.put(`block:${block.hash}`, block);
    batch.put(`index:${block.index}`, block.hash);
    batch.put('lastBlock', block.hash);
    await batch.write();
  }

  async getLastBlock(): Promise<Block | null> {
    try {
      const lastBlockHash = await this.db.get('lastBlock');
      return this.getBlock(lastBlockHash);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    try {
      return await this.db.get(`tx:${id}`);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async saveTransaction(tx: Transaction): Promise<void> {
    await this.db.put(`tx:${tx.id}`, tx);
  }

  async getWallet(address: string): Promise<Wallet | null> {
    try {
      return await this.db.get(`wallet:${address}`);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async saveWallet(wallet: Wallet): Promise<void> {
    await this.db.put(`wallet:${wallet.address}`, wallet);
    // 初始化余额为0
    await this.updateBalance(wallet.address, 0);
  }

  async getBalance(address: string): Promise<number> {
    try {
      return await this.db.get(`balance:${address}`);
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return 0;
      }
      throw error;
    }
  }

  async updateBalance(address: string, amount: number): Promise<void> {
    await this.db.put(`balance:${address}`, amount);
  }
}

let dbInstance: BlockchainDB | null = null;

export function getDB(): BlockchainDB {
  if (!dbInstance) {
    dbInstance = new LevelBlockchainDB();
  }
  return dbInstance;
}
