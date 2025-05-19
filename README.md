# 我的Cosmos区块链

这是一个基于Cosmos SDK构建的自定义区块链项目。Cosmos SDK是一个用于构建区块链应用程序的框架，它提供了一套模块化的工具和库，让开发者能够快速构建自己的区块链。

## 项目概述

该项目包含一个完整的Cosmos SDK应用程序，具有以下功能：

- 基本的代币转账功能
- 自定义资产模块
- 简单的投票治理系统
- 跨链通信能力（通过IBC协议）

## 前置条件

在开始之前，请确保您的系统上安装了以下软件：

- [Go](https://golang.org/doc/install) (1.20+)
- [Ignite CLI](https://docs.ignite.com/guide/install) (最新版本)
- [Docker](https://docs.docker.com/get-docker/) (可选，用于容器化部署)

## 快速开始

### 克隆仓库

```bash
git clone https://github.com/super-sheng/my-cosmos-blockchain.git
cd my-cosmos-blockchain
```

### 初始化区块链

```bash
# 使用Ignite CLI启动区块链
ignite chain serve
```

这将启动您的区块链，创建创世账户，并在本地运行一个节点。

### 与区块链交互

```bash
# 查询账户余额
mycosmosblockchain query bank balances [address]

# 发送代币
mycosmosblockchain tx bank send [发送者地址] [接收者地址] [金额]mycoin

# 创建一个新资产
mycosmosblockchain tx asset create-asset [名称] [描述] [价格]
```

## 项目结构

```
├── app/                   # 应用程序配置
├── cmd/                   # 命令行入口点
├── proto/                 # 协议缓冲区定义
├── x/                     # 自定义模块
│   ├── asset/             # 资产管理模块
│   └── voting/            # 投票治理模块
├── vue/                   # 前端界面（可选）
└── config/                # 配置文件
```

## 自定义您的区块链

### 添加新模块

```bash
# 创建新模块
ignite scaffold module [模块名] --dep bank

# 添加消息类型
ignite scaffold message [操作名] [字段1] [字段2]...

# 添加查询
ignite scaffold query [查询名] [字段1] [字段2]...
```

### 修改共识参数

您可以在`config/config.yml`中修改区块链的共识参数和网络设置。

## 部署到测试网

```bash
# 构建应用程序
ignite chain build

# 初始化节点
mycosmosblockchain init [节点名称]

# 创建验证者
mycosmosblockchain gentx [验证者名称] [金额]mycoin --chain-id [链ID]

# 收集创世交易
mycosmosblockchain collect-gentxs

# 启动节点
mycosmosblockchain start
```

## IBC配置

本项目已包含IBC（区块链间通信协议）模块，允许您的区块链与其他Cosmos生态系统的区块链进行互操作。

## 贡献

欢迎提交问题和拉取请求！

## 许可证

MIT
