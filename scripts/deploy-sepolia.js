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

  // Deploy PledgeFactory first
  console.log("\n🏛️ Deploying Pledge Factory...");
  const PledgeFactory = await hre.ethers.getContractFactory("PledgeFactory");
  const pledgeFactory = await PledgeFactory.deploy();
  await pledgeFactory.waitForDeployment();
  
  const pledgeFactoryAddress = await pledgeFactory.getAddress();
  deploymentData.contracts.pledgeFactory = pledgeFactoryAddress;
  
  console.log("✅ PledgeFactory deployed to:", pledgeFactoryAddress);

  // Deploy Pledge System via Factory
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

  // Deploy individual Asset Token contracts
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

  // Configure Asset Token Integration with Pledge System
  console.log("\n⚙️ Configuring asset token integration...");
  const assetTypeIds = assetTypes.map(a => a.type);

  const configTx = await pledgeFactory.configureAssetTokens(
    pledgeEscrow,
    assetTokens,
    assetTypeIds
  );
  await configTx.wait();
  
  console.log("✅ Asset token integration configured");

  // Set up additional roles if needed
  console.log("\n🔐 Setting up roles...");
  
  // Grant APPROVER_ROLE to deployer for testing
  const PledgeEscrow = await hre.ethers.getContractFactory("PledgeEscrow");
  const escrowContract = PledgeEscrow.attach(pledgeEscrow);
  
  const APPROVER_ROLE = await escrowContract.APPROVER_ROLE();
  const MINTER_ROLE = await escrowContract.MINTER_ROLE();
  
  await escrowContract.grantRole(APPROVER_ROLE, deployerAddress);
  await escrowContract.grantRole(MINTER_ROLE, deployerAddress);
  
  console.log("✅ Roles configured for deployer");

  // Ensure deployments directory exists
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }

  // Save deployment data
  fs.writeFileSync(
    `deployments/sepolia-${Date.now()}.json`,
    JSON.stringify(deploymentData, null, 2)
  );

  // Create environment variables template
  const envTemplate = `
# Sepolia Testnet Contract Addresses (Generated ${new Date().toISOString()})
REACT_APP_PLEDGE_FACTORY_ADDRESS=${pledgeFactoryAddress}
REACT_APP_PLEDGE_ESCROW_ADDRESS=${pledgeEscrow}
REACT_APP_PLEDGE_NFT_ADDRESS=${pledgeNFT}

# Asset Token Addresses
REACT_APP_RET_TOKEN_ADDRESS=${deploymentData.contracts.retToken}
REACT_APP_GLD_TOKEN_ADDRESS=${deploymentData.contracts.gldToken}
REACT_APP_VET_TOKEN_ADDRESS=${deploymentData.contracts.vetToken}
REACT_APP_ART_TOKEN_ADDRESS=${deploymentData.contracts.artToken}
REACT_APP_EQT_TOKEN_ADDRESS=${deploymentData.contracts.eqtToken}
REACT_APP_COM_TOKEN_ADDRESS=${deploymentData.contracts.comToken}

# Supabase Function Environment Variables
REACT_APP_PLEDGE_FACTORY_ADDRESS=${pledgeFactoryAddress}
REACT_APP_PLEDGE_ESCROW_ADDRESS=${pledgeEscrow}
REACT_APP_PLEDGE_NFT_ADDRESS=${pledgeNFT}
`;

  fs.writeFileSync('.env.sepolia', envTemplate);

  console.log("\n🎉 Deployment Complete!");
  console.log("\n📋 Summary:");
  console.log("├── Pledge Factory:", pledgeFactoryAddress);
  console.log("├── Pledge Escrow:", pledgeEscrow);
  console.log("├── Pledge NFT:", pledgeNFT);
  console.log("├── Real Estate Token:", deploymentData.contracts.retToken);
  console.log("├── Gold Token:", deploymentData.contracts.gldToken);
  console.log("├── Vehicle Token:", deploymentData.contracts.vetToken);
  console.log("├── Art Token:", deploymentData.contracts.artToken);
  console.log("├── Equipment Token:", deploymentData.contracts.eqtToken);
  console.log("└── Commodity Token:", deploymentData.contracts.comToken);
  
  console.log("\n📁 Deployment data saved to deployments/");
  console.log("📄 Environment variables saved to .env.sepolia");
  
  console.log("\n📝 Next Steps:");
  console.log("1. Update your React app's environment variables");
  console.log("2. Update Supabase edge function environment variables");
  console.log("3. Verify contracts on Etherscan");
  console.log("4. Test the deployment with sample transactions");
  
  console.log("\n🔗 Verify on Etherscan:");
  console.log(`npx hardhat verify --network sepolia ${pledgeFactoryAddress}`);
  console.log(`npx hardhat verify --network sepolia ${pledgeEscrow} ${pledgeNFT}`);
  console.log(`npx hardhat verify --network sepolia ${pledgeNFT} "Sepolia Pledged Assets NFT" "SPANFT"`);
  
  assetTypes.forEach((asset, i) => {
    console.log(`npx hardhat verify --network sepolia ${assetTokens[i]} "${asset.name}" "${asset.symbol}" ${pledgeEscrow}`);
  });

  console.log("\n⚠️  Important: Update your Supabase edge functions with these addresses:");
  console.log("Set these as secrets in Supabase:");
  console.log(`PLEDGE_ESCROW_ADDRESS=${pledgeEscrow}`);
  console.log(`PLEDGE_NFT_ADDRESS=${pledgeNFT}`);
  console.log(`PLEDGE_FACTORY_ADDRESS=${pledgeFactoryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });