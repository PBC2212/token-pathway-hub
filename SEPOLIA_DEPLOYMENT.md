# Sepolia Testnet Deployment Guide

This guide walks you through deploying the asset tokenization smart contracts to Sepolia testnet.

## Prerequisites

### 1. Development Environment Setup

```bash
# Install Node.js dependencies for smart contracts
npm install --prefix . -f package-contracts.json

# Or if you prefer yarn
yarn install
```

### 2. Get Sepolia ETH

You'll need Sepolia ETH for deployment:
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Alchemy Faucet**: https://sepoliafaucet.com/
- **Infura Faucet**: https://www.infura.io/faucet/sepolia

Recommended: Get at least 0.5 ETH for deployment and testing.

### 3. Get API Keys

#### Infura (for RPC access)
1. Sign up at https://infura.io/
2. Create a new project
3. Copy your Project ID

#### Etherscan (for contract verification)
1. Sign up at https://etherscan.io/
2. Go to API Keys section
3. Create a new API key

### 4. Configure Environment

Create `.env.deployment` file:

```bash
# Sepolia Testnet Configuration
NETWORK=sepolia
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Your wallet private key (NEVER commit this!)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Admin wallet address (usually same as deployer)
ADMIN_ADDRESS=0xYourWalletAddress

# Gas settings
GAS_PRICE=20000000000  # 20 gwei
GAS_LIMIT=8000000
```

⚠️ **Security Warning**: Never commit your private key to version control!

## Deployment Steps

### Step 1: Compile Contracts

```bash
npx hardhat compile
```

### Step 2: Deploy to Sepolia

```bash
npx hardhat run scripts/deploy-sepolia.js --network sepolia
```

This script will:
- Deploy Asset Token Factory
- Deploy Liquidity Pool Factory  
- Deploy Pledge Factory
- Deploy all 6 asset token types (Real Estate, Gold, Vehicle, Art, Equipment, Commodity)
- Deploy Pledge System (Escrow + NFT contracts)
- Configure asset token integration
- Save deployment data to `deployments/` folder
- Create `.env.sepolia` with contract addresses

### Step 3: Verify Contracts

```bash
npx hardhat run scripts/verify-sepolia.js --network sepolia
```

This will verify all deployed contracts on Sepolia Etherscan.

### Step 4: Update Frontend Configuration

After successful deployment, update your Supabase edge functions with the deployed contract addresses:

1. Copy the addresses from `.env.sepolia`
2. Add them to your Supabase project secrets
3. Update the edge functions to use Sepolia addresses

## Deployment Output

After successful deployment, you'll see:

```
🎉 Deployment Complete!

📋 Summary:
├── Asset Factory: 0x1234...
├── Liquidity Factory: 0x5678...
├── Pledge Factory: 0x9abc...
├── Pledge Escrow: 0xdef0...
├── Pledge NFT: 0x2345...
├── Real Estate Token: 0x6789...
├── Gold Token: 0xabcd...
├── Vehicle Token: 0xef01...
├── Art Token: 0x3456...
├── Equipment Token: 0x789a...
└── Commodity Token: 0xbcde...
```

## Testing Your Deployment

### 1. Basic Contract Interaction

Test that contracts are working:

```bash
# Check if factory is deployed correctly
npx hardhat console --network sepolia

# In the console:
const factory = await ethers.getContractAt("AssetTokenFactory", "0xYourFactoryAddress");
console.log(await factory.getTotalContracts());
```

### 2. Frontend Integration

1. Update your `.env` file with Sepolia contract addresses
2. Test pledge creation through your frontend
3. Test token minting
4. Test liquidity pool operations

### 3. Fireblocks Integration

If using Fireblocks:
1. Create Sepolia vaults in Fireblocks
2. Update contract addresses in your edge functions
3. Test end-to-end workflows

## Contract Addresses Reference

After deployment, all contract addresses will be saved in:
- `deployments/sepolia-[timestamp].json` - Full deployment data
- `.env.sepolia` - Environment variables format

## Troubleshooting

### Common Issues

**1. Insufficient Funds**
```
Error: insufficient funds for intrinsic transaction cost
```
Solution: Get more Sepolia ETH from faucets

**2. RPC Errors**
```
Error: could not detect network
```
Solution: Check your `SEPOLIA_RPC_URL` in `.env.deployment`

**3. Verification Failures**
```
Error: Contract source code already verified
```
This is normal - contract was already verified

**4. Gas Price Too Low**
```
Error: replacement transaction underpriced
```
Solution: Increase `GAS_PRICE` in `.env.deployment`

### Getting Help

If you encounter issues:
1. Check the Hardhat documentation
2. Verify your environment configuration
3. Ensure you have sufficient Sepolia ETH
4. Check Sepolia network status

## Next Steps

After successful Sepolia deployment:

1. **Test Thoroughly**: Test all functionality on Sepolia
2. **Security Review**: Have contracts audited before mainnet
3. **Mainnet Preparation**: Update deployment scripts for mainnet
4. **Monitor**: Set up monitoring for contract events
5. **Backup**: Secure your private keys and deployment data

## Useful Links

- **Sepolia Etherscan**: https://sepolia.etherscan.io/
- **Sepolia Faucets**: https://sepoliafaucet.com/
- **Hardhat Docs**: https://hardhat.org/docs
- **OpenZeppelin**: https://docs.openzeppelin.com/contracts/