// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ObligationBook } from "../src/ObligationBook.sol";
import { NetfoldTestBase } from "./NetfoldTestBase.sol";

contract ObligationBookTest is NetfoldTestBase {
    uint256 internal epochId;

    function setUp() public override {
        super.setUp();
        epochId = _createAndJoinFour(address(usdc));
    }

    function test_ProposeStoresEverySignedField() public {
        ObligationBook.ObligationInput memory input =
            _input(epochId, address(usdc), a, b, 100 * UNIT, 0);
        uint256 obligationId = _propose(input, A_KEY);
        ObligationBook.Obligation memory stored = book.getObligation(obligationId);
        assertEq(stored.epochId, input.epochId);
        assertEq(stored.token, input.token);
        assertEq(stored.debtor, input.debtor);
        assertEq(stored.creditor, input.creditor);
        assertEq(stored.amount, input.amount);
        assertEq(stored.dueAt, input.dueAt);
        assertEq(stored.referenceHash, input.referenceHash);
        assertEq(stored.memoHash, input.memoHash);
        assertEq(stored.debtorNonce, input.debtorNonce);
        assertEq(uint8(stored.status), uint8(ObligationBook.Status.PROPOSED));
    }

    function test_ProposeIncrementsNonce() public {
        _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        assertEq(book.debtorNonces(a), 1);
    }

    function test_ProposeRejectsReplayNonce() public {
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, b, UNIT, 0);
        bytes memory signature = _obligationSignature(input, A_KEY);
        _propose(input, A_KEY);
        vm.expectRevert(ObligationBook.InvalidNonce.selector);
        book.propose(input, signature);
    }

    function test_ProposeRejectsWrongSigner() public {
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, b, UNIT, 0);
        bytes memory signature = _obligationSignature(input, B_KEY);
        vm.expectRevert(ObligationBook.InvalidSigner.selector);
        book.propose(input, signature);
    }

    function test_ProposeRejectsExpiredSignature() public {
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, b, UNIT, 0);
        input.deadline = uint64(block.timestamp - 1);
        bytes memory signature = _obligationSignature(input, A_KEY);
        vm.expectRevert(ObligationBook.ExpiredSignature.selector);
        book.propose(input, signature);
    }

    function test_ProposeRejectsSelfObligation() public {
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, a, UNIT, 0);
        bytes memory signature = _obligationSignature(input, A_KEY);
        vm.expectRevert(ObligationBook.SelfObligation.selector);
        book.propose(input, signature);
    }

    function test_ProposeRejectsZeroAmount() public {
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, b, 0, 0);
        bytes memory signature = _obligationSignature(input, A_KEY);
        vm.expectRevert(ObligationBook.InvalidAmount.selector);
        book.propose(input, signature);
    }

    function test_ProposeRejectsAmountAboveSignedRange() public {
        ObligationBook.ObligationInput memory input =
            _input(epochId, address(usdc), a, b, uint256(type(int256).max) + 1, 0);
        bytes memory signature = _obligationSignature(input, A_KEY);
        vm.expectRevert(ObligationBook.InvalidAmount.selector);
        book.propose(input, signature);
    }

    function test_ProposeRejectsClosedEpoch() public {
        _proposeAndAccept(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), c, d, UNIT, 0);
        bytes memory signature = _obligationSignature(input, C_KEY);
        vm.expectRevert(ObligationBook.EpochNotOpen.selector);
        book.propose(input, signature);
    }

    function test_AcceptRequiresCreditor() public {
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(ObligationBook.UnauthorizedCreditor.selector);
        vm.prank(c);
        book.accept(id);
    }

    function test_AcceptAppliesPositionsExactlyOnce() public {
        uint256 id = _proposeAndAccept(_input(epochId, address(usdc), a, b, 12 * UNIT, 0), A_KEY);
        assertTrue(clearinghouse.obligationApplied(epochId, id));
        assertEq(clearinghouse.positions(epochId, a), -int256(12 * UNIT));
        assertEq(clearinghouse.positions(epochId, b), int256(12 * UNIT));
    }

    function test_AcceptTwiceReverts() public {
        uint256 id = _proposeAndAccept(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(ObligationBook.InvalidStatus.selector);
        vm.prank(b);
        book.accept(id);
    }

    function test_RejectRequiresCreditor() public {
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.expectRevert(ObligationBook.UnauthorizedCreditor.selector);
        vm.prank(c);
        book.reject(id);
    }

    function test_RejectIsTerminal() public {
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.prank(b);
        book.reject(id);
        vm.expectRevert(ObligationBook.InvalidStatus.selector);
        vm.prank(b);
        book.accept(id);
    }

    function test_BilateralCancellationReversesAcceptedPosition() public {
        uint256 id = _proposeAndAccept(_input(epochId, address(usdc), a, b, 12 * UNIT, 0), A_KEY);
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
        assertFalse(clearinghouse.obligationApplied(epochId, id));
    }

    function test_BilateralCancellationWorksBeforeAcceptance() public {
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
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
        assertEq(uint8(book.getObligation(id).status), uint8(ObligationBook.Status.CANCELLED));
    }

    function test_BilateralCancellationRejectsOneWrongSigner() public {
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        ObligationBook.Cancellation memory cancellation = ObligationBook.Cancellation({
            obligationId: id,
            epochId: epochId,
            debtor: a,
            creditor: b,
            debtorNonce: 0,
            creditorNonce: 0,
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes memory debtorSignature = _signCancellation(cancellation, A_KEY);
        bytes memory wrongCreditorSignature = _signCancellation(cancellation, C_KEY);
        vm.expectRevert(ObligationBook.InvalidSigner.selector);
        book.cancelBilateral(cancellation, debtorSignature, wrongCreditorSignature);
    }

    function test_BilateralCancellationRejectsAfterLock() public {
        uint256 id = _proposeAndAccept(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        ObligationBook.Cancellation memory cancellation = ObligationBook.Cancellation({
            obligationId: id,
            epochId: epochId,
            debtor: a,
            creditor: b,
            debtorNonce: 0,
            creditorNonce: 0,
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes memory debtorSignature = _signCancellation(cancellation, A_KEY);
        bytes memory creditorSignature = _signCancellation(cancellation, B_KEY);
        vm.expectRevert(ObligationBook.EpochNotOpen.selector);
        book.cancelBilateral(cancellation, debtorSignature, creditorSignature);
    }

    function test_PauseStopsNewProposal() public {
        vm.prank(admin);
        book.pause();
        ObligationBook.ObligationInput memory input = _input(epochId, address(usdc), a, b, UNIT, 0);
        bytes memory signature = _obligationSignature(input, A_KEY);
        vm.expectRevert();
        book.propose(input, signature);
    }

    function test_PauseDoesNotBlockRejection() public {
        uint256 id = _propose(_input(epochId, address(usdc), a, b, UNIT, 0), A_KEY);
        vm.prank(admin);
        book.pause();
        vm.prank(b);
        book.reject(id);
        assertEq(uint8(book.getObligation(id).status), uint8(ObligationBook.Status.REJECTED));
    }

    function test_ConfigureClearinghouseOnlyOnce() public {
        vm.expectRevert(ObligationBook.AlreadyConfigured.selector);
        vm.prank(admin);
        book.configureClearinghouse(address(clearinghouse));
    }
}
