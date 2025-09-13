const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Load deployment data
  const deploymentFiles = fs.readdirSync("deployments").filter(f => f.startsWith("sepolia-"));
  if (deploymentFiles.length === 0) {
    console.error("No Sepolia deployment files found");
    return;
  }
  
  const latestFile = deploymentFiles.sort().reverse()[0];
  const deployment = JSON.parse(fs.readFileSync(`deployments/${latestFile}`, "utf8"));
  
  console.log("🔍 Verifying contracts on Sepolia Etherscan...");
  console.log("Using deployment:", latestFile);
  
  const contracts = deployment.contracts;
  
  try {
    // Verify Asset Token Factory
    console.log("\n📋 Verifying AssetTokenFactory...");
    await hre.run("verify:verify", {
      address: contracts.assetFactory,
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ AssetTokenFactory verified");

    // Verify Liquidity Pool Factory
    console.log("\n💧 Verifying LiquidityPoolFactory...");
    await hre.run("verify:verify", {
      address: contracts.liquidityFactory,
      constructorArguments: [],
    });
    console.log("✅ LiquidityPoolFactory verified");

    // Verify Pledge Factory  
    console.log("\n🏛️ Verifying PledgeFactory...");
    await hre.run("verify:verify", {
      address: contracts.pledgeFactory,
      constructorArguments: [],
    });
    console.log("✅ PledgeFactory verified");

    // Verify Pledge NFT
    console.log("\n🖼️ Verifying PledgeNFT...");
    await hre.run("verify:verify", {
      address: contracts.pledgeNFT,
      constructorArguments: ["Sepolia Pledged Assets NFT", "SPANFT"],
    });
    console.log("✅ PledgeNFT verified");

    // Verify Pledge Escrow
    console.log("\n🏦 Verifying PledgeEscrow...");
    await hre.run("verify:verify", {
      address: contracts.pledgeEscrow,
      constructorArguments: [contracts.pledgeNFT],
    });
    console.log("✅ PledgeEscrow verified");

    // Note: Asset tokens are deployed via factory so we need to get their constructor args
    console.log("\n🏠 Verifying RealEstateToken...");
    await hre.run("verify:verify", {
      address: contracts.realEstateToken,
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ RealEstateToken verified");

    console.log("\n🥇 Verifying GoldToken...");
    await hre.run("verify:verify", {
      address: contracts.goldToken, 
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ GoldToken verified");

    console.log("\n🚗 Verifying VehicleToken...");
    await hre.run("verify:verify", {
      address: contracts.vehicleToken,
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ VehicleToken verified");

    console.log("\n🎨 Verifying ArtToken...");
    await hre.run("verify:verify", {
      address: contracts.artToken,
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ ArtToken verified");

    console.log("\n🔧 Verifying EquipmentToken...");
    await hre.run("verify:verify", {
      address: contracts.equipmentToken,
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ EquipmentToken verified");

    console.log("\n📦 Verifying CommodityToken...");
    await hre.run("verify:verify", {
      address: contracts.commodityToken,
      constructorArguments: [deployment.deployer],
    });
    console.log("✅ CommodityToken verified");

    console.log("\n🎉 All contracts verified successfully!");
    
    console.log("\n🔗 View on Etherscan:");
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`├── ${name}: https://sepolia.etherscan.io/address/${address}`);
    });

  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    
    if (error.message.includes("Already Verified")) {
      console.log("ℹ️ Some contracts may already be verified");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });