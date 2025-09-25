# BEP20 Token Vesting Contract / BEP20 टोकन वेस्टिंग कॉन्ट्रैक्ट

एक सुरक्षित और विश्वसनीय BEP20 टोकन वेस्टिंग स्मार्ट कॉन्ट्रैक्ट जो Binance Smart Chain पर काम करता है।

A secure and reliable BEP20 token vesting smart contract that works on Binance Smart Chain.

## विशेषताएं / Features

### 🔒 सुरक्षा विशेषताएं / Security Features
- **OpenZeppelin** लाइब्रेरी का उपयोग
- **ReentrancyGuard** - Re-entrancy attacks से सुरक्षा
- **Pausable** - आपातकालीन स्थिति में contract को रोकने की सुविधा
- **Ownable** - केवल owner ही महत्वपूर्ण functions को execute कर सकता है
- **SafeERC20** - सुरक्षित token transfers

### 📅 वेस्टिंग विशेषताएं / Vesting Features
- **Cliff Period** - शुरुआती लॉक अवधि
- **Linear Vesting** - समय के साथ tokens की gradual release
- **Custom Schedules** - अलग-अलग beneficiaries के लिए अलग schedules
- **Revocable Vesting** - जरूरत पड़ने पर vesting को cancel करने की सुविधा
- **Multiple Beneficiaries** - एक ही contract में कई beneficiaries

### 🛠️ प्रबंधन विशेषताएं / Management Features
- **Beneficiary Management** - beneficiaries को add/remove करना
- **Token Recovery** - गलती से भेजे गए tokens को recover करना
- **Withdrawal** - excess tokens को withdraw करना
- **Emergency Pause** - आपातकाल में contract को pause करना

## स्थापना / Installation

```bash
# Repository clone करें
git clone <repository-url>
cd sky-vesting

# Dependencies install करें
npm install

# Environment variables setup करें
cp .env.example .env
# .env file में अपनी details भरें
```

## Environment Variables

`.env` file में निम्नलिखित variables को set करें:

```env
PRIVATE_KEY=your_private_key_here
BSCSCAN_API_KEY=your_bscscan_api_key_here
TOKEN_ADDRESS=0x... # आपके token का address
REPORT_GAS=true
```

## उपयोग / Usage

### Contract Compile करना

```bash
npm run compile
```

### Tests चलाना

```bash
npm run test
```

### Deployment

#### Testnet पर Deploy करना
```bash
npm run deploy:testnet
```

#### Mainnet पर Deploy करना
```bash
npm run deploy:mainnet
```

## Contract Functions

### Owner Functions

#### `createVestingSchedule()`
नया vesting schedule बनाता है।

```solidity
function createVestingSchedule(
    address _beneficiary,    // beneficiary का address
    uint256 _start,         // vesting start time (timestamp)
    uint256 _cliff,         // cliff period (seconds)
    uint256 _duration,      // total vesting duration (seconds)
    uint256 _slicePeriodSeconds, // release interval (seconds)
    bool _revocable,        // क्या revoke किया जा सकता है
    uint256 _amount         // total tokens amount
) external onlyOwner
```

#### `revoke()`
Vesting schedule को revoke करता है।

```solidity
function revoke(bytes32 vestingScheduleId) external onlyOwner
```

#### `withdraw()`
Excess tokens को withdraw करता है।

```solidity
function withdraw(uint256 amount) external onlyOwner
```

### Beneficiary Functions

#### `release()`
Vested tokens को release करता है।

```solidity
function release(bytes32 vestingScheduleId, uint256 amount) public
```

### View Functions

#### `computeReleasableAmount()`
Release किए जा सकने वाले tokens की मात्रा check करता है।

```solidity
function computeReleasableAmount(bytes32 vestingScheduleId) external view returns (uint256)
```

#### `getVestingSchedule()`
Vesting schedule की details देता है।

```solidity
function getVestingSchedule(bytes32 vestingScheduleId) external view returns (VestingSchedule memory)
```

## उदाहरण / Example Usage

### JavaScript में Contract का उपयोग

```javascript
const { ethers } = require("hardhat");

async function createVestingExample() {
    const tokenVesting = await ethers.getContractAt("TokenVesting", contractAddress);
    
    const beneficiary = "0x..."; // beneficiary address
    const start = Math.floor(Date.now() / 1000); // current timestamp
    const cliff = 30 * 24 * 60 * 60; // 30 days cliff
    const duration = 365 * 24 * 60 * 60; // 1 year duration
    const slicePeriod = 24 * 60 * 60; // daily release
    const revocable = true;
    const amount = ethers.utils.parseEther("1000"); // 1000 tokens
    
    await tokenVesting.createVestingSchedule(
        beneficiary,
        start,
        cliff,
        duration,
        slicePeriod,
        revocable,
        amount
    );
}
```

## सुरक्षा विचार / Security Considerations

### ✅ सुरक्षा सुविधाएं
- **Audited Libraries**: OpenZeppelin contracts का उपयोग
- **Access Control**: केवल authorized users ही functions execute कर सकते हैं
- **Reentrancy Protection**: Re-entrancy attacks से सुरक्षा
- **Safe Math**: Overflow/underflow protection
- **Emergency Pause**: आपातकाल में contract को रोकने की सुविधा

### ⚠️ सावधानियां
- Private key को secure रखें
- Contract deploy करने से पहले testnet पर test करें
- Large amounts के साथ काम करने से पहले thorough testing करें
- Contract को pause करने की power का सही उपयोग करें

## Gas Optimization

Contract में निम्नलिखित gas optimization techniques का उपयोग किया गया है:

- **Packed Structs**: Storage slots का efficient उपयोग
- **View Functions**: State को modify नहीं करने वाले functions
- **SafeMath**: Solidity 0.8+ में built-in overflow protection
- **Immutable Variables**: Deploy time पर set होने वाले variables

## Testing

Contract में comprehensive test suite शामिल है:

```bash
# सभी tests चलाने के लिए
npm run test

# Coverage report के लिए
npm run coverage

# Gas report के लिए
REPORT_GAS=true npm run test
```

## Deployment Verification

Contract deploy करने के बाद BSCScan पर verify करना:

```bash
npx hardhat verify --network bscMainnet <CONTRACT_ADDRESS> <TOKEN_ADDRESS>
```

## License

यह project MIT License के तहत licensed है।

## Support

किसी भी समस्या या सवाल के लिए:
- GitHub Issues में report करें
- Documentation को carefully पढ़ें
- Test cases को देखें examples के लिए

## Disclaimer

यह smart contract educational और development purposes के लिए है। Production में उपयोग करने से पहले proper audit कराएं।

---

**महत्वपूर्ण**: Production environment में deploy करने से पहले हमेशा testnet पर thorough testing करें.