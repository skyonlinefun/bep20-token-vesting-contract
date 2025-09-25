const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of TokenVesting contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get token address from environment or prompt user
  const tokenAddress = process.env.TOKEN_ADDRESS;
  
  if (!tokenAddress) {
    console.error("Please set TOKEN_ADDRESS in your .env file");
    process.exit(1);
  }

  console.log("Token address:", tokenAddress);

  // Deploy the TokenVesting contract
  const TokenVesting = await ethers.getContractFactory("TokenVesting");
  const tokenVesting = await TokenVesting.deploy(tokenAddress);

  await tokenVesting.deployed();

  console.log("TokenVesting contract deployed to:", tokenVesting.address);
  console.log("Transaction hash:", tokenVesting.deployTransaction.hash);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await tokenVesting.deployTransaction.wait(5);

  console.log("Deployment completed successfully!");
  console.log("\nContract Details:");
  console.log("- Contract Address:", tokenVesting.address);
  console.log("- Token Address:", tokenAddress);
  console.log("- Owner:", deployer.address);
  console.log("- Network:", hre.network.name);

  // Verify contract if on testnet or mainnet
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nVerifying contract on BSCScan...");
    try {
      await hre.run("verify:verify", {
        address: tokenVesting.address,
        constructorArguments: [tokenAddress],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  return {
    tokenVesting: tokenVesting.address,
    token: tokenAddress,
    owner: deployer.address
  };
}

// Execute deployment
main()
  .then((result) => {
    console.log("\n=== Deployment Summary ===");
    console.log("TokenVesting:", result.tokenVesting);
    console.log("Token:", result.token);
    console.log("Owner:", result.owner);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });