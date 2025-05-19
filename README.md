# My Cosmos Blockchain

一个基于Cosmos SDK的轻量级区块链实现，使用TypeScript开发。支持基本的转账和挖矿功能。

## 功能特点

- 基于Cosmos生态系统
- 使用TypeScript实现
- 支持加密货币转账功能
- 实现简单的PoW挖矿机制
- REST API接口支持与区块链交互
- 本地钱包管理
- 资产管理模块

## 安装

```bash
npm install
```

## 开发环境运行

```bash
npm run dev
```

## 构建项目

```bash
npm run build
```

## 生产环境运行

```bash
npm start
```

## 运行测试

```bash
npm test
```

## API接口

### 钱包相关

```
# 创建新钱包
POST /api/wallet/create

# 获取钱包余额
GET /api/wallet/balance/:address

# 获取钱包信息
GET /api/wallet/:address
```

### 交易相关

```
# 发送交易
POST /api/transaction/send
Body: {
  "from": "发送者地址",
  "to": "接收者地址",
  "amount": 数量,
  "privateKey": "发送者私钥"
}

# 获取待处理交易
GET /api/transaction/pending

# 获取交易详情
GET /api/transaction/:id
```

### 挖矿相关

```
# 开始挖矿
POST /api/mining/start
Body: {
  "minerAddress": "矿工地址"
}

# 停止挖矿
POST /api/mining/stop

# 获取挖矿状态
GET /api/mining/status
```

### 区块链相关

```
# 获取区块链信息
GET /api/blockchain/info

# 获取所有区块
GET /api/blockchain/blocks

# 获取特定区块
GET /api/blockchain/block/:index

# 验证区块链
GET /api/blockchain/validate
```

### 资产相关

```
# 创建新资产
POST /api/asset
Body: {
  "name": "资产名称",
  "description": "资产描述",
  "owner": "拥有者地址",
  "value": 价值,
  "metadata": {}
}

# 获取所有资产
GET /api/asset

# 获取特定资产
GET /api/asset/:id

# 转移资产所有权
POST /api/asset/:id/transfer
Body: {
  "from": "当前拥有者地址",
  "to": "新拥有者地址",
  "privateKey": "当前拥有者私钥"
}

# 更新资产信息
PUT /api/asset/:id
Body: {
  "name": "新名称",
  "description": "新描述",
  "value": 新价值,
  "metadata": {}
}

# 删除资产
DELETE /api/asset/:id
```

## 使用示例

下面是一个完整的使用流程示例：

### 1. 启动服务

```bash
npm start
```

### 2. 创建钱包

```bash
curl -X POST http://localhost:3000/api/wallet/create
```

返回例子：
```json
{
  "address": "cosmos1abc123...",
  "mnemonic": "word1 word2 ...",
  "publicKey": "abc123..."
}
```

记录返回的地址和助记词对应的私钥。

### 3. 开始挖矿以获取初始代币

```bash
curl -X POST -H "Content-Type: application/json" -d '{"minerAddress":"cosmos1abc123..."}' http://localhost:3000/api/mining/start
```

### 4. 查看挖矿状态

```bash
curl http://localhost:3000/api/mining/status
```

### 5. 等待几分钟后查询余额

```bash
curl http://localhost:3000/api/wallet/balance/cosmos1abc123...
```

### 6. 发送交易

先创建另一个钱包作为接收者：

```bash
curl -X POST http://localhost:3000/api/wallet/create
```

记录返回的地址，然后发送交易：

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "from": "cosmos1abc123...",
  "to": "cosmos1xyz789...",
  "amount": 10,
  "privateKey": "PRIVATE_KEY_..."
}' http://localhost:3000/api/transaction/send
```

### 7. 停止挖矿

```bash
curl -X POST http://localhost:3000/api/mining/stop
```

### 8. 创建和管理资产

```bash
# 创建新资产
curl -X POST -H "Content-Type: application/json" -d '{
  "name": "My NFT",
  "description": "A valuable digital asset",
  "owner": "cosmos1abc123...",
  "value": 1000,
  "metadata": {"type": "artwork", "creator": "Artist"}
}' http://localhost:3000/api/asset
```

## 项目结构

```
src/
├── api/          # API接口定义
├── blockchain/   # 区块链核心功能
├── crypto/       # 加密相关功能
├── lib/          # 通用库和工具
├── mining/       # 挖矿相关功能
├── models/       # 数据模型
├── modules/      # 功能模块
│   └── asset/   # 资产管理模块
├── storage/      # 数据存储
├── __tests__/    # 测试文件
└── index.ts      # 应用入口
```

## 注意事项

- 这是一个演示项目，不建议用于生产环境
- 私钥处理简化，实际应用中需要更安全的机制
- 项目使用LevelDB作为本地存储，实际应用可能需要更复杂的数据库

## 许可证

[MIT](LICENSE)
