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

  // Deploy Asset Token Factory
  console.log("\n🏭 Deploying Asset Token Factory...");
  const AssetTokenFactory = await hre.ethers.getContractFactory("AssetTokenFactory");
  const assetFactory = await AssetTokenFactory.deploy(deployerAddress);
  await assetFactory.waitForDeployment();
  
  const assetFactoryAddress = await assetFactory.getAddress();
  deploymentData.contracts.assetFactory = assetFactoryAddress;
  
  console.log("✅ AssetTokenFactory deployed to:", assetFactoryAddress);

  // Deploy Liquidity Pool Factory  
  console.log("\n💧 Deploying Liquidity Pool Factory...");
  const LiquidityPoolFactory = await hre.ethers.getContractFactory("LiquidityPoolFactory");
  const liquidityFactory = await LiquidityPoolFactory.deploy();
  await liquidityFactory.waitForDeployment();
  
  const liquidityFactoryAddress = await liquidityFactory.getAddress();
  deploymentData.contracts.liquidityFactory = liquidityFactoryAddress;
  
  console.log("✅ LiquidityPoolFactory deployed to:", liquidityFactoryAddress);

  // Deploy Pledge Factory
  console.log("\n🏛️ Deploying Pledge Factory...");
  const PledgeFactory = await hre.ethers.getContractFactory("PledgeFactory");
  const pledgeFactory = await PledgeFactory.deploy();
  await pledgeFactory.waitForDeployment();
  
  const pledgeFactoryAddress = await pledgeFactory.getAddress();
  deploymentData.contracts.pledgeFactory = pledgeFactoryAddress;
  
  console.log("✅ PledgeFactory deployed to:", pledgeFactoryAddress);

  // Deploy Asset Tokens via Factory
  console.log("\n🏠 Deploying Real Estate Token...");
  const retTx = await assetFactory.deployRealEstateToken(deployerAddress);
  const retReceipt = await retTx.wait();
  const retEvent = retReceipt.logs.find(log => {
    try {
      const parsed = assetFactory.interface.parseLog(log);
      return parsed.name === "ContractDeployed";
    } catch {
      return false;
    }
  });
  const realEstateToken = retEvent ? assetFactory.interface.parseLog(retEvent).args.contractAddress : null;
  
  deploymentData.contracts.realEstateToken = realEstateToken;
  deploymentData.gasUsed.realEstateToken = retReceipt.gasUsed.toString();
  
  console.log("✅ Real Estate Token deployed to:", realEstateToken);

  console.log("\n🥇 Deploying Gold Token...");
  const gldTx = await assetFactory.deployGoldToken(deployerAddress);
  const gldReceipt = await gldTx.wait();
  const gldEvent = gldReceipt.logs.find(log => {
    try {
      const parsed = assetFactory.interface.parseLog(log);
      return parsed.name === "ContractDeployed";
    } catch {
      return false;
    }
  });
  const goldToken = gldEvent ? assetFactory.interface.parseLog(gldEvent).args.contractAddress : null;
  
  deploymentData.contracts.goldToken = goldToken;
  deploymentData.gasUsed.goldToken = gldReceipt.gasUsed.toString();
  
  console.log("✅ Gold Token deployed to:", goldToken);

  console.log("\n🚗 Deploying Vehicle Token...");
  const vetTx = await assetFactory.deployVehicleToken(deployerAddress);
  const vetReceipt = await vetTx.wait();
  const vetEvent = vetReceipt.logs.find(log => {
    try {
      const parsed = assetFactory.interface.parseLog(log);
      return parsed.name === "ContractDeployed";
    } catch {
      return false;
    }
  });
  const vehicleToken = vetEvent ? assetFactory.interface.parseLog(vetEvent).args.contractAddress : null;
  
  deploymentData.contracts.vehicleToken = vehicleToken;
  deploymentData.gasUsed.vehicleToken = vetReceipt.gasUsed.toString();
  
  console.log("✅ Vehicle Token deployed to:", vehicleToken);

  console.log("\n🎨 Deploying Art Token...");
  const artTx = await assetFactory.deployArtToken(deployerAddress);
  const artReceipt = await artTx.wait();
  const artEvent = artReceipt.logs.find(log => {
    try {
      const parsed = assetFactory.interface.parseLog(log);
      return parsed.name === "ContractDeployed";
    } catch {
      return false;
    }
  });
  const artToken = artEvent ? assetFactory.interface.parseLog(artEvent).args.contractAddress : null;
  
  deploymentData.contracts.artToken = artToken;
  deploymentData.gasUsed.artToken = artReceipt.gasUsed.toString();
  
  console.log("✅ Art Token deployed to:", artToken);

  console.log("\n🔧 Deploying Equipment Token...");
  const eqtTx = await assetFactory.deployEquipmentToken(deployerAddress);
  const eqtReceipt = await eqtTx.wait();
  const eqtEvent = eqtReceipt.logs.find(log => {
    try {
      const parsed = assetFactory.interface.parseLog(log);
      return parsed.name === "ContractDeployed";
    } catch {
      return false;
    }
  });
  const equipmentToken = eqtEvent ? assetFactory.interface.parseLog(eqtEvent).args.contractAddress : null;
  
  deploymentData.contracts.equipmentToken = equipmentToken;
  deploymentData.gasUsed.equipmentToken = eqtReceipt.gasUsed.toString();
  
  console.log("✅ Equipment Token deployed to:", equipmentToken);

  console.log("\n📦 Deploying Commodity Token...");
  const comTx = await assetFactory.deployCommodityToken(deployerAddress);
  const comReceipt = await comTx.wait();
  const comEvent = comReceipt.logs.find(log => {
    try {
      const parsed = assetFactory.interface.parseLog(log);
      return parsed.name === "ContractDeployed";
    } catch {
      return false;
    }
  });
  const commodityToken = comEvent ? assetFactory.interface.parseLog(comEvent).args.contractAddress : null;
  
  deploymentData.contracts.commodityToken = commodityToken;
  deploymentData.gasUsed.commodityToken = comReceipt.gasUsed.toString();
  
  console.log("✅ Commodity Token deployed to:", commodityToken);

  // Deploy Pledge System
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

  // Configure Asset Token Integration with Pledge System
  console.log("\n⚙️ Configuring asset token integration...");
  const tokenContracts = [
    realEstateToken,
    goldToken,
    vehicleToken, 
    artToken,
    equipmentToken,
    commodityToken
  ];
  const assetTypes = [0, 1, 2, 3, 4, 5]; // Enum values

  const configTx = await pledgeFactory.configureAssetTokens(
    pledgeEscrow,
    tokenContracts,
    assetTypes
  );
  await configTx.wait();
  
  console.log("✅ Asset token integration configured");

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
SEPOLIA_ASSET_FACTORY_ADDRESS=${assetFactoryAddress}
SEPOLIA_LIQUIDITY_FACTORY_ADDRESS=${liquidityFactoryAddress}
SEPOLIA_PLEDGE_FACTORY_ADDRESS=${pledgeFactoryAddress}
SEPOLIA_PLEDGE_ESCROW_ADDRESS=${pledgeEscrow}
SEPOLIA_PLEDGE_NFT_ADDRESS=${pledgeNFT}
SEPOLIA_REAL_ESTATE_TOKEN_ADDRESS=${realEstateTokenAddress}
SEPOLIA_GOLD_TOKEN_ADDRESS=${goldTokenAddress}
SEPOLIA_VEHICLE_TOKEN_ADDRESS=${vehicleTokenAddress}
SEPOLIA_ART_TOKEN_ADDRESS=${artTokenAddress}
SEPOLIA_EQUIPMENT_TOKEN_ADDRESS=${equipmentTokenAddress}
SEPOLIA_COMMODITY_TOKEN_ADDRESS=${commodityTokenAddress}
`;

  fs.writeFileSync('.env.sepolia', envTemplate);

  console.log("\n🎉 Deployment Complete!");
  console.log("\n📋 Summary:");
  console.log("├── Asset Factory:", assetFactoryAddress);
  console.log("├── Liquidity Factory:", liquidityFactoryAddress);
  console.log("├── Pledge Factory:", pledgeFactoryAddress);
  console.log("├── Pledge Escrow:", pledgeEscrow);
  console.log("├── Pledge NFT:", pledgeNFT);
  console.log("├── Real Estate Token:", realEstateTokenAddress);
  console.log("├── Gold Token:", goldTokenAddress);
  console.log("├── Vehicle Token:", vehicleTokenAddress);
  console.log("├── Art Token:", artTokenAddress);
  console.log("├── Equipment Token:", equipmentTokenAddress);
  console.log("└── Commodity Token:", commodityTokenAddress);
  
  console.log("\n📁 Deployment data saved to deployments/");
  console.log("📄 Environment variables saved to .env.sepolia");
  
  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on Etherscan");
  console.log("2. Update Supabase edge function environment variables");
  console.log("3. Test the deployment with sample transactions");
  
  console.log("\n🔗 Verify on Etherscan:");
  console.log(`npx hardhat verify --network sepolia ${assetFactoryAddress} ${deployerAddress}`);
  console.log(`npx hardhat verify --network sepolia ${liquidityFactoryAddress}`);
  console.log(`npx hardhat verify --network sepolia ${pledgeNFTAddress}`);
  console.log(`npx hardhat verify --network sepolia ${pledgeEscrowAddress} ${pledgeNFTAddress}`);
  console.log(`npx hardhat verify --network sepolia ${realEstateTokenAddress} ${deployerAddress}`);
  console.log(`npx hardhat verify --network sepolia ${goldTokenAddress} ${deployerAddress}`);
  console.log(`npx hardhat verify --network sepolia ${vehicleTokenAddress} ${deployerAddress}`);
  console.log(`npx hardhat verify --network sepolia ${artTokenAddress} ${deployerAddress}`);
  console.log(`npx hardhat verify --network sepolia ${equipmentTokenAddress} ${deployerAddress}`);
  console.log(`npx hardhat verify --network sepolia ${commodityTokenAddress} ${deployerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });