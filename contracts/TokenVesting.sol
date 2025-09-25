// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenVesting
 * @dev A secure BEP20 token vesting contract with comprehensive features
 * @notice This contract allows for token vesting with customizable schedules
 */
contract TokenVesting is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Vesting schedule structure
    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint256 cliff;
        uint256 start;
        uint256 duration;
        uint256 slicePeriodSeconds;
        bool revocable;
        uint256 amountTotal;
        uint256 released;
        bool revoked;
    }

    // The BEP20 token being vested
    IERC20 private immutable _token;

    // Mapping from vesting schedule ID to VestingSchedule
    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    
    // Mapping from beneficiary to list of vesting schedule IDs
    mapping(address => bytes32[]) private beneficiaryVestingSchedules;
    
    // Total amount of tokens held by the vesting contract
    uint256 private vestingSchedulesTotalAmount;
    
    // Current vesting schedule count
    uint256 private vestingSchedulesIds;

    // Events
    event VestingScheduleCreated(
        bytes32 indexed vestingScheduleId,
        address indexed beneficiary,
        uint256 cliff,
        uint256 start,
        uint256 duration,
        uint256 slicePeriodSeconds,
        bool revocable,
        uint256 amount
    );

    event TokensReleased(
        bytes32 indexed vestingScheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    event VestingScheduleRevoked(
        bytes32 indexed vestingScheduleId,
        address indexed beneficiary,
        uint256 unreleased
    );

    event TokensWithdrawn(address indexed owner, uint256 amount);

    /**
     * @dev Creates a vesting contract
     * @param token_ address of the BEP20 token contract
     */
    constructor(address token_) {
        require(token_ != address(0), "TokenVesting: token is the zero address");
        _token = IERC20(token_);
    }

    /**
     * @notice Creates a new vesting schedule for a beneficiary
     * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param _start start time of the vesting period
     * @param _cliff duration in seconds of the cliff in which tokens will begin to vest
     * @param _duration duration in seconds of the period in which the tokens will vest
     * @param _slicePeriodSeconds duration of a slice period for the vesting in seconds
     * @param _revocable whether the vesting is revocable or not
     * @param _amount total amount of tokens to be released at the end of the vesting
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        bool _revocable,
        uint256 _amount
    ) external onlyOwner whenNotPaused {
        require(
            getWithdrawableAmount() >= _amount,
            "TokenVesting: cannot create vesting schedule because not sufficient tokens"
        );
        require(_duration > 0, "TokenVesting: duration must be > 0");
        require(_amount > 0, "TokenVesting: amount must be > 0");
        require(_slicePeriodSeconds >= 1, "TokenVesting: slicePeriodSeconds must be >= 1");
        require(_beneficiary != address(0), "TokenVesting: beneficiary is the zero address");

        bytes32 vestingScheduleId = computeNextVestingScheduleIdForHolder(_beneficiary);
        uint256 cliff = _start.add(_cliff);
        
        vestingSchedules[vestingScheduleId] = VestingSchedule(
            true,
            _beneficiary,
            cliff,
            _start,
            _duration,
            _slicePeriodSeconds,
            _revocable,
            _amount,
            0,
            false
        );
        
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.add(_amount);
        vestingSchedulesIds = vestingSchedulesIds.add(1);
        beneficiaryVestingSchedules[_beneficiary].push(vestingScheduleId);

        emit VestingScheduleCreated(
            vestingScheduleId,
            _beneficiary,
            cliff,
            _start,
            _duration,
            _slicePeriodSeconds,
            _revocable,
            _amount
        );
    }

    /**
     * @notice Revokes the vesting schedule for given identifier
     * @param vestingScheduleId the vesting schedule identifier
     */
    function revoke(bytes32 vestingScheduleId) external onlyOwner whenNotPaused {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(vestingSchedule.initialized, "TokenVesting: vesting schedule not initialized");
        require(vestingSchedule.revocable, "TokenVesting: vesting schedule not revocable");
        require(!vestingSchedule.revoked, "TokenVesting: vesting schedule already revoked");
        
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        if (vestedAmount > 0) {
            release(vestingScheduleId, vestedAmount);
        }
        
        uint256 unreleased = vestingSchedule.amountTotal.sub(vestingSchedule.released);
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.sub(unreleased);
        vestingSchedule.revoked = true;

        emit VestingScheduleRevoked(vestingScheduleId, vestingSchedule.beneficiary, unreleased);
    }

    /**
     * @notice Release vested amount of tokens
     * @param vestingScheduleId the vesting schedule identifier
     * @param amount the amount to release
     */
    function release(bytes32 vestingScheduleId, uint256 amount) public nonReentrant whenNotPaused {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        bool isBeneficiary = msg.sender == vestingSchedule.beneficiary;
        bool isOwner = msg.sender == owner();
        require(
            isBeneficiary || isOwner,
            "TokenVesting: only beneficiary and owner can release vested tokens"
        );
        require(vestingSchedule.initialized, "TokenVesting: vesting schedule not initialized");
        require(!vestingSchedule.revoked, "TokenVesting: vesting schedule revoked");
        
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        require(vestedAmount >= amount, "TokenVesting: cannot release tokens, not enough vested tokens");
        
        vestingSchedule.released = vestingSchedule.released.add(amount);
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.sub(amount);
        _token.safeTransfer(vestingSchedule.beneficiary, amount);

        emit TokensReleased(vestingScheduleId, vestingSchedule.beneficiary, amount);
    }

    /**
     * @dev Returns the number of vesting schedules associated to a beneficiary
     * @param _beneficiary address of the beneficiary
     * @return the number of vesting schedules
     */
    function getVestingSchedulesCountByBeneficiary(address _beneficiary)
        external
        view
        returns (uint256)
    {
        return beneficiaryVestingSchedules[_beneficiary].length;
    }

    /**
     * @dev Returns the vesting schedule id at the given index for a beneficiary
     * @param _beneficiary address of the beneficiary
     * @param _index index of the vesting schedule
     * @return the vesting schedule id
     */
    function getVestingIdAtIndex(address _beneficiary, uint256 _index)
        external
        view
        returns (bytes32)
    {
        require(
            _index < beneficiaryVestingSchedules[_beneficiary].length,
            "TokenVesting: index out of bounds"
        );
        return beneficiaryVestingSchedules[_beneficiary][_index];
    }

    /**
     * @notice Returns the vesting schedule information for a given identifier
     * @param vestingScheduleId the vesting schedule identifier
     * @return the vesting schedule structure information
     */
    function getVestingSchedule(bytes32 vestingScheduleId)
        external
        view
        returns (VestingSchedule memory)
    {
        return vestingSchedules[vestingScheduleId];
    }

    /**
     * @dev Returns the amount of tokens that can be withdrawn by the owner
     * @return the amount of tokens
     */
    function getWithdrawableAmount() public view returns (uint256) {
        return _token.balanceOf(address(this)).sub(vestingSchedulesTotalAmount);
    }

    /**
     * @dev Computes the next vesting schedule identifier for a given holder address
     * @param holder address of the holder
     * @return the next vesting schedule identifier
     */
    function computeNextVestingScheduleIdForHolder(address holder)
        public
        view
        returns (bytes32)
    {
        return computeVestingScheduleIdForAddressAndIndex(holder, beneficiaryVestingSchedules[holder].length);
    }

    /**
     * @dev Computes the vesting schedule identifier for an address and an index
     * @param holder address of the holder
     * @param index index of the vesting schedule
     * @return the vesting schedule identifier
     */
    function computeVestingScheduleIdForAddressAndIndex(address holder, uint256 index)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
     * @dev Computes the releasable amount of tokens for a vesting schedule
     * @param vestingSchedule the vesting schedule
     * @return the amount of releasable tokens
     */
    function computeReleasableAmount(bytes32 vestingScheduleId)
        external
        view
        returns (uint256)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        return _computeReleasableAmount(vestingSchedule);
    }

    /**
     * @dev Computes the vested amount of tokens for a vesting schedule
     * @param vestingSchedule the vesting schedule
     * @return the vested amount
     */
    function _computeReleasableAmount(VestingSchedule memory vestingSchedule)
        internal
        view
        returns (uint256)
    {
        if (!vestingSchedule.initialized || vestingSchedule.revoked) {
            return 0;
        }
        
        uint256 currentTime = getCurrentTime();
        if (currentTime < vestingSchedule.cliff) {
            return 0;
        } else if (currentTime >= vestingSchedule.start.add(vestingSchedule.duration)) {
            return vestingSchedule.amountTotal.sub(vestingSchedule.released);
        } else {
            uint256 timeFromStart = currentTime.sub(vestingSchedule.start);
            uint256 secondsPerSlice = vestingSchedule.slicePeriodSeconds;
            uint256 vestedSlicePeriods = timeFromStart.div(secondsPerSlice);
            uint256 vestedSeconds = vestedSlicePeriods.mul(secondsPerSlice);
            uint256 vestedAmount = vestingSchedule.amountTotal.mul(vestedSeconds).div(vestingSchedule.duration);
            return vestedAmount.sub(vestingSchedule.released);
        }
    }

    /**
     * @dev Returns the current time
     * @return the current timestamp in seconds
     */
    function getCurrentTime() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    /**
     * @dev Withdraw the specified amount if possible
     * @param amount the amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner whenNotPaused {
        require(
            getWithdrawableAmount() >= amount,
            "TokenVesting: not enough withdrawable funds"
        );
        _token.safeTransfer(owner(), amount);
        emit TokensWithdrawn(owner(), amount);
    }

    /**
     * @dev Returns the address of the BEP20 token managed by the vesting contract
     */
    function getToken() external view returns (address) {
        return address(_token);
    }

    /**
     * @dev Returns the number of vesting schedules managed by this contract
     * @return the number of vesting schedules
     */
    function getVestingSchedulesCount() external view returns (uint256) {
        return vestingSchedulesIds;
    }

    /**
     * @dev Returns the total amount of vesting schedules
     * @return the total amount of vesting schedules in wei
     */
    function getVestingSchedulesTotalAmount() external view returns (uint256) {
        return vestingSchedulesTotalAmount;
    }

    /**
     * @dev Pause the contract - emergency function
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to recover any BEP20 token sent to this contract by mistake
     * @param tokenAddress the token contract address
     * @param tokenAmount number of tokens to be sent
     */
    function recoverBEP20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(_token), "TokenVesting: cannot recover vesting token");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
    }
}