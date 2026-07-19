// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { SignedMath } from "@openzeppelin/contracts/utils/math/SignedMath.sol";
import { ParticipantRegistry } from "./ParticipantRegistry.sol";
import { INetfoldClearinghouse } from "./interfaces/INetfoldClearinghouse.sol";

/// @title NETFOLD Clearinghouse
/// @notice Net-settles accepted obligations without granting the administrator custody powers.
contract NetfoldClearinghouse is AccessControl, Pausable, ReentrancyGuard, INetfoldClearinghouse {
    using SafeERC20 for IERC20;

    error AlreadyConfigured();
    error AlreadyFunded();
    error AlreadyJoined();
    error BoundExceeded();
    error ClearingIncomplete();
    error DeadlineNotReached();
    error EpochNotCancellable();
    error ExactFundingRequired();
    error FundingWindowClosed();
    error Insolvent();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDuration();
    error InvalidEpochStatus();
    error InvalidPosition();
    error LiabilityUnderflow();
    error NotEpochCreator();
    error NotJoined();
    error NotRegistered();
    error NothingToWithdraw();
    error ObligationsRemain();
    error ObligationAlreadyApplied();
    error ObligationNotApplied();
    error OnlyObligationBook();
    error PositionNotZero();
    error UnsupportedToken();
    error WrongToken();
    error ZeroAmount();

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_PARTICIPANTS = 64;
    uint256 public constant MAX_OBLIGATIONS = 256;
    uint64 public constant MIN_FUNDING_DURATION = 5 minutes;
    uint64 public constant MAX_FUNDING_DURATION = 30 days;

    enum EpochStatus {
        NONE,
        OPEN,
        LOCKED,
        FUNDING,
        SETTLED,
        DEFAULTED,
        CANCELLED
    }

    struct Epoch {
        address token;
        address creator;
        EpochStatus status;
        uint64 createdAt;
        uint64 fundingDuration;
        uint64 fundingDeadline;
        uint16 participantCount;
        uint16 obligationCount;
        uint256 bondAmount;
        uint256 grossVolume;
        uint256 totalNetDebit;
        uint256 totalNetCredit;
        uint256 totalFunded;
        uint256 liquiditySaved;
        bytes32 datasetHash;
    }

    ParticipantRegistry public immutable registry;
    address public immutable usdc;
    address public immutable eurc;
    address public obligationBook;
    uint256 public nextEpochId = 1;

    mapping(uint256 epochId => Epoch epoch) private _epochs;
    mapping(uint256 epochId => address[] participants) private _participants;
    mapping(uint256 epochId => mapping(address participant => uint256 indexPlusOne)) private
        _participantIndexPlusOne;
    mapping(uint256 epochId => mapping(address participant => bool joined)) public joined;
    mapping(uint256 epochId => mapping(address participant => int256 position)) public positions;
    mapping(uint256 epochId => mapping(uint256 obligationId => bool applied)) public
        obligationApplied;
    mapping(uint256 epochId => mapping(address participant => uint256 count)) public
        obligationTouchCount;
    mapping(uint256 epochId => mapping(address participant => uint256 amount)) public fundedAmount;
    mapping(uint256 epochId => mapping(address participant => uint256 amount)) public claimable;
    mapping(uint256 epochId => mapping(address participant => uint256 amount)) public
        refundableDeposit;
    mapping(uint256 epochId => mapping(address participant => uint256 amount)) public bondBalance;
    mapping(uint256 epochId => mapping(address participant => uint256 amount)) public
        recoveryClaimable;
    mapping(address token => uint256 amount) public totalLiability;

    event ObligationBookConfigured(address indexed obligationBook);
    event EpochCreated(
        uint256 indexed epochId,
        address indexed token,
        address indexed creator,
        uint64 fundingDuration,
        uint256 bondAmount
    );
    event ParticipantJoined(uint256 indexed epochId, address indexed participant, uint256 bond);
    event ParticipantLeft(uint256 indexed epochId, address indexed participant);
    event ObligationApplied(
        uint256 indexed epochId,
        uint256 indexed obligationId,
        address indexed debtor,
        address creditor,
        uint256 amount
    );
    event ObligationReversed(uint256 indexed epochId, uint256 indexed obligationId);
    event EpochLocked(
        uint256 indexed epochId,
        uint256 grossVolume,
        uint256 netSettlementVolume,
        uint256 liquiditySaved,
        bytes32 datasetHash
    );
    event FundingOpened(uint256 indexed epochId, uint64 fundingDeadline);
    event DebitFunded(uint256 indexed epochId, address indexed debtor, uint256 amount);
    event EpochSettled(uint256 indexed epochId);
    event EpochDefaulted(uint256 indexed epochId, uint256 slashedBonds);
    event EpochCancelled(uint256 indexed epochId);
    event CreditClaimed(uint256 indexed epochId, address indexed creditor, uint256 amount);
    event DepositRefunded(uint256 indexed epochId, address indexed debtor, uint256 amount);
    event BondWithdrawn(uint256 indexed epochId, address indexed participant, uint256 amount);
    event RecoveryClaimed(uint256 indexed epochId, address indexed creditor, uint256 amount);

    constructor(address initialAdmin, ParticipantRegistry registry_, address usdc_, address eurc_) {
        if (
            initialAdmin == address(0) || address(registry_) == address(0) || usdc_ == address(0)
                || eurc_ == address(0) || usdc_ == eurc_
        ) revert InvalidAddress();
        registry = registry_;
        usdc = usdc_;
        eurc = eurc_;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
    }

    modifier onlyBook() {
        if (msg.sender != obligationBook) revert OnlyObligationBook();
        _;
    }

    function configureObligationBook(address obligationBook_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (obligationBook != address(0)) revert AlreadyConfigured();
        if (obligationBook_ == address(0)) revert InvalidAddress();
        obligationBook = obligationBook_;
        emit ObligationBookConfigured(obligationBook_);
    }

    function createEpoch(address token, uint64 fundingDuration, uint256 bondAmount)
        external
        whenNotPaused
        returns (uint256 epochId)
    {
        if (!registry.isActive(msg.sender)) revert NotRegistered();
        if (!isSupportedToken(token)) revert UnsupportedToken();
        if (fundingDuration < MIN_FUNDING_DURATION || fundingDuration > MAX_FUNDING_DURATION) {
            revert InvalidDuration();
        }
        if (bondAmount == 0) revert ZeroAmount();

        epochId = nextEpochId++;
        _epochs[epochId] = Epoch({
            token: token,
            creator: msg.sender,
            status: EpochStatus.OPEN,
            createdAt: uint64(block.timestamp),
            fundingDuration: fundingDuration,
            fundingDeadline: 0,
            participantCount: 0,
            obligationCount: 0,
            bondAmount: bondAmount,
            grossVolume: 0,
            totalNetDebit: 0,
            totalNetCredit: 0,
            totalFunded: 0,
            liquiditySaved: 0,
            datasetHash: bytes32(0)
        });
        emit EpochCreated(epochId, token, msg.sender, fundingDuration, bondAmount);
    }

    function joinEpoch(uint256 epochId) external whenNotPaused nonReentrant {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.OPEN);
        if (!registry.isActive(msg.sender)) revert NotRegistered();
        if (joined[epochId][msg.sender]) revert AlreadyJoined();
        if (epoch.participantCount >= MAX_PARTICIPANTS) revert BoundExceeded();
        if (
            _participantIndexPlusOne[epochId][msg.sender] == 0
                && _participants[epochId].length >= MAX_PARTICIPANTS
        ) revert BoundExceeded();

        IERC20(epoch.token).safeTransferFrom(msg.sender, address(this), epoch.bondAmount);
        _increaseLiability(epoch.token, epoch.bondAmount);
        joined[epochId][msg.sender] = true;
        bondBalance[epochId][msg.sender] = epoch.bondAmount;
        if (_participantIndexPlusOne[epochId][msg.sender] == 0) {
            _participants[epochId].push(msg.sender);
            _participantIndexPlusOne[epochId][msg.sender] = _participants[epochId].length;
        }
        epoch.participantCount++;
        emit ParticipantJoined(epochId, msg.sender, epoch.bondAmount);
    }

    function leaveEpoch(uint256 epochId) external nonReentrant {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.OPEN);
        if (!joined[epochId][msg.sender]) revert NotJoined();
        if (positions[epochId][msg.sender] != 0) revert PositionNotZero();
        if (obligationTouchCount[epochId][msg.sender] != 0) revert ObligationsRemain();

        joined[epochId][msg.sender] = false;
        epoch.participantCount--;
        uint256 bond = bondBalance[epochId][msg.sender];
        bondBalance[epochId][msg.sender] = 0;
        _decreaseLiability(epoch.token, bond);
        IERC20(epoch.token).safeTransfer(msg.sender, bond);
        _assertSolvent(epoch.token);
        emit ParticipantLeft(epochId, msg.sender);
    }

    function recordAcceptedObligation(
        uint256 obligationId,
        uint256 epochId,
        address token,
        address debtor,
        address creditor,
        uint256 amount
    ) external override onlyBook whenNotPaused {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.OPEN);
        if (token != epoch.token) revert WrongToken();
        if (!joined[epochId][debtor] || !joined[epochId][creditor]) revert NotJoined();
        if (amount == 0) revert ZeroAmount();
        if (amount > uint256(type(int256).max)) revert InvalidAmount();
        if (epoch.obligationCount >= MAX_OBLIGATIONS) revert BoundExceeded();
        if (obligationApplied[epochId][obligationId]) revert ObligationAlreadyApplied();

        int256 signedAmount = SafeCast.toInt256(amount);
        obligationApplied[epochId][obligationId] = true;
        positions[epochId][debtor] -= signedAmount;
        positions[epochId][creditor] += signedAmount;
        obligationTouchCount[epochId][debtor]++;
        obligationTouchCount[epochId][creditor]++;
        epoch.obligationCount++;
        epoch.grossVolume += amount;
        emit ObligationApplied(epochId, obligationId, debtor, creditor, amount);
    }

    function cancelAcceptedObligation(
        uint256 obligationId,
        uint256 epochId,
        address debtor,
        address creditor,
        uint256 amount
    ) external override onlyBook {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.OPEN);
        if (!obligationApplied[epochId][obligationId]) revert ObligationNotApplied();

        int256 signedAmount = SafeCast.toInt256(amount);
        obligationApplied[epochId][obligationId] = false;
        positions[epochId][debtor] += signedAmount;
        positions[epochId][creditor] -= signedAmount;
        obligationTouchCount[epochId][debtor]--;
        obligationTouchCount[epochId][creditor]--;
        epoch.obligationCount--;
        epoch.grossVolume -= amount;
        emit ObligationReversed(epochId, obligationId);
    }

    function lockEpoch(uint256 epochId) external whenNotPaused {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.OPEN);
        if (msg.sender != epoch.creator) revert NotEpochCreator();
        if (epoch.obligationCount == 0) revert InvalidPosition();

        address[] memory participants = _sortedActiveParticipants(epochId);
        int256 positionSum = 0;
        uint256 totalDebit = 0;
        uint256 totalCredit = 0;
        bytes memory canonicalPositions = bytes("");
        for (uint256 i; i < participants.length; ++i) {
            address participant = participants[i];
            int256 position = positions[epochId][participant];
            positionSum += position;
            if (obligationTouchCount[epochId][participant] != 0) {
                canonicalPositions = abi.encodePacked(canonicalPositions, participant, position);
            }
            if (position < 0) totalDebit += SignedMath.abs(position);
            if (position > 0) totalCredit += SafeCast.toUint256(position);
        }
        if (positionSum != 0 || totalDebit == 0 || totalDebit != totalCredit) {
            revert InvalidPosition();
        }

        epoch.status = EpochStatus.LOCKED;
        epoch.totalNetDebit = totalDebit;
        epoch.totalNetCredit = totalCredit;
        epoch.liquiditySaved = epoch.grossVolume - totalDebit;
        epoch.datasetHash = keccak256(canonicalPositions);
        emit EpochLocked(
            epochId, epoch.grossVolume, totalDebit, epoch.liquiditySaved, epoch.datasetHash
        );

        epoch.status = EpochStatus.FUNDING;
        epoch.fundingDeadline = uint64(block.timestamp) + epoch.fundingDuration;
        emit FundingOpened(epochId, epoch.fundingDeadline);
    }

    function fundDebit(uint256 epochId) external nonReentrant {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.FUNDING);
        if (block.timestamp > epoch.fundingDeadline) revert FundingWindowClosed();
        int256 position = positions[epochId][msg.sender];
        if (position >= 0) revert InvalidPosition();
        if (fundedAmount[epochId][msg.sender] != 0) revert AlreadyFunded();

        uint256 amount = SignedMath.abs(position);
        IERC20(epoch.token).safeTransferFrom(msg.sender, address(this), amount);
        fundedAmount[epochId][msg.sender] = amount;
        epoch.totalFunded += amount;
        _increaseLiability(epoch.token, amount);
        emit DebitFunded(epochId, msg.sender, amount);
    }

    function finalize(uint256 epochId) external {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.FUNDING);
        if (epoch.totalFunded != epoch.totalNetDebit) revert ClearingIncomplete();

        epoch.status = EpochStatus.SETTLED;
        address[] memory participants = _sortedActiveParticipants(epochId);
        for (uint256 i; i < participants.length; ++i) {
            address participant = participants[i];
            int256 position = positions[epochId][participant];
            if (position > 0) {
                claimable[epochId][participant] = SafeCast.toUint256(position);
            }
        }
        emit EpochSettled(epochId);
    }

    function markDefault(uint256 epochId) external {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.FUNDING);
        if (block.timestamp <= epoch.fundingDeadline) revert DeadlineNotReached();
        if (epoch.totalFunded == epoch.totalNetDebit) revert ClearingIncomplete();

        epoch.status = EpochStatus.DEFAULTED;
        address[] memory participants = _sortedActiveParticipants(epochId);
        uint256 slashedPool = 0;
        address lastCreditor = address(0);
        for (uint256 i; i < participants.length; ++i) {
            address participant = participants[i];
            int256 position = positions[epochId][participant];
            if (position < 0) {
                uint256 funded = fundedAmount[epochId][participant];
                if (funded != 0) refundableDeposit[epochId][participant] = funded;
                if (funded == 0) {
                    slashedPool += bondBalance[epochId][participant];
                    bondBalance[epochId][participant] = 0;
                }
            } else if (position > 0) {
                lastCreditor = participant;
            }
        }

        uint256 allocated = 0;
        if (slashedPool != 0) {
            for (uint256 i; i < participants.length; ++i) {
                address participant = participants[i];
                int256 position = positions[epochId][participant];
                if (position <= 0) continue;
                uint256 recovery;
                if (participant == lastCreditor) {
                    recovery = slashedPool - allocated;
                } else {
                    recovery = (slashedPool * SafeCast.toUint256(position)) / epoch.totalNetCredit;
                    allocated += recovery;
                }
                recoveryClaimable[epochId][participant] = recovery;
            }
        }
        emit EpochDefaulted(epochId, slashedPool);
    }

    function cancelEpoch(uint256 epochId) external {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.OPEN);
        if (msg.sender != epoch.creator) revert NotEpochCreator();
        if (epoch.obligationCount != 0) revert EpochNotCancellable();
        epoch.status = EpochStatus.CANCELLED;
        emit EpochCancelled(epochId);
    }

    function claimCredit(uint256 epochId) external nonReentrant {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.SETTLED);
        uint256 amount = claimable[epochId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        claimable[epochId][msg.sender] = 0;
        _decreaseLiability(epoch.token, amount);
        IERC20(epoch.token).safeTransfer(msg.sender, amount);
        _assertSolvent(epoch.token);
        emit CreditClaimed(epochId, msg.sender, amount);
    }

    function withdrawRefund(uint256 epochId) external nonReentrant {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.DEFAULTED);
        uint256 amount = refundableDeposit[epochId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        refundableDeposit[epochId][msg.sender] = 0;
        _decreaseLiability(epoch.token, amount);
        IERC20(epoch.token).safeTransfer(msg.sender, amount);
        _assertSolvent(epoch.token);
        emit DepositRefunded(epochId, msg.sender, amount);
    }

    function withdrawBond(uint256 epochId) external nonReentrant {
        Epoch storage epoch = _epochs[epochId];
        if (
            epoch.status != EpochStatus.SETTLED && epoch.status != EpochStatus.DEFAULTED
                && epoch.status != EpochStatus.CANCELLED
        ) revert InvalidEpochStatus();
        uint256 amount = bondBalance[epochId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        bondBalance[epochId][msg.sender] = 0;
        _decreaseLiability(epoch.token, amount);
        IERC20(epoch.token).safeTransfer(msg.sender, amount);
        _assertSolvent(epoch.token);
        emit BondWithdrawn(epochId, msg.sender, amount);
    }

    function claimRecovery(uint256 epochId) external nonReentrant {
        Epoch storage epoch = _requireStatus(epochId, EpochStatus.DEFAULTED);
        uint256 amount = recoveryClaimable[epochId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        recoveryClaimable[epochId][msg.sender] = 0;
        _decreaseLiability(epoch.token, amount);
        IERC20(epoch.token).safeTransfer(msg.sender, amount);
        _assertSolvent(epoch.token);
        emit RecoveryClaimed(epochId, msg.sender, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return _epochs[epochId];
    }

    function getParticipants(uint256 epochId) external view returns (address[] memory) {
        return _sortedActiveParticipants(epochId);
    }

    function isEpochOpen(uint256 epochId) external view override returns (bool) {
        return _epochs[epochId].status == EpochStatus.OPEN;
    }

    function isSupportedToken(address token) public view returns (bool) {
        return token == usdc || token == eurc;
    }

    function isSolvent(address token) external view returns (bool) {
        return IERC20(token).balanceOf(address(this)) >= totalLiability[token];
    }

    function _requireStatus(uint256 epochId, EpochStatus required)
        private
        view
        returns (Epoch storage epoch)
    {
        epoch = _epochs[epochId];
        if (epoch.status != required) revert InvalidEpochStatus();
    }

    function _increaseLiability(address token, uint256 amount) private {
        totalLiability[token] += amount;
        _assertSolvent(token);
    }

    function _decreaseLiability(address token, uint256 amount) private {
        uint256 current = totalLiability[token];
        if (amount > current) revert LiabilityUnderflow();
        totalLiability[token] = current - amount;
    }

    function _assertSolvent(address token) private view {
        if (IERC20(token).balanceOf(address(this)) < totalLiability[token]) revert Insolvent();
    }

    function _sortedActiveParticipants(uint256 epochId)
        private
        view
        returns (address[] memory active)
    {
        Epoch storage epoch = _epochs[epochId];
        active = new address[](epoch.participantCount);
        address[] storage stored = _participants[epochId];
        uint256 count = 0;
        for (uint256 i; i < stored.length; ++i) {
            address participant = stored[i];
            if (!joined[epochId][participant]) continue;
            active[count++] = participant;
        }

        for (uint256 i = 1; i < active.length; ++i) {
            address value = active[i];
            uint256 j = i;
            while (j > 0 && uint160(active[j - 1]) > uint160(value)) {
                active[j] = active[j - 1];
                unchecked {
                    --j;
                }
            }
            active[j] = value;
        }
    }
}
