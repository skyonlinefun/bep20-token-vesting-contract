const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TokenVesting", function () {
  let tokenVesting;
  let mockToken;
  let owner;
  let beneficiary;
  let addr2;
  let addrs;

  const TOTAL_SUPPLY = ethers.utils.parseEther("1000000");
  const VESTING_AMOUNT = ethers.utils.parseEther("1000");

  beforeEach(async function () {
    [owner, beneficiary, addr2, ...addrs] = await ethers.getSigners();

    // Deploy mock BEP20 token
    const MockToken = await ethers.getContractFactory("MockBEP20");
    mockToken = await MockToken.deploy("Test Token", "TEST", TOTAL_SUPPLY);
    await mockToken.deployed();

    // Deploy TokenVesting contract
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    tokenVesting = await TokenVesting.deploy(mockToken.address);
    await tokenVesting.deployed();

    // Transfer tokens to vesting contract
    await mockToken.transfer(tokenVesting.address, VESTING_AMOUNT.mul(10));
  });

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      expect(await tokenVesting.getToken()).to.equal(mockToken.address);
    });

    it("Should set the right owner", async function () {
      expect(await tokenVesting.owner()).to.equal(owner.address);
    });

    it("Should have correct initial values", async function () {
      expect(await tokenVesting.getVestingSchedulesCount()).to.equal(0);
      expect(await tokenVesting.getVestingSchedulesTotalAmount()).to.equal(0);
    });
  });

  describe("Vesting Schedule Creation", function () {
    it("Should create a vesting schedule successfully", async function () {
      const start = await time.latest();
      const cliff = 86400; // 1 day
      const duration = 86400 * 365; // 1 year
      const slicePeriodSeconds = 86400; // 1 day
      const revocable = true;

      await expect(
        tokenVesting.createVestingSchedule(
          beneficiary.address,
          start,
          cliff,
          duration,
          slicePeriodSeconds,
          revocable,
          VESTING_AMOUNT
        )
      ).to.emit(tokenVesting, "VestingScheduleCreated");

      expect(await tokenVesting.getVestingSchedulesCount()).to.equal(1);
      expect(await tokenVesting.getVestingSchedulesTotalAmount()).to.equal(VESTING_AMOUNT);
    });

    it("Should fail to create vesting schedule with insufficient tokens", async function () {
      const start = await time.latest();
      const cliff = 86400;
      const duration = 86400 * 365;
      const slicePeriodSeconds = 86400;
      const revocable = true;
      const largeAmount = ethers.utils.parseEther("100000");

      await expect(
        tokenVesting.createVestingSchedule(
          beneficiary.address,
          start,
          cliff,
          duration,
          slicePeriodSeconds,
          revocable,
          largeAmount
        )
      ).to.be.revertedWith("TokenVesting: cannot create vesting schedule because not sufficient tokens");
    });

    it("Should fail with zero beneficiary address", async function () {
      const start = await time.latest();
      const cliff = 86400;
      const duration = 86400 * 365;
      const slicePeriodSeconds = 86400;
      const revocable = true;

      await expect(
        tokenVesting.createVestingSchedule(
          ethers.constants.AddressZero,
          start,
          cliff,
          duration,
          slicePeriodSeconds,
          revocable,
          VESTING_AMOUNT
        )
      ).to.be.revertedWith("TokenVesting: beneficiary is the zero address");
    });
  });

  describe("Token Release", function () {
    let vestingScheduleId;
    let start;

    beforeEach(async function () {
      start = await time.latest();
      const cliff = 86400; // 1 day
      const duration = 86400 * 365; // 1 year
      const slicePeriodSeconds = 86400; // 1 day
      const revocable = true;

      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        start,
        cliff,
        duration,
        slicePeriodSeconds,
        revocable,
        VESTING_AMOUNT
      );

      vestingScheduleId = await tokenVesting.computeNextVestingScheduleIdForHolder(beneficiary.address);
    });

    it("Should not release tokens before cliff", async function () {
      const releasableAmount = await tokenVesting.computeReleasableAmount(vestingScheduleId);
      expect(releasableAmount).to.equal(0);
    });

    it("Should release tokens after cliff", async function () {
      // Move time forward past cliff
      await time.increaseTo(start + 86400 * 2); // 2 days after start

      const releasableAmount = await tokenVesting.computeReleasableAmount(vestingScheduleId);
      expect(releasableAmount).to.be.gt(0);

      const initialBalance = await mockToken.balanceOf(beneficiary.address);
      await tokenVesting.connect(beneficiary).release(vestingScheduleId, releasableAmount);
      const finalBalance = await mockToken.balanceOf(beneficiary.address);

      expect(finalBalance.sub(initialBalance)).to.equal(releasableAmount);
    });

    it("Should release all tokens after vesting period", async function () {
      // Move time forward past entire vesting period
      await time.increaseTo(start + 86400 * 366); // 1 year + 1 day

      const releasableAmount = await tokenVesting.computeReleasableAmount(vestingScheduleId);
      expect(releasableAmount).to.equal(VESTING_AMOUNT);

      await tokenVesting.connect(beneficiary).release(vestingScheduleId, releasableAmount);
      const balance = await mockToken.balanceOf(beneficiary.address);
      expect(balance).to.equal(VESTING_AMOUNT);
    });

    it("Should fail to release more than vested amount", async function () {
      await time.increaseTo(start + 86400 * 2);

      const releasableAmount = await tokenVesting.computeReleasableAmount(vestingScheduleId);
      const excessAmount = releasableAmount.add(ethers.utils.parseEther("100"));

      await expect(
        tokenVesting.connect(beneficiary).release(vestingScheduleId, excessAmount)
      ).to.be.revertedWith("TokenVesting: cannot release tokens, not enough vested tokens");
    });
  });

  describe("Revocation", function () {
    let vestingScheduleId;
    let start;

    beforeEach(async function () {
      start = await time.latest();
      const cliff = 86400;
      const duration = 86400 * 365;
      const slicePeriodSeconds = 86400;
      const revocable = true;

      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        start,
        cliff,
        duration,
        slicePeriodSeconds,
        revocable,
        VESTING_AMOUNT
      );

      vestingScheduleId = await tokenVesting.computeNextVestingScheduleIdForHolder(beneficiary.address);
    });

    it("Should revoke vesting schedule successfully", async function () {
      await time.increaseTo(start + 86400 * 100); // 100 days

      await expect(tokenVesting.revoke(vestingScheduleId))
        .to.emit(tokenVesting, "VestingScheduleRevoked");

      const schedule = await tokenVesting.getVestingSchedule(vestingScheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should fail to revoke non-revocable schedule", async function () {
      // Create non-revocable schedule
      const nonRevocableSchedule = await tokenVesting.createVestingSchedule(
        addr2.address,
        start,
        86400,
        86400 * 365,
        86400,
        false, // non-revocable
        VESTING_AMOUNT
      );

      const scheduleId = await tokenVesting.computeNextVestingScheduleIdForHolder(addr2.address);

      await expect(tokenVesting.revoke(scheduleId))
        .to.be.revertedWith("TokenVesting: vesting schedule not revocable");
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to create vesting schedules", async function () {
      const start = await time.latest();

      await expect(
        tokenVesting.connect(beneficiary).createVestingSchedule(
          beneficiary.address,
          start,
          86400,
          86400 * 365,
          86400,
          true,
          VESTING_AMOUNT
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should only allow owner to revoke schedules", async function () {
      const start = await time.latest();
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        start,
        86400,
        86400 * 365,
        86400,
        true,
        VESTING_AMOUNT
      );

      const vestingScheduleId = await tokenVesting.computeNextVestingScheduleIdForHolder(beneficiary.address);

      await expect(
        tokenVesting.connect(beneficiary).revoke(vestingScheduleId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow beneficiary to release their tokens", async function () {
      const start = await time.latest();
      await tokenVesting.createVestingSchedule(
        beneficiary.address,
        start,
        86400,
        86400 * 365,
        86400,
        true,
        VESTING_AMOUNT
      );

      const vestingScheduleId = await tokenVesting.computeNextVestingScheduleIdForHolder(beneficiary.address);
      
      await time.increaseTo(start + 86400 * 2);
      const releasableAmount = await tokenVesting.computeReleasableAmount(vestingScheduleId);

      await expect(
        tokenVesting.connect(beneficiary).release(vestingScheduleId, releasableAmount)
      ).to.not.be.reverted;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to pause and unpause", async function () {
      await tokenVesting.pause();
      expect(await tokenVesting.paused()).to.be.true;

      await tokenVesting.unpause();
      expect(await tokenVesting.paused()).to.be.false;
    });

    it("Should prevent operations when paused", async function () {
      await tokenVesting.pause();
      const start = await time.latest();

      await expect(
        tokenVesting.createVestingSchedule(
          beneficiary.address,
          start,
          86400,
          86400 * 365,
          86400,
          true,
          VESTING_AMOUNT
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow owner to withdraw excess tokens", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      const initialBalance = await mockToken.balanceOf(owner.address);

      await tokenVesting.withdraw(withdrawAmount);
      const finalBalance = await mockToken.balanceOf(owner.address);

      expect(finalBalance.sub(initialBalance)).to.equal(withdrawAmount);
    });
  });
});