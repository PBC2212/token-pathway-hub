import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("🚀 Deploying SimpleRwaBackedStablecoin to Sepolia...");
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
    tokens: {}
  };

  try {
    // Deploy SimpleRwaBackedStablecoin
    console.log("\n📦 Deploying SimpleRwaBackedStablecoin contract...");
    
    const SimpleRwaBackedStablecoin = await hre.ethers.getContractFactory("SimpleRwaBackedStablecoin");
    
    console.log("⏳ Deploying main contract...");
    const rwaContract = await SimpleRwaBackedStablecoin.deploy(treasuryAddress);
    
    console.log("⏳ Waiting for deployment transaction...");
    await rwaContract.waitForDeployment();
    const contractAddress = await rwaContract.getAddress();
    
    console.log("✅ SimpleRwaBackedStablecoin deployed to:", contractAddress);
    
    // Get deployment receipt for gas tracking
    const deployTx = rwaContract.deploymentTransaction();
    const receipt = await deployTx.wait();
    
    deploymentData.contracts.simpleRwaBackedStablecoin = contractAddress;
    deploymentData.gasUsed.simpleRwaBackedStablecoin = receipt.gasUsed.toString();
    
    console.log("⛽ Gas used for deployment:", receipt.gasUsed.toString());
    console.log("💵 Transaction hash:", receipt.hash);
    
    // Deploy all category tokens
    console.log("\n🪙 Deploying category tokens...");
    const deployTokensTx = await rwaContract.deployAllTokens();
    
    console.log("⏳ Waiting for token deployment...");
    const tokensReceipt = await deployTokensTx.wait();
    deploymentData.gasUsed.tokenDeployment = tokensReceipt.gasUsed.toString();
    
    console.log("✅ All tokens deployed! Gas used:", tokensReceipt.gasUsed.toString());
    
    // Get all deployed token addresses
    console.log("\n🎯 Fetching deployed token addresses...");
    
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
        deploymentData.tokens[category.symbol] = {
          address: tokenAddress,
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          category: category.name,
          active: tokenInfo.active
        };
        console.log(`   ${category.symbol} (${category.name}): ${tokenAddress}`);
      } catch (error) {
        console.warn(`   Failed to get ${category.name} token:`, error.message);
      }
    }
    
    // Save deployment data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const deploymentFileName = `sepolia-simple-rwa-${timestamp}.json`;
    const deploymentsDir = path.join(process.cwd(), 'deployments');
    
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(deploymentsDir, deploymentFileName),
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("\n📄 Deployment data saved to:", deploymentFileName);
    
    // Calculate total gas used
    const totalGasUsed = BigInt(deploymentData.gasUsed.simpleRwaBackedStablecoin) + 
                        BigInt(deploymentData.gasUsed.tokenDeployment);
    
    // Display summary
    console.log("\n🎉 DEPLOYMENT SUCCESSFUL!");
    console.log("=====================================");
    console.log("Network:", "Sepolia Testnet");
    console.log("SimpleRwaBackedStablecoin:", contractAddress);
    console.log("Treasury:", treasuryAddress);
    console.log("Main contract transaction:", receipt.hash);
    console.log("Token deployment transaction:", tokensReceipt.hash);
    console.log("Total gas used:", totalGasUsed.toString());
    console.log("=====================================");
    
    // Display all deployed token addresses
    console.log("\n🪙 All Deployed RWA Tokens:");
    console.log("=====================================");
    Object.entries(deploymentData.tokens).forEach(([symbol, info]) => {
      console.log(`${symbol}: ${info.address} (${info.name})`);
    });
    console.log("=====================================");
    
    // Verification instructions
    console.log("\n🔍 Next steps:");
    console.log("1. Wait 1-2 minutes for contracts to be indexed");
    console.log("2. Verify main contract:");
    console.log(`   npx hardhat verify --network sepolia ${contractAddress} "${treasuryAddress}"`);
    console.log("3. Verify each token contract with their constructor parameters");
    console.log("4. Check on Sepolia Etherscan:");
    console.log(`   https://sepolia.etherscan.io/address/${contractAddress}`);
    
    // Export verification command for convenience
    const verifyCommand = `npx hardhat verify --network sepolia ${contractAddress} "${treasuryAddress}"`;
    fs.writeFileSync(path.join(deploymentsDir, 'verify-main-contract.txt'), verifyCommand);
    
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