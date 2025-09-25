const { ethers } = require("hardhat");

async function main() {
  // Contract address (update this after deployment)
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x...";
  
  // Get contract instance
  const tokenVesting = await ethers.getContractAt("TokenVesting", CONTRACT_ADDRESS);
  const [owner] = await ethers.getSigners();
  
  console.log("=== Token Vesting Contract Interaction ===");
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("Owner Address:", owner.address);
  
  // Get contract info
  const tokenAddress = await tokenVesting.getToken();
  const vestingCount = await tokenVesting.getVestingSchedulesCount();
  const totalAmount = await tokenVesting.getVestingSchedulesTotalAmount();
  
  console.log("\n=== Contract Information ===");
  console.log("Token Address:", tokenAddress);
  console.log("Total Vesting Schedules:", vestingCount.toString());
  console.log("Total Vested Amount:", ethers.utils.formatEther(totalAmount), "tokens");
  
  // Example: Create a vesting schedule
  async function createVestingScheduleExample() {
    console.log("\n=== Creating Vesting Schedule Example ===");
    
    const beneficiary = "0x..."; // Replace with actual beneficiary address
    const start = Math.floor(Date.now() / 1000); // Current timestamp
    const cliff = 30 * 24 * 60 * 60; // 30 days cliff
    const duration = 365 * 24 * 60 * 60; // 1 year duration
    const slicePeriod = 24 * 60 * 60; // Daily release
    const revocable = true;
    const amount = ethers.utils.parseEther("1000"); // 1000 tokens
    
    try {
      const tx = await tokenVesting.createVestingSchedule(
        beneficiary,
        start,
        cliff,
        duration,
        slicePeriod,
        revocable,
        amount
      );
      
      console.log("Transaction Hash:", tx.hash);
      await tx.wait();
      console.log("Vesting schedule created successfully!");
      
    } catch (error) {
      console.error("Error creating vesting schedule:", error.message);
    }
  }
  
  // Example: Check releasable amount
  async function checkReleasableAmount(beneficiaryAddress) {
    console.log("\n=== Checking Releasable Amount ===");
    
    try {
      const scheduleCount = await tokenVesting.getVestingSchedulesCountByBeneficiary(beneficiaryAddress);
      console.log("Vesting schedules for beneficiary:", scheduleCount.toString());
      
      for (let i = 0; i < scheduleCount; i++) {
        const scheduleId = await tokenVesting.getVestingIdAtIndex(beneficiaryAddress, i);
        const releasableAmount = await tokenVesting.computeReleasableAmount(scheduleId);
        const schedule = await tokenVesting.getVestingSchedule(scheduleId);
        
        console.log(`\nSchedule ${i + 1}:`);
        console.log("Schedule ID:", scheduleId);
        console.log("Total Amount:", ethers.utils.formatEther(schedule.amountTotal));
        console.log("Released Amount:", ethers.utils.formatEther(schedule.released));
        console.log("Releasable Amount:", ethers.utils.formatEther(releasableAmount));
        console.log("Revoked:", schedule.revoked);
      }
      
    } catch (error) {
      console.error("Error checking releasable amount:", error.message);
    }
  }
  
  // Example: Release tokens
  async function releaseTokens(scheduleId, amount) {
    console.log("\n=== Releasing Tokens ===");
    
    try {
      const tx = await tokenVesting.release(scheduleId, amount);
      console.log("Transaction Hash:", tx.hash);
      await tx.wait();
      console.log("Tokens released successfully!");
      
    } catch (error) {
      console.error("Error releasing tokens:", error.message);
    }
  }
  
  // Example: Revoke vesting schedule
  async function revokeVestingSchedule(scheduleId) {
    console.log("\n=== Revoking Vesting Schedule ===");
    
    try {
      const tx = await tokenVesting.revoke(scheduleId);
      console.log("Transaction Hash:", tx.hash);
      await tx.wait();
      console.log("Vesting schedule revoked successfully!");
      
    } catch (error) {
      console.error("Error revoking vesting schedule:", error.message);
    }
  }
  
  // Example: Withdraw excess tokens
  async function withdrawTokens(amount) {
    console.log("\n=== Withdrawing Excess Tokens ===");
    
    try {
      const withdrawableAmount = await tokenVesting.getWithdrawableAmount();
      console.log("Withdrawable Amount:", ethers.utils.formatEther(withdrawableAmount));
      
      if (withdrawableAmount.gte(amount)) {
        const tx = await tokenVesting.withdraw(amount);
        console.log("Transaction Hash:", tx.hash);
        await tx.wait();
        console.log("Tokens withdrawn successfully!");
      } else {
        console.log("Insufficient withdrawable amount");
      }
      
    } catch (error) {
      console.error("Error withdrawing tokens:", error.message);
    }
  }
  
  // Uncomment and modify these function calls as needed:
  
  // await createVestingScheduleExample();
  // await checkReleasableAmount("0x..."); // Replace with beneficiary address
  // await releaseTokens("0x...", ethers.utils.parseEther("100")); // Replace with schedule ID and amount
  // await revokeVestingSchedule("0x..."); // Replace with schedule ID
  // await withdrawTokens(ethers.utils.parseEther("100")); // Replace with amount
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });