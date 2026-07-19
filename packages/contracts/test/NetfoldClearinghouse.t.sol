// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { NetfoldClearinghouse } from "../src/NetfoldClearinghouse.sol";
import { ObligationBook } from "../src/ObligationBook.sol";
import { ParticipantRegistry } from "../src/ParticipantRegistry.sol";
import { NetfoldTestBase } from "./NetfoldTestBase.sol";
import { BlocklistERC20, FalseReturnERC20, MockERC20 } from "./mocks/MockERC20.sol";

contract NetfoldClearinghouseTest is NetfoldTestBase {
    function test_CreateUsdcEpoch() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        assertEq(epoch.token, address(usdc));
        assertEq(epoch.creator, a);
        assertEq(uint8(epoch.status), uint8(NetfoldClearinghouse.EpochStatus.OPEN));
        assertEq(epoch.bondAmount, BOND);
    }

    function test_CreateEurcEpoch() public {
        uint256 epochId = _createEpoch(address(eurc), a);
        assertEq(clearinghouse.getEpoch(epochId).token, address(eurc));
    }

    function test_CreateRejectsUnsupportedToken() public {
        MockERC20 other = new MockERC20("Other", "OTHER", 6);
        vm.expectRevert(NetfoldClearinghouse.UnsupportedToken.selector);
        vm.prank(a);
        clearinghouse.createEpoch(address(other), FUNDING_DURATION, BOND);
    }

    function test_CreateRejectsUnregisteredCreator() public {
        vm.expectRevert(NetfoldClearinghouse.NotRegistered.selector);
        vm.prank(makeAddr("stranger"));
        clearinghouse.createEpoch(address(usdc), FUNDING_DURATION, BOND);
    }

    function test_CreateRejectsShortFundingWindow() public {
        vm.expectRevert(NetfoldClearinghouse.InvalidDuration.selector);
        vm.prank(a);
        clearinghouse.createEpoch(address(usdc), 1 minutes, BOND);
    }

    function test_CreateRejectsLongFundingWindow() public {
        vm.expectRevert(NetfoldClearinghouse.InvalidDuration.selector);
        vm.prank(a);
        clearinghouse.createEpoch(address(usdc), 31 days, BOND);
    }

    function test_CreateRejectsZeroBond() public {
        vm.expectRevert(NetfoldClearinghouse.ZeroAmount.selector);
        vm.prank(a);
        clearinghouse.createEpoch(address(usdc), FUNDING_DURATION, 0);
    }

    function test_JoinLocksBondAndTracksLiability() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        uint256 beforeBalance = usdc.balanceOf(a);
        _join(epochId, a);
        assertEq(usdc.balanceOf(a), beforeBalance - BOND);
        assertEq(clearinghouse.bondBalance(epochId, a), BOND);
        assertEq(clearinghouse.totalLiability(address(usdc)), BOND);
        assertTrue(clearinghouse.isSolvent(address(usdc)));
    }

    function test_JoinRejectsDuplicate() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        vm.expectRevert(NetfoldClearinghouse.AlreadyJoined.selector);
        vm.prank(a);
        clearinghouse.joinEpoch(epochId);
    }

    function test_JoinRejectsUnregisteredParticipant() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        vm.expectRevert(NetfoldClearinghouse.NotRegistered.selector);
        vm.prank(makeAddr("stranger"));
        clearinghouse.joinEpoch(epochId);
    }

    function test_UniqueParticipantHistoryIsCappedAt64() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        for (uint256 i; i < clearinghouse.MAX_PARTICIPANTS(); ++i) {
            address participant = address(uint160(10_000 + i));
            _registerAndFund(participant);
            _join(epochId, participant);
            vm.prank(participant);
            clearinghouse.leaveEpoch(epochId);
        }

        address overflowParticipant = address(uint160(20_000));
        _registerAndFund(overflowParticipant);
        vm.expectRevert(NetfoldClearinghouse.BoundExceeded.selector);
        vm.prank(overflowParticipant);
        clearinghouse.joinEpoch(epochId);
    }

    function test_LeaveOpenEpochRefundsBond() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        uint256 beforeBalance = usdc.balanceOf(a);
        vm.prank(a);
        clearinghouse.leaveEpoch(epochId);
        assertEq(usdc.balanceOf(a), beforeBalance + BOND);
        assertEq(clearinghouse.bondBalance(epochId, a), 0);
        assertEq(clearinghouse.totalLiability(address(usdc)), 0);
    }

    function test_RejoinDoesNotDuplicateParticipantOrPositions() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        vm.prank(a);
        clearinghouse.leaveEpoch(epochId);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, 10 * UNIT, 0), A_KEY);

        vm.prank(a);
        clearinghouse.lockEpoch(epochId);

        address[] memory participants = clearinghouse.getParticipants(epochId);
        assertEq(participants.length, 2);
        assertEq(clearinghouse.getEpoch(epochId).participantCount, 2);
        assertEq(clearinghouse.getEpoch(epochId).totalNetDebit, 10 * UNIT);
        assertEq(clearinghouse.getEpoch(epochId).totalNetCredit, 10 * UNIT);
    }

    function test_LeaveRejectsParticipantWithPosition() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(NetfoldClearinghouse.PositionNotZero.selector);
        vm.prank(a);
        clearinghouse.leaveEpoch(epochId);
    }

    function test_LeaveRejectsNetZeroParticipantWithAcceptedObligations() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        _proposeAndAccept(_input(epochId, address(usdc), b, a, UNIT, 0), B_KEY);

        assertEq(clearinghouse.positions(epochId, a), 0);
        vm.expectRevert(NetfoldClearinghouse.ObligationsRemain.selector);
        vm.prank(a);
        clearinghouse.leaveEpoch(epochId);
    }

    function test_AcceptRejectsWrongEpochToken() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        uint256 id = _propose(_input(epochId, address(eurc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(NetfoldClearinghouse.WrongToken.selector);
        vm.prank(b);
        book.accept(id);
    }

    function test_AcceptRejectsParticipantThatDidNotJoin() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(NetfoldClearinghouse.NotJoined.selector);
        vm.prank(b);
        book.accept(id);
    }

    function test_RecordAcceptedObligationRequiresBook() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        vm.expectRevert(NetfoldClearinghouse.OnlyObligationBook.selector);
        clearinghouse.recordAcceptedObligation(1, epochId, address(usdc), a, b, UNIT);
    }

    function test_RecordAcceptedObligationRejectsAmountAboveSignedRange() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);

        vm.expectRevert(NetfoldClearinghouse.InvalidAmount.selector);
        vm.prank(address(book));
        clearinghouse.recordAcceptedObligation(
            1, epochId, address(usdc), a, b, uint256(type(int256).max) + 1
        );
    }

    function test_AcceptedObligationCountIsCappedAt256() public {
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        for (uint256 id = 1; id <= clearinghouse.MAX_OBLIGATIONS(); ++id) {
            vm.prank(address(book));
            clearinghouse.recordAcceptedObligation(id, epochId, address(usdc), a, b, 1);
        }

        vm.expectRevert(NetfoldClearinghouse.BoundExceeded.selector);
        vm.prank(address(book));
        clearinghouse.recordAcceptedObligation(257, epochId, address(usdc), a, b, 1);
    }

    function test_LockRequiresEpochCreator() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.expectRevert(NetfoldClearinghouse.NotEpochCreator.selector);
        vm.prank(b);
        clearinghouse.lockEpoch(epochId);
    }

    function test_LockRejectsEmptyEpoch() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        vm.expectRevert(NetfoldClearinghouse.InvalidPosition.selector);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
    }

    function test_MandatoryCycleProducesExactPositions() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        assertEq(clearinghouse.positions(epochId, a), -int256(35 * UNIT));
        assertEq(clearinghouse.positions(epochId, b), int256(25 * UNIT));
        assertEq(clearinghouse.positions(epochId, c), 0);
        assertEq(clearinghouse.positions(epochId, d), int256(10 * UNIT));
    }

    function test_LockCalculates265To35Metrics() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        assertEq(epoch.grossVolume, 265 * UNIT);
        assertEq(epoch.totalNetDebit, 35 * UNIT);
        assertEq(epoch.totalNetCredit, 35 * UNIT);
        assertEq(epoch.liquiditySaved, 230 * UNIT);
        assertEq(epoch.datasetHash, _mandatoryPositionHash());
        assertEq(uint8(epoch.status), uint8(NetfoldClearinghouse.EpochStatus.FUNDING));
    }

    function test_FundDebitTransfersExactNetDebit() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        uint256 beforeBalance = usdc.balanceOf(a);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
        assertEq(usdc.balanceOf(a), beforeBalance - 35 * UNIT);
        assertEq(clearinghouse.fundedAmount(epochId, a), 35 * UNIT);
        assertEq(clearinghouse.getEpoch(epochId).totalFunded, 35 * UNIT);
    }

    function test_FundRejectsCreditor() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.expectRevert(NetfoldClearinghouse.InvalidPosition.selector);
        vm.prank(b);
        clearinghouse.fundDebit(epochId);
    }

    function test_FundRejectsDuplicate() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        vm.expectRevert(NetfoldClearinghouse.AlreadyFunded.selector);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
    }

    function test_FundRejectsAfterDeadline() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.warp(clearinghouse.getEpoch(epochId).fundingDeadline + 1);

        vm.expectRevert(NetfoldClearinghouse.FundingWindowClosed.selector);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
    }

    function test_FinalizeRejectsIncompleteFunding() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.expectRevert(NetfoldClearinghouse.ClearingIncomplete.selector);
        clearinghouse.finalize(epochId);
    }

    function test_FinalizeCreatesIndependentClaims() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        assertEq(clearinghouse.claimable(epochId, b), 25 * UNIT);
        assertEq(clearinghouse.claimable(epochId, d), 10 * UNIT);
        assertEq(clearinghouse.claimable(epochId, a), 0);
    }

    function test_CreditorBClaims25() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        uint256 beforeBalance = usdc.balanceOf(b);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        assertEq(usdc.balanceOf(b), beforeBalance + 25 * UNIT);
        assertEq(clearinghouse.claimable(epochId, b), 0);
    }

    function test_CreditorDClaims10() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        uint256 beforeBalance = usdc.balanceOf(d);
        vm.prank(d);
        clearinghouse.claimCredit(epochId);
        assertEq(usdc.balanceOf(d), beforeBalance + 10 * UNIT);
    }

    function test_ClaimReplayReverts() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        vm.expectRevert(NetfoldClearinghouse.NothingToWithdraw.selector);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
    }

    function test_ClaimsAreOrderIndependent() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        vm.prank(d);
        clearinghouse.claimCredit(epochId);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        assertEq(clearinghouse.claimable(epochId, b), 0);
        assertEq(clearinghouse.claimable(epochId, d), 0);
    }

    function test_MarkDefaultRejectsBeforeDeadline() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.expectRevert(NetfoldClearinghouse.DeadlineNotReached.selector);
        clearinghouse.markDefault(epochId);
    }

    function test_DefaultSlashesOnlyUnfundedDebtorBond() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        assertEq(clearinghouse.bondBalance(epochId, a), 0);
        assertEq(clearinghouse.bondBalance(epochId, b), BOND);
        assertEq(clearinghouse.bondBalance(epochId, c), BOND);
        assertEq(clearinghouse.bondBalance(epochId, d), BOND);
    }

    function test_DefaultAllocatesProRataRecoveryWithDustToHighestAddressCreditor() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        assertEq(clearinghouse.recoveryClaimable(epochId, b), 1_428_572);
        assertEq(clearinghouse.recoveryClaimable(epochId, d), 571_428);
        assertEq(
            clearinghouse.recoveryClaimable(epochId, b)
                + clearinghouse.recoveryClaimable(epochId, d),
            BOND
        );
    }

    function test_DefaultRefundsFundedDebtorPrincipal() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        _proposeAndAccept(_input(epochId, address(usdc), a, b, 50 * UNIT, 0), A_KEY);
        _proposeAndAccept(_input(epochId, address(usdc), c, d, 40 * UNIT, 0), C_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        assertEq(clearinghouse.refundableDeposit(epochId, a), 50 * UNIT);
        uint256 beforeBalance = usdc.balanceOf(a);
        vm.prank(a);
        clearinghouse.withdrawRefund(epochId);
        assertEq(usdc.balanceOf(a), beforeBalance + 50 * UNIT);
    }

    function test_DefaultRefundCannotCoexistWithSettlementClaim() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        _proposeAndAccept(_input(epochId, address(usdc), a, b, 50 * UNIT, 0), A_KEY);
        _proposeAndAccept(_input(epochId, address(usdc), c, d, 40 * UNIT, 0), C_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        assertEq(clearinghouse.claimable(epochId, b), 0);
        assertEq(clearinghouse.claimable(epochId, d), 0);
    }

    function test_RecoveryClaimIsPullBased() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        uint256 beforeBalance = usdc.balanceOf(b);
        vm.prank(b);
        clearinghouse.claimRecovery(epochId);
        assertEq(usdc.balanceOf(b), beforeBalance + 1_428_572);
        assertEq(clearinghouse.recoveryClaimable(epochId, b), 0);
    }

    function test_CancelEmptyEpochAllowsBondWithdrawal() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        vm.prank(a);
        clearinghouse.cancelEpoch(epochId);
        uint256 beforeBalance = usdc.balanceOf(b);
        vm.prank(b);
        clearinghouse.withdrawBond(epochId);
        assertEq(usdc.balanceOf(b), beforeBalance + BOND);
    }

    function test_CancelRejectsEpochWithAcceptedObligation() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        _proposeAndAccept(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(NetfoldClearinghouse.EpochNotCancellable.selector);
        vm.prank(a);
        clearinghouse.cancelEpoch(epochId);
    }

    function test_BondsWithdrawAfterSettlement() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        uint256 beforeBalance = usdc.balanceOf(c);
        vm.prank(c);
        clearinghouse.withdrawBond(epochId);
        assertEq(usdc.balanceOf(c), beforeBalance + BOND);
    }

    function test_DefaultingDebtorCannotWithdrawSlashedBond() public {
        uint256 epochId = _mandatoryCycle(address(usdc));
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        vm.expectRevert(NetfoldClearinghouse.NothingToWithdraw.selector);
        vm.prank(a);
        clearinghouse.withdrawBond(epochId);
    }

    function test_PauseBlocksNewEpochs() public {
        vm.prank(admin);
        clearinghouse.pause();
        vm.expectRevert();
        vm.prank(a);
        clearinghouse.createEpoch(address(usdc), FUNDING_DURATION, BOND);
    }

    function test_PauseNeverBlocksClaims() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        vm.prank(admin);
        clearinghouse.pause();
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        assertEq(clearinghouse.claimable(epochId, b), 0);
    }

    function test_PauseNeverBlocksRefunds() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        _proposeAndAccept(_input(epochId, address(usdc), a, b, 50 * UNIT, 0), A_KEY);
        _proposeAndAccept(_input(epochId, address(usdc), c, d, 40 * UNIT, 0), C_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        vm.prank(admin);
        clearinghouse.pause();
        vm.prank(a);
        clearinghouse.withdrawRefund(epochId);
        assertEq(clearinghouse.refundableDeposit(epochId, a), 0);
    }

    function test_PauseNeverBlocksBondWithdrawals() public {
        uint256 epochId = _createAndJoinFour(address(usdc));
        vm.prank(a);
        clearinghouse.cancelEpoch(epochId);
        vm.prank(admin);
        clearinghouse.pause();
        vm.prank(b);
        clearinghouse.withdrawBond(epochId);
        assertEq(clearinghouse.bondBalance(epochId, b), 0);
    }

    function test_EurcEpochSettlesIndependently() public {
        uint256 epochId = _lockAndFundMandatory(address(eurc));
        clearinghouse.finalize(epochId);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        assertEq(clearinghouse.claimable(epochId, b), 0);
        assertTrue(clearinghouse.isSolvent(address(eurc)));
    }

    function test_MultipleEpochsDoNotMixAccounting() public {
        uint256 usdcEpoch = _lockAndFundMandatory(address(usdc));
        uint256 eurcEpoch = _lockAndFundMandatory(address(eurc));
        clearinghouse.finalize(usdcEpoch);
        clearinghouse.finalize(eurcEpoch);
        assertEq(clearinghouse.claimable(usdcEpoch, b), 25 * UNIT);
        assertEq(clearinghouse.claimable(eurcEpoch, b), 25 * UNIT);
        assertEq(clearinghouse.getEpoch(usdcEpoch).token, address(usdc));
        assertEq(clearinghouse.getEpoch(eurcEpoch).token, address(eurc));
    }

    function test_LiabilityNeverExceedsBalanceThroughSettlement() public {
        uint256 epochId = _lockAndFundMandatory(address(usdc));
        clearinghouse.finalize(epochId);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        vm.prank(d);
        clearinghouse.claimCredit(epochId);
        vm.prank(a);
        clearinghouse.withdrawBond(epochId);
        assertTrue(clearinghouse.isSolvent(address(usdc)));
        assertGe(
            usdc.balanceOf(address(clearinghouse)), clearinghouse.totalLiability(address(usdc))
        );
    }

    function test_AdminHasNoParticipantFundWithdrawalSurface() public {
        (bool success,) = address(clearinghouse)
            .call(abi.encodeWithSignature("adminWithdraw(address,uint256)", address(usdc), UNIT));
        assertFalse(success);
    }

    function test_FailedBlockedClaimKeepsClaimAndDoesNotBlockOtherCreditor() public {
        (
            BlocklistERC20 token,
            NetfoldClearinghouse localClearing,
            ObligationBook localBook,
            uint256 epochId
        ) = _settledBlocklistFixture();
        token.setBlocked(b, true);
        vm.expectRevert();
        vm.prank(b);
        localClearing.claimCredit(epochId);
        assertEq(localClearing.claimable(epochId, b), 25 * UNIT);

        uint256 beforeBalance = token.balanceOf(d);
        vm.prank(d);
        localClearing.claimCredit(epochId);
        assertEq(token.balanceOf(d), beforeBalance + 10 * UNIT);
        assertEq(address(localBook).code.length > 0, true);
    }

    function test_SafeERC20RejectsFalseReturnOnJoin() public {
        FalseReturnERC20 falseToken = new FalseReturnERC20();
        ParticipantRegistry localRegistry = new ParticipantRegistry(admin);
        NetfoldClearinghouse localClearing =
            new NetfoldClearinghouse(admin, localRegistry, address(falseToken), address(eurc));
        vm.prank(a);
        localRegistry.register(keccak256("a"));
        falseToken.mint(a, 10 * UNIT);
        vm.prank(a);
        falseToken.approve(address(localClearing), type(uint256).max);
        vm.prank(a);
        uint256 epochId = localClearing.createEpoch(address(falseToken), FUNDING_DURATION, BOND);
        vm.expectRevert();
        vm.prank(a);
        localClearing.joinEpoch(epochId);
    }

    function _settledBlocklistFixture()
        internal
        returns (
            BlocklistERC20 token,
            NetfoldClearinghouse localClearing,
            ObligationBook localBook,
            uint256 epochId
        )
    {
        token = new BlocklistERC20();
        ParticipantRegistry localRegistry = new ParticipantRegistry(admin);
        localBook = new ObligationBook(admin);
        localClearing =
            new NetfoldClearinghouse(admin, localRegistry, address(token), address(eurc));
        vm.startPrank(admin);
        localBook.configureClearinghouse(address(localClearing));
        localClearing.configureObligationBook(address(localBook));
        vm.stopPrank();

        address[4] memory actors = [a, b, c, d];
        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            localRegistry.register(keccak256(abi.encode(actors[i])));
            token.mint(actors[i], 1_000 * UNIT);
            vm.prank(actors[i]);
            token.approve(address(localClearing), type(uint256).max);
        }
        vm.prank(a);
        epochId = localClearing.createEpoch(address(token), FUNDING_DURATION, BOND);
        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            localClearing.joinEpoch(epochId);
        }

        _localAccepted(localBook, epochId, address(token), a, b, 100 * UNIT, 0, A_KEY);
        _localAccepted(localBook, epochId, address(token), b, c, 70 * UNIT, 0, B_KEY);
        _localAccepted(localBook, epochId, address(token), c, a, 50 * UNIT, 0, C_KEY);
        _localAccepted(localBook, epochId, address(token), c, d, 20 * UNIT, 1, C_KEY);
        _localAccepted(localBook, epochId, address(token), d, b, 10 * UNIT, 0, D_KEY);
        _localAccepted(localBook, epochId, address(token), b, a, 15 * UNIT, 1, B_KEY);
        vm.prank(a);
        localClearing.lockEpoch(epochId);
        vm.prank(a);
        localClearing.fundDebit(epochId);
        localClearing.finalize(epochId);
    }

    function _localAccepted(
        ObligationBook localBook,
        uint256 epochId,
        address token,
        address debtor,
        address creditor,
        uint256 amount,
        uint256 nonce,
        uint256 key
    ) internal {
        ObligationBook.ObligationInput memory input = ObligationBook.ObligationInput({
            epochId: epochId,
            token: token,
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            dueAt: uint64(block.timestamp + 1 days),
            referenceHash: keccak256(abi.encode(debtor, creditor, amount, nonce)),
            memoHash: keccak256(abi.encode("memo", nonce)),
            debtorNonce: nonce,
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes32 digest = localBook.hashObligation(input);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        uint256 id = localBook.propose(input, abi.encodePacked(r, s, v));
        vm.prank(creditor);
        localBook.accept(id);
    }

    function _mandatoryPositionHash() internal view returns (bytes32) {
        address[4] memory actors = [a, b, c, d];
        int256[4] memory netPositions =
            [-int256(35 * UNIT), int256(25 * UNIT), int256(0), int256(10 * UNIT)];
        for (uint256 i = 1; i < actors.length; ++i) {
            address actor = actors[i];
            int256 position = netPositions[i];
            uint256 j = i;
            while (j > 0 && uint160(actors[j - 1]) > uint160(actor)) {
                actors[j] = actors[j - 1];
                netPositions[j] = netPositions[j - 1];
                unchecked {
                    --j;
                }
            }
            actors[j] = actor;
            netPositions[j] = position;
        }

        bytes memory canonical;
        for (uint256 i; i < actors.length; ++i) {
            canonical = abi.encodePacked(canonical, actors[i], netPositions[i]);
        }
        return keccak256(canonical);
    }
}
