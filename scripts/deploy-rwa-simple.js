import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("🚀 Deploying MultiTokenRwaBackedStablecoin to Sepolia...");
  console.log("🔑 Deployer address:", deployerAddress);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log("💰 Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance < hre.ethers.parseEther("0.05")) {
    console.warn("⚠️  Low balance! You might need more Sepolia ETH for deployment");
    console.warn("   Get free Sepolia ETH from: https://sepoliafaucet.com/");
  }

  // Set treasury address (use deployer as treasury for now)
  const treasuryAddress = deployerAddress;
  console.log("🏦 Treasury address:", treasuryAddress);

  const deploymentData = {
    network: "sepolia",
    deployer: deployerAddress,
    treasury: treasuryAddress,
    timestamp: new Date().toISOString(),
    contracts: {},
    gasUsed: {},
  };

  try {
    // Deploy MultiTokenRwaBackedStablecoin
    console.log("\n📦 Deploying MultiTokenRwaBackedStablecoin contract...");
    
    // Compile only the specific contract we need
    await hre.run("compile", {
      sources: ["contracts/MultiTokenRwaBackedStablecoin.sol"],
      force: true
    });
    
    const MultiTokenRwaBackedStablecoin = await hre.ethers.getContractFactory("MultiTokenRwaBackedStablecoin");
    
    console.log("⏳ Deploying contract...");
    const rwaContract = await MultiTokenRwaBackedStablecoin.deploy(treasuryAddress, {
      gasLimit: 5000000 // Set explicit gas limit
    });
    
    console.log("⏳ Waiting for deployment transaction...");
    await rwaContract.waitForDeployment();
    const contractAddress = await rwaContract.getAddress();
    
    console.log("✅ MultiTokenRwaBackedStablecoin deployed to:", contractAddress);
    
    // Get deployment receipt for gas tracking
    const deployTx = rwaContract.deploymentTransaction();
    const receipt = await deployTx.wait();
    
    deploymentData.contracts.multiTokenRwaBackedStablecoin = contractAddress;
    deploymentData.gasUsed.multiTokenRwaBackedStablecoin = receipt.gasUsed.toString();
    
    console.log("⛽ Gas used for deployment:", receipt.gasUsed.toString());
    
    // Get all deployed token addresses
    console.log("\n🪙 Getting deployed token addresses...");
    
    // Fetch token information for each category
    const categories = [
      { id: 0, name: "RealEstate", symbol: "RUSD" },
      { id: 1, name: "Commodities", symbol: "CUSD" },
      { id: 2, name: "Bonds", symbol: "BUSD" },
      { id: 3, name: "Equipment", symbol: "EUSD" },
      { id: 4, name: "Inventory", symbol: "IUSD" },
      { id: 5, name: "Other", symbol: "OUSD" }
    ];
    
    for (const category of categories) {
      try {
        const tokenInfo = await rwaContract.categoryTokens(category.id);
        const tokenAddress = tokenInfo.token;
        deploymentData.contracts[`${category.name.toLowerCase()}Token`] = tokenAddress;
        console.log(`   ${category.symbol} (${category.name}): ${tokenAddress}`);
      } catch (error) {
        console.warn(`   Failed to get ${category.name} token:`, error.message);
      }
    }
    
    // Save deployment data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const deploymentFileName = `sepolia-rwa-stablecoin-${timestamp}.json`;
    const deploymentsDir = path.join(process.cwd(), 'deployments');
    
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(deploymentsDir, deploymentFileName),
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("\n📄 Deployment data saved to:", deploymentFileName);
    
    // Display summary
    console.log("\n🎉 DEPLOYMENT SUCCESSFUL!");
    console.log("=====================================");
    console.log("Network:", "Sepolia Testnet");
    console.log("MultiTokenRwaBackedStablecoin:", contractAddress);
    console.log("Treasury:", treasuryAddress);
    console.log("Total gas used:", receipt.gasUsed.toString());
    console.log("=====================================");
    
    // Verification instructions
    console.log("\n🔍 Next steps:");
    console.log("1. Wait 1-2 minutes for contract to be indexed");
    console.log("2. Run verification:");
    console.log(`   npx hardhat verify --network sepolia ${contractAddress} "${treasuryAddress}"`);
    console.log("3. Check on Sepolia Etherscan:");
    console.log(`   https://sepolia.etherscan.io/address/${contractAddress}`);
    
    // Export verification command for convenience
    const verifyCommand = `npx hardhat verify --network sepolia ${contractAddress} "${treasuryAddress}"`;
    fs.writeFileSync(path.join(deploymentsDir, 'verify-command.txt'), verifyCommand);
    
    return {
      contractAddress,
      treasuryAddress,
      deploymentData
    };

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });