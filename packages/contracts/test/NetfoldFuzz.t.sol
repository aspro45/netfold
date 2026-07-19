// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { NetfoldClearinghouse } from "../src/NetfoldClearinghouse.sol";
import { ObligationBook } from "../src/ObligationBook.sol";
import { NetfoldTestBase } from "./NetfoldTestBase.sol";

contract NetfoldFuzzTest is NetfoldTestBase {
    function testFuzz_AcceptedObligationConservesPosition(uint128 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, uint256(uint128(type(int128).max)));
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, amount, 0), A_KEY);
        assertEq(clearinghouse.positions(epochId, a) + clearinghouse.positions(epochId, b), 0);
    }

    function testFuzz_TwoPartyLockNetsToGross(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000 * UNIT);
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, amount, 0), A_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        assertEq(epoch.grossVolume, amount);
        assertEq(epoch.totalNetDebit, amount);
        assertEq(epoch.liquiditySaved, 0);
    }

    function testFuzz_ReciprocalObligationsSaveMinSide(uint64 rawAB, uint64 rawBA) public {
        uint256 amountAB = bound(uint256(rawAB), 1, 100_000 * UNIT);
        uint256 amountBA = bound(uint256(rawBA), 1, 100_000 * UNIT);
        vm.assume(amountAB != amountBA);
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, amountAB, 0), A_KEY);
        _proposeAndAccept(_input(epochId, address(usdc), b, a, amountBA, 0), B_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        uint256 expectedNet = amountAB > amountBA ? amountAB - amountBA : amountBA - amountAB;
        uint256 expectedSaved = amountAB + amountBA - expectedNet;
        assertEq(epoch.totalNetDebit, expectedNet);
        assertEq(epoch.liquiditySaved, expectedSaved);
    }

    function testFuzz_CancellationRestoresZero(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000 * UNIT);
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        uint256 id = _proposeAndAccept(_input(epochId, address(usdc), a, b, amount, 0), A_KEY);
        ObligationBook.Cancellation memory cancellation = ObligationBook.Cancellation({
            obligationId: id,
            epochId: epochId,
            debtor: a,
            creditor: b,
            debtorNonce: 0,
            creditorNonce: 0,
            deadline: uint64(block.timestamp + 1 hours)
        });
        book.cancelBilateral(
            cancellation,
            _signCancellation(cancellation, A_KEY),
            _signCancellation(cancellation, B_KEY)
        );
        assertEq(clearinghouse.positions(epochId, a), 0);
        assertEq(clearinghouse.positions(epochId, b), 0);
        assertEq(clearinghouse.getEpoch(epochId).grossVolume, 0);
    }

    function testFuzz_FundingAndClaimPreserveSolvency(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000 * UNIT);
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, amount, 0), A_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
        clearinghouse.finalize(epochId);
        vm.prank(b);
        clearinghouse.claimCredit(epochId);
        assertTrue(clearinghouse.isSolvent(address(usdc)));
    }

    function testFuzz_DefaultRecoveryNeverExceedsSlashedBond(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000 * UNIT);
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        _proposeAndAccept(_input(epochId, address(usdc), a, b, amount, 0), A_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.warp(block.timestamp + FUNDING_DURATION + 1);
        clearinghouse.markDefault(epochId);
        assertEq(clearinghouse.recoveryClaimable(epochId, b), BOND);
    }

    function testFuzz_ExpiredDeadlineAlwaysRejects(uint64 age) public {
        age = uint64(bound(age, 1, 365 days));
        uint256 epochId = _createEpoch(address(usdc), a);
        _join(epochId, a);
        _join(epochId, b);
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, b, UNIT, 0);
        input.deadline = uint64(block.timestamp - age);
        bytes memory signature = _obligationSignature(input, A_KEY);
        vm.expectRevert(ObligationBook.ExpiredSignature.selector);
        book.propose(input, signature);
    }

    function testFuzz_UnsupportedTokenAlwaysRejects(address token) public {
        vm.assume(token != address(usdc) && token != address(eurc));
        vm.expectRevert(NetfoldClearinghouse.UnsupportedToken.selector);
        vm.prank(a);
        clearinghouse.createEpoch(token, FUNDING_DURATION, BOND);
    }
}
