import hre from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("Deploying contracts to Sepolia with the account:", deployerAddress);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployerAddress)).toString());

  const deploymentData = {
    network: "sepolia",
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {},
    gasUsed: {},
  };

  // STEP 1: Deploy Implementation Contracts First
  console.log("\n📦 Deploying Implementation Contracts...");
  
  // Deploy PledgeNFT Implementation
  console.log("Deploying PledgeNFT implementation...");
  const PledgeNFT = await hre.ethers.getContractFactory("PledgeNFT");
  const nftImpl = await PledgeNFT.deploy();
  await nftImpl.waitForDeployment();
  
  const nftImplAddress = await nftImpl.getAddress();
  deploymentData.contracts.pledgeNFTImplementation = nftImplAddress;
  console.log("✅ PledgeNFT implementation:", nftImplAddress);

  // Deploy PledgeEscrow Implementation
  console.log("Deploying PledgeEscrow implementation...");
  const PledgeEscrow = await hre.ethers.getContractFactory("PledgeEscrow");
  const escrowImpl = await PledgeEscrow.deploy();
  await escrowImpl.waitForDeployment();
  
  const escrowImplAddress = await escrowImpl.getAddress();
  deploymentData.contracts.pledgeEscrowImplementation = escrowImplAddress;
  console.log("✅ PledgeEscrow implementation:", escrowImplAddress);

  // STEP 2: Deploy Factory with Implementation Addresses
  console.log("\n🏭 Deploying Pledge Factory...");
  const PledgeFactory = await hre.ethers.getContractFactory("PledgeFactory");
  const pledgeFactory = await PledgeFactory.deploy(nftImplAddress, escrowImplAddress);
  await pledgeFactory.waitForDeployment();
  
  const pledgeFactoryAddress = await pledgeFactory.getAddress();
  deploymentData.contracts.pledgeFactory = pledgeFactoryAddress;
  
  console.log("✅ PledgeFactory deployed to:", pledgeFactoryAddress);

  // STEP 3: Deploy Pledge System via Factory
  console.log("\n🏛️ Deploying Pledge System...");
  const pledgeDeployTx = await pledgeFactory.deployPledgeSystem(
    "Sepolia Asset Pledge System",
    "Sepolia Pledged Assets NFT", 
    "SPANFT"
  );
  const pledgeDeployReceipt = await pledgeDeployTx.wait();
  const pledgeEvent = pledgeDeployReceipt.logs.find(log => {
    try {
      const parsed = pledgeFactory.interface.parseLog(log);
      return parsed.name === "PledgeSystemDeployed";
    } catch {
      return false;
    }
  });
  
  let pledgeEscrow, pledgeNFT;
  if (pledgeEvent) {
    const parsedEvent = pledgeFactory.interface.parseLog(pledgeEvent);
    pledgeEscrow = parsedEvent.args.escrow;
    pledgeNFT = parsedEvent.args.nft;
  }
  
  deploymentData.contracts.pledgeEscrow = pledgeEscrow;
  deploymentData.contracts.pledgeNFT = pledgeNFT;
  deploymentData.gasUsed.pledgeSystem = pledgeDeployReceipt.gasUsed.toString();
  
  console.log("✅ Pledge Escrow deployed to:", pledgeEscrow);
  console.log("✅ Pledge NFT deployed to:", pledgeNFT);

  // STEP 4: Deploy Asset Token Contracts
  const assetTokens = [];
  const assetTypes = [
    { name: "RealEstateToken", symbol: "RET", type: 0 },
    { name: "GoldToken", symbol: "GLD", type: 1 },
    { name: "VehicleToken", symbol: "VET", type: 2 },
    { name: "ArtToken", symbol: "ART", type: 3 },
    { name: "EquipmentToken", symbol: "EQT", type: 4 },
    { name: "CommodityToken", symbol: "COM", type: 5 }
  ];

  console.log("\n🪙 Deploying Asset Token Contracts...");
  
  for (const asset of assetTypes) {
    console.log(`\n📦 Deploying ${asset.name}...`);
    
    const BaseAssetToken = await hre.ethers.getContractFactory("BaseAssetToken");
    const token = await BaseAssetToken.deploy(
      asset.name,
      asset.symbol,
      pledgeEscrow // Grant minting rights to escrow
    );
    await token.waitForDeployment();
    
    const tokenAddress = await token.getAddress();
    assetTokens.push(tokenAddress);
    
    deploymentData.contracts[`${asset.symbol.toLowerCase()}Token`] = tokenAddress;
    console.log(`✅ ${asset.name} deployed to:`, tokenAddress);
  }

  // STEP 5: Configure Asset Token Integration
  console.log("\n⚙️ Configuring asset token integration...");
  const assetTypeIds = assetTypes.map(a => a.type);

  const configTx = await pledgeFactory.configureAssetTokens(
    pledgeEscrow,
    assetTokens,
    assetTypeIds
  );
  await configTx.wait();
  
  console.log("✅ Asset token integration configured");

  // STEP 6: Set up roles
  console.log("\n🔐 Setting up roles...");
  
  // Connect to the deployed escrow contract
  const escrowContract = await hre.ethers.getContractAt("PledgeEscrow", pledgeEscrow);
  
  // Grant roles to deployer for testing
  const APPROVER_ROLE = await escrowContract.APPROVER_ROLE();
  const MINTER_ROLE = await escrowContract.MINTER_ROLE();
  
  await escrowContract.grantRole(APPROVER_ROLE, deployerAddress);
  await escrowContract.grantRole(MINTER_ROLE, deployerAddress);
  
  console.log("✅ Roles configured for deployer");

  // STEP 7: Save deployment data
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }

  fs.writeFileSync(
    `deployments/sepolia-${Date.now()}.json`,
    JSON.stringify(deploymentData, null, 2)
  );

  // Create environment variables template
  const envTemplate = `
# Sepolia Testnet Contract Addresses (Generated ${new Date().toISOString()})
VITE_PLEDGE_FACTORY_ADDRESS=${pledgeFactoryAddress}
VITE_PLEDGE_ESCROW_ADDRESS=${pledgeEscrow}
VITE_PLEDGE_NFT_ADDRESS=${pledgeNFT}

# Implementation Addresses
VITE_PLEDGE_NFT_IMPLEMENTATION=${nftImplAddress}
VITE_PLEDGE_ESCROW_IMPLEMENTATION=${escrowImplAddress}

# Asset Token Addresses
VITE_RET_TOKEN_ADDRESS=${deploymentData.contracts.retToken}
VITE_GLD_TOKEN_ADDRESS=${deploymentData.contracts.gldToken}
VITE_VET_TOKEN_ADDRESS=${deploymentData.contracts.vetToken}
VITE_ART_TOKEN_ADDRESS=${deploymentData.contracts.artToken}
VITE_EQT_TOKEN_ADDRESS=${deploymentData.contracts.eqtToken}
VITE_COM_TOKEN_ADDRESS=${deploymentData.contracts.comToken}

# Network Configuration
VITE_NETWORK=sepolia
VITE_CHAIN_ID=11155111
`;

  fs.writeFileSync('.env.sepolia', envTemplate);

  console.log("\n🎉 Deployment Complete!");
  console.log("\n📋 Summary:");
  console.log("├── Pledge Factory:", pledgeFactoryAddress);
  console.log("├── Pledge Escrow:", pledgeEscrow);
  console.log("├── Pledge NFT:", pledgeNFT);
  console.log("├── NFT Implementation:", nftImplAddress);
  console.log("├── Escrow Implementation:", escrowImplAddress);
  console.log("├── Real Estate Token:", deploymentData.contracts.retToken);
  console.log("├── Gold Token:", deploymentData.contracts.gldToken);
  console.log("├── Vehicle Token:", deploymentData.contracts.vetToken);
  console.log("├── Art Token:", deploymentData.contracts.artToken);
  console.log("├── Equipment Token:", deploymentData.contracts.eqtToken);
  console.log("└── Commodity Token:", deploymentData.contracts.comToken);
  
  console.log("\n📁 Deployment data saved to deployments/");
  console.log("📄 Environment variables saved to .env.sepolia");
  
  console.log("\n🔗 Verify on Etherscan:");
  console.log(`npx hardhat verify --network sepolia ${nftImplAddress}`);
  console.log(`npx hardhat verify --network sepolia ${escrowImplAddress}`);
  console.log(`npx hardhat verify --network sepolia ${pledgeFactoryAddress} ${nftImplAddress} ${escrowImplAddress}`);
  
  assetTypes.forEach((asset, i) => {
    console.log(`npx hardhat verify --network sepolia ${assetTokens[i]} "${asset.name}" "${asset.symbol}" ${pledgeEscrow}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });