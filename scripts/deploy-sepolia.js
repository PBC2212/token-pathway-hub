const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts to Sepolia with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const deploymentData = {
    network: "sepolia",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {},
    gasUsed: {},
  };

  // Deploy Asset Token Factory
  console.log("\n🏭 Deploying Asset Token Factory...");
  const AssetTokenFactory = await hre.ethers.getContractFactory("AssetTokenFactory");
  const assetFactory = await AssetTokenFactory.deploy(deployer.address);
  await assetFactory.deployed();
  
  deploymentData.contracts.assetFactory = assetFactory.address;
  deploymentData.gasUsed.assetFactory = (await assetFactory.deployTransaction.wait()).gasUsed.toString();
  
  console.log("✅ AssetTokenFactory deployed to:", assetFactory.address);

  // Deploy Liquidity Pool Factory  
  console.log("\n💧 Deploying Liquidity Pool Factory...");
  const LiquidityPoolFactory = await hre.ethers.getContractFactory("LiquidityPoolFactory");
  const liquidityFactory = await LiquidityPoolFactory.deploy();
  await liquidityFactory.deployed();
  
  deploymentData.contracts.liquidityFactory = liquidityFactory.address;
  deploymentData.gasUsed.liquidityFactory = (await liquidityFactory.deployTransaction.wait()).gasUsed.toString();
  
  console.log("✅ LiquidityPoolFactory deployed to:", liquidityFactory.address);

  // Deploy Pledge Factory
  console.log("\n🏛️ Deploying Pledge Factory...");
  const PledgeFactory = await hre.ethers.getContractFactory("PledgeFactory");
  const pledgeFactory = await PledgeFactory.deploy();
  await pledgeFactory.deployed();
  
  deploymentData.contracts.pledgeFactory = pledgeFactory.address;
  deploymentData.gasUsed.pledgeFactory = (await pledgeFactory.deployTransaction.wait()).gasUsed.toString();
  
  console.log("✅ PledgeFactory deployed to:", pledgeFactory.address);

  // Deploy Asset Tokens via Factory
  console.log("\n🏠 Deploying Real Estate Token...");
  const retTx = await assetFactory.deployRealEstateToken(deployer.address);
  const retReceipt = await retTx.wait();
  const retEvent = retReceipt.events?.find(e => e.event === "ContractDeployed");
  const realEstateToken = retEvent?.args?.contractAddress;
  
  deploymentData.contracts.realEstateToken = realEstateToken;
  deploymentData.gasUsed.realEstateToken = retReceipt.gasUsed.toString();
  
  console.log("✅ Real Estate Token deployed to:", realEstateToken);

  console.log("\n🥇 Deploying Gold Token...");
  const gldTx = await assetFactory.deployGoldToken(deployer.address);
  const gldReceipt = await gldTx.wait();
  const gldEvent = gldReceipt.events?.find(e => e.event === "ContractDeployed");
  const goldToken = gldEvent?.args?.contractAddress;
  
  deploymentData.contracts.goldToken = goldToken;
  deploymentData.gasUsed.goldToken = gldReceipt.gasUsed.toString();
  
  console.log("✅ Gold Token deployed to:", goldToken);

  console.log("\n🚗 Deploying Vehicle Token...");
  const vetTx = await assetFactory.deployVehicleToken(deployer.address);
  const vetReceipt = await vetTx.wait();
  const vetEvent = vetReceipt.events?.find(e => e.event === "ContractDeployed");
  const vehicleToken = vetEvent?.args?.contractAddress;
  
  deploymentData.contracts.vehicleToken = vehicleToken;
  deploymentData.gasUsed.vehicleToken = vetReceipt.gasUsed.toString();
  
  console.log("✅ Vehicle Token deployed to:", vehicleToken);

  console.log("\n🎨 Deploying Art Token...");
  const artTx = await assetFactory.deployArtToken(deployer.address);
  const artReceipt = await artTx.wait();
  const artEvent = artReceipt.events?.find(e => e.event === "ContractDeployed");
  const artToken = artEvent?.args?.contractAddress;
  
  deploymentData.contracts.artToken = artToken;
  deploymentData.gasUsed.artToken = artReceipt.gasUsed.toString();
  
  console.log("✅ Art Token deployed to:", artToken);

  console.log("\n🔧 Deploying Equipment Token...");
  const eqtTx = await assetFactory.deployEquipmentToken(deployer.address);
  const eqtReceipt = await eqtTx.wait();
  const eqtEvent = eqtReceipt.events?.find(e => e.event === "ContractDeployed");
  const equipmentToken = eqtEvent?.args?.contractAddress;
  
  deploymentData.contracts.equipmentToken = equipmentToken;
  deploymentData.gasUsed.equipmentToken = eqtReceipt.gasUsed.toString();
  
  console.log("✅ Equipment Token deployed to:", equipmentToken);

  console.log("\n📦 Deploying Commodity Token...");
  const comTx = await assetFactory.deployCommodityToken(deployer.address);
  const comReceipt = await comTx.wait();
  const comEvent = comReceipt.events?.find(e => e.event === "ContractDeployed");
  const commodityToken = comEvent?.args?.contractAddress;
  
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
  const pledgeEvent = pledgeDeployReceipt.events?.find(e => e.event === "PledgeSystemDeployed");
  
  const pledgeEscrow = pledgeEvent?.args?.escrow;
  const pledgeNFT = pledgeEvent?.args?.nft;
  
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

  // Save deployment data
  fs.writeFileSync(
    `deployments/sepolia-${Date.now()}.json`,
    JSON.stringify(deploymentData, null, 2)
  );

  // Create environment variables template
  const envTemplate = `
# Sepolia Testnet Contract Addresses (Generated ${new Date().toISOString()})
SEPOLIA_ASSET_FACTORY_ADDRESS=${assetFactory.address}
SEPOLIA_LIQUIDITY_FACTORY_ADDRESS=${liquidityFactory.address}
SEPOLIA_PLEDGE_FACTORY_ADDRESS=${pledgeFactory.address}
SEPOLIA_PLEDGE_ESCROW_ADDRESS=${pledgeEscrow}
SEPOLIA_PLEDGE_NFT_ADDRESS=${pledgeNFT}
SEPOLIA_REAL_ESTATE_TOKEN_ADDRESS=${realEstateToken}
SEPOLIA_GOLD_TOKEN_ADDRESS=${goldToken}
SEPOLIA_VEHICLE_TOKEN_ADDRESS=${vehicleToken}
SEPOLIA_ART_TOKEN_ADDRESS=${artToken}
SEPOLIA_EQUIPMENT_TOKEN_ADDRESS=${equipmentToken}
SEPOLIA_COMMODITY_TOKEN_ADDRESS=${commodityToken}
`;

  fs.writeFileSync('.env.sepolia', envTemplate);

  console.log("\n🎉 Deployment Complete!");
  console.log("\n📋 Summary:");
  console.log("├── Asset Factory:", assetFactory.address);
  console.log("├── Liquidity Factory:", liquidityFactory.address);
  console.log("├── Pledge Factory:", pledgeFactory.address);
  console.log("├── Pledge Escrow:", pledgeEscrow);
  console.log("├── Pledge NFT:", pledgeNFT);
  console.log("├── Real Estate Token:", realEstateToken);
  console.log("├── Gold Token:", goldToken);
  console.log("├── Vehicle Token:", vehicleToken);
  console.log("├── Art Token:", artToken);
  console.log("├── Equipment Token:", equipmentToken);
  console.log("└── Commodity Token:", commodityToken);
  
  console.log("\n📁 Deployment data saved to deployments/");
  console.log("📁 Environment variables saved to .env.sepolia");
  
  console.log("\n🔍 Next Steps:");
  console.log("1. Verify contracts on Etherscan");
  console.log("2. Update Supabase edge function environment variables");
  console.log("3. Test the deployment with sample transactions");
  
  console.log("\n🔗 Verify on Etherscan:");
  console.log(`npx hardhat verify --network sepolia ${assetFactory.address} ${deployer.address}`);
  console.log(`npx hardhat verify --network sepolia ${liquidityFactory.address}`);
  console.log(`npx hardhat verify --network sepolia ${pledgeFactory.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });