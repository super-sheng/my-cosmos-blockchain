#!/bin/bash

# 用于演示如何使用区块链 API 的curl命令示例

BASE_URL="http://localhost:3000/api"

# 创建新钱包
echo "Creating new wallet..."
WALLET_RESPONSE=$(curl -s -X POST "$BASE_URL/wallet/create")
ADDRESS=$(echo $WALLET_RESPONSE | grep -o '"address":"[^"]*"' | cut -d '"' -f 4)
MNEMONIC=$(echo $WALLET_RESPONSE | grep -o '"mnemonic":"[^"]*"' | cut -d '"' -f 4)
PRIVATE_KEY="PRIVATE_KEY_$(echo -n "$MNEMONIC" | xxd -p)"

echo "Wallet created with address: $ADDRESS"
echo "Private key (encoded mnemonic): $PRIVATE_KEY"

# 创建第二个钱包作为接收者
echo -e "\nCreating second wallet..."
WALLET2_RESPONSE=$(curl -s -X POST "$BASE_URL/wallet/create")
ADDRESS2=$(echo $WALLET2_RESPONSE | grep -o '"address":"[^"]*"' | cut -d '"' -f 4)

echo "Second wallet created with address: $ADDRESS2"

# 开始挖矿
echo -e "\nStarting mining with address: $ADDRESS"
curl -s -X POST -H "Content-Type: application/json" -d "{
  \"minerAddress\": \"$ADDRESS\"
}" "$BASE_URL/mining/start"

echo -e "\nMining started. Waiting for 10 seconds..."
sleep 10

# 查询挖矿状态
echo -e "\nChecking mining status:"
curl -s "$BASE_URL/mining/status"

# 查询钱包余额
echo -e "\nChecking wallet balance for: $ADDRESS"
curl -s "$BASE_URL/wallet/balance/$ADDRESS"

# 发送交易
echo -e "\nSending transaction from $ADDRESS to $ADDRESS2"
curl -s -X POST -H "Content-Type: application/json" -d "{
  \"from\": \"$ADDRESS\",
  \"to\": \"$ADDRESS2\",
  \"amount\": 10,
  \"privateKey\": \"$PRIVATE_KEY\"
}" "$BASE_URL/transaction/send"

# 查询待处理交易
echo -e "\nChecking pending transactions:"
curl -s "$BASE_URL/transaction/pending"

# 等待交易被挖矿
echo -e "\nWaiting 10 more seconds for transaction to be mined..."
sleep 10

# 查询两个钱包的余额
echo -e "\nChecking balance of sender: $ADDRESS"
curl -s "$BASE_URL/wallet/balance/$ADDRESS"

echo -e "\nChecking balance of receiver: $ADDRESS2"
curl -s "$BASE_URL/wallet/balance/$ADDRESS2"

# 创建资产
echo -e "\nCreating a new asset:"
curl -s -X POST -H "Content-Type: application/json" -d "{
  \"name\": \"Digital Art\",
  \"description\": \"A beautiful piece of digital art\",
  \"owner\": \"$ADDRESS\",
  \"value\": 1000,
  \"metadata\": {\"type\": \"artwork\", \"creator\": \"Blockchain Artist\"}
}" "$BASE_URL/asset"

# 查询资产
echo -e "\nListing all assets:"
curl -s "$BASE_URL/asset"

# 停止挖矿
echo -e "\nStopping mining:"
curl -s -X POST "$BASE_URL/mining/stop"

# 获取区块链信息
echo -e "\nGetting blockchain info:"
curl -s "$BASE_URL/blockchain/info"

echo -e "\nDemo complete!"
