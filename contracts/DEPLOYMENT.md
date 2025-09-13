# Smart Contract Deployment Guide

This guide walks you through deploying the asset tokenization and liquidity pool smart contracts to production.

## Prerequisites

- **Fireblocks Account** with API access configured
- **Blockchain Network** selected (Ethereum mainnet, Polygon, etc.)
- **Admin Wallet** configured in Fireblocks with sufficient gas funds
- **Development Environment** with Hardhat/Foundry setup

## Step-by-Step Deployment

### 1. Environment Setup

Create a deployment environment file:

```bash
# .env.deployment
NETWORK=mainnet # or polygon, arbitrum, etc.
FIREBLOCKS_API_KEY=your_api_key
FIREBLOCKS_PRIVATE_KEY=your_private_key
ADMIN_WALLET_ADDRESS=0x... # Your Fireblocks admin wallet
GAS_PRICE=20 # gwei
GAS_LIMIT=8000000
```

### 2. Contract Compilation

Compile all contracts and verify no errors:

```bash
# Using Hardhat
npx hardhat compile

# Using Foundry  
forge build
```

### 3. Deployment Order

Deploy contracts in this specific order:

#### Step 3a: Deploy Factory Contracts

```javascript
// scripts/01-deploy-factories.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying factories with account:", deployer.address);

  // Deploy Asset Token Factory
  const AssetTokenFactory = await ethers.getContractFactory("AssetTokenFactory");
  const assetFactory = await AssetTokenFactory.deploy(deployer.address);
  await assetFactory.deployed();
  console.log("AssetTokenFactory deployed to:", assetFactory.address);

  // Deploy Liquidity Pool Factory
  const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPoolFactory");
  const liquidityFactory = await LiquidityPoolFactory.deploy();
  await liquidityFactory.deployed();
  console.log("LiquidityPoolFactory deployed to:", liquidityFactory.address);
  
  // Verify contracts on block explorer
  if (network.name !== "localhost") {
    await run("verify:verify", {
      address: assetFactory.address,
      constructorArguments: [deployer.address],
    });
    
    await run("verify:verify", {
      address: liquidityFactory.address,
      constructorArguments: [],
    });
  }
  
  return { assetFactory: assetFactory.address, liquidityFactory: liquidityFactory.address };
}
```

#### Step 3b: Deploy Asset Token Contracts

```javascript
// scripts/02-deploy-tokens.js
async function main() {
  const factoryAddress = "0x..."; // From step 3a
  const adminAddress = "0x...";   // Your Fireblocks wallet
  
  const factory = await ethers.getContractAt("AssetTokenFactory", factoryAddress);
  
  // Deploy all asset-specific tokens
  const retTx = await factory.deployRealEstateToken(adminAddress);
  const retReceipt = await retTx.wait();
  console.log("Real Estate Token deployed via factory");
  
  const gldTx = await factory.deployGoldToken(adminAddress);
  const gldReceipt = await gldTx.wait();
  console.log("Gold Token deployed via factory");
  
  const vetTx = await factory.deployVehicleToken(adminAddress);
  const vetReceipt = await vetTx.wait();
  console.log("Vehicle Token deployed via factory");
  
  const artTx = await factory.deployArtToken(adminAddress);
  const artReceipt = await artTx.wait();
  console.log("Art Token deployed via factory");
  
  const eqtTx = await factory.deployEquipmentToken(adminAddress);
  const eqtReceipt = await eqtTx.wait();
  console.log("Equipment Token deployed via factory");
  
  const comTx = await factory.deployCommodityToken(adminAddress);
  const comReceipt = await comTx.wait();
  console.log("Commodity Token deployed via factory");
}
```

#### Step 3c: Create Initial Liquidity Pools

```javascript
// scripts/03-deploy-liquidity-pools.js
async function main() {
  const liquidityFactoryAddress = "0x..."; // From step 3a
  const factory = await ethers.getContractAt("LiquidityPoolFactory", liquidityFactoryAddress);
  
  // Get deployed token addresses
  const tokenAddresses = await getDeployedTokens(); // Helper function
  const usdcAddress = "0x..."; // USDC contract address on your network
  
  // Create pools for major trading pairs
  const poolConfigs = [
    { tokenA: tokenAddresses.realEstate, tokenB: usdcAddress, feeRate: 30 }, // 0.3%
    { tokenA: tokenAddresses.gold, tokenB: usdcAddress, feeRate: 30 },        // 0.3%
    { tokenA: tokenAddresses.vehicle, tokenB: usdcAddress, feeRate: 30 },     // 0.3%
    { tokenA: tokenAddresses.art, tokenB: usdcAddress, feeRate: 100 },        // 1.0%
    { tokenA: tokenAddresses.equipment, tokenB: usdcAddress, feeRate: 50 },   // 0.5%
    { tokenA: tokenAddresses.commodity, tokenB: usdcAddress, feeRate: 30 }    // 0.3%
  ];
  
  for (const config of poolConfigs) {
    const tx = await factory.createPool(config.tokenA, config.tokenB, config.feeRate);
    const receipt = await tx.wait();
    console.log(`Pool created for ${config.tokenA}/${config.tokenB} with ${config.feeRate/100}% fee`);
  }
}
```

### 4. Contract Verification

Verify all deployed contracts on block explorers:

```bash
# Verify asset factory
npx hardhat verify --network mainnet 0x[ASSET_FACTORY_ADDRESS] 0x[ADMIN_ADDRESS]

# Verify liquidity factory
npx hardhat verify --network mainnet 0x[LIQUIDITY_FACTORY_ADDRESS]

# Get deployed contract addresses from factories
npx hardhat run scripts/get-deployed-contracts.js --network mainnet

# Verify each token contract
npx hardhat verify --network mainnet 0x[RET_ADDRESS] 0x[ADMIN_ADDRESS]
npx hardhat verify --network mainnet 0x[GLD_ADDRESS] 0x[ADMIN_ADDRESS]
# ... etc for each token

# Verify liquidity pools (get addresses from factory events)
npx hardhat run scripts/get-deployed-pools.js --network mainnet
npx hardhat verify --network mainnet 0x[POOL_ADDRESS] 
# ... etc for each pool
```

### 5. Post-Deployment Configuration

#### Step 5a: Configure Roles

```javascript
// scripts/03-configure-roles.js
async function configureRoles() {
  const contracts = await getDeployedContracts(); // Get from factory
  
  // Grant roles to Fireblocks wallets
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const COMPLIANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("COMPLIANCE_ROLE"));
  
  for (const contract of contracts) {
    const tokenContract = await ethers.getContractAt("BaseAssetToken", contract.address);
    
    // Grant minter role to Fireblocks minting wallet
    await tokenContract.grantRole(MINTER_ROLE, process.env.FIREBLOCKS_MINTER_WALLET);
    
    // Grant compliance role to compliance team wallet
    await tokenContract.grantRole(COMPLIANCE_ROLE, process.env.COMPLIANCE_WALLET);
    
    console.log(`Roles configured for ${contract.name} at ${contract.address}`);
  }
}
```

#### Step 5b: Update Edge Functions

Update your edge function contract addresses:

```javascript
// Update supabase/functions/mint-tokens/index.ts
const CONTRACT_ADDRESSES = {
  real_estate: "0x...", // Deployed RET address
  gold: "0x...",        // Deployed GLD address  
  vehicle: "0x...",     // Deployed VET address
  art: "0x...",         // Deployed ART address
  equipment: "0x...",   // Deployed EQT address
  commodity: "0x..."    // Deployed COM address
};

// Update liquidity pool edge functions
// supabase/functions/liquidity-create-pool/index.ts
const LIQUIDITY_FACTORY_ADDRESS = "0x..."; // Deployed liquidity factory address

// supabase/functions/liquidity-add-remove/index.ts  
const LIQUIDITY_FACTORY_ADDRESS = "0x..."; // Same factory address

// supabase/functions/liquidity-get-pools/index.ts
// Update to use real contract calls instead of mock data
```

### 6. Testing Deployment

Run integration tests to verify everything works:

```javascript
// test/integration/deployment.test.js
describe("Production Deployment", () => {
  it("should mint tokens via Fireblocks", async () => {
    // Test minting through your edge functions
    const response = await supabase.functions.invoke('mint-tokens', {
      body: {
        address: testAddress,
        amount: 100,
        assetType: 'real_estate',
        appraisedValue: 500000,
        contractAddress: deployedAddresses.realEstateToken,
        tokenSymbol: 'RET'
      }
    });
    
    expect(response.error).toBeNull();
    expect(response.data.success).toBe(true);
  });
});
```

### 7. Production Checklist

Before going live, verify:

- [ ] **All contracts deployed** and verified on block explorer
- [ ] **Roles configured** correctly (admin, minter, compliance)
- [ ] **Edge functions updated** with correct contract addresses
- [ ] **Gas optimization** tested (estimate costs)
- [ ] **Security audit** completed by reputable firm
- [ ] **Multi-signature** setup for admin operations
- [ ] **Monitoring** configured for contract events
- [ ] **Backup procedures** for private keys
- [ ] **Incident response** plan prepared

### 8. Mainnet Deployment Commands

Final deployment to mainnet:

```bash
# Deploy factories (asset and liquidity)
npx hardhat run scripts/01-deploy-factories.js --network mainnet

# Deploy tokens via asset factory
npx hardhat run scripts/02-deploy-tokens.js --network mainnet

# Create initial liquidity pools
npx hardhat run scripts/03-deploy-liquidity-pools.js --network mainnet

# Configure roles and permissions
npx hardhat run scripts/04-configure-roles.js --network mainnet

# Run integration tests
npx hardhat test test/integration/deployment.test.js --network mainnet
```

### 9. Post-Deployment Monitoring

Set up monitoring for:
- **Contract interactions** and events
- **Gas usage** and optimization opportunities  
- **Failed transactions** and error rates
- **Role changes** and administrative actions
- **Token minting** and transfer patterns

### 10. Contract Addresses Registry

After deployment, maintain a registry:

```json
{
  "network": "mainnet",
  "deployedAt": "2024-01-15T10:00:00Z",
  "deployer": "0x...",
  "contracts": {
    "assetFactory": "0x...",
    "liquidityFactory": "0x...",
    "realEstateToken": "0x...",
    "goldToken": "0x...",
    "vehicleToken": "0x...",
    "artToken": "0x...",
    "equipmentToken": "0x...",
    "commodityToken": "0x..."
  },
  "liquidityPools": {
    "RET/USDC": "0x...",
    "GLD/USDC": "0x...",
    "VET/USDC": "0x...",
    "ART/USDC": "0x...",
    "EQT/USDC": "0x...",
    "COM/USDC": "0x..."
  },
  "roles": {
    "admin": "0x...",
    "minter": "0x...",
    "compliance": "0x..."
  }
}
```

## Emergency Procedures

### Pause Contracts (if needed)
```javascript
// Emergency pause all contracts
const contracts = [retAddress, gldAddress, vetAddress, artAddress, eqtAddress, comAddress];
for (const address of contracts) {
  const contract = await ethers.getContractAt("BaseAssetToken", address);
  await contract.pause();
}
```

### Update Max Supply (if needed)
```javascript
// Increase supply cap for specific token
const contract = await ethers.getContractAt("RealEstateToken", retAddress);
await contract.updateMaxSupply(ethers.utils.parseEther("2000000")); // 2M tokens
```

For any deployment issues, refer to the troubleshooting section in the main README or contact the development team.