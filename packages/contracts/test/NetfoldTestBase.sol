// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { NetfoldClearinghouse } from "../src/NetfoldClearinghouse.sol";
import { ObligationBook } from "../src/ObligationBook.sol";
import { ParticipantRegistry } from "../src/ParticipantRegistry.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

abstract contract NetfoldTestBase is Test {
    uint256 internal constant UNIT = 1e6;
    uint256 internal constant BOND = 2 * UNIT;
    uint64 internal constant FUNDING_DURATION = 1 days;

    uint256 internal constant ADMIN_KEY = 0xA0;
    uint256 internal constant A_KEY = 0xA1;
    uint256 internal constant B_KEY = 0xB2;
    uint256 internal constant C_KEY = 0xC3;
    uint256 internal constant D_KEY = 0xD4;
    uint256 internal constant E_KEY = 0xE5;

    address internal admin;
    address internal a;
    address internal b;
    address internal c;
    address internal d;
    address internal e;

    MockERC20 internal usdc;
    MockERC20 internal eurc;
    ParticipantRegistry internal registry;
    ObligationBook internal book;
    NetfoldClearinghouse internal clearinghouse;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        admin = vm.addr(ADMIN_KEY);
        a = vm.addr(A_KEY);
        b = vm.addr(B_KEY);
        c = vm.addr(C_KEY);
        d = vm.addr(D_KEY);
        e = vm.addr(E_KEY);

        usdc = new MockERC20("USDC", "USDC", 6);
        eurc = new MockERC20("EURC", "EURC", 6);
        registry = new ParticipantRegistry(admin);
        book = new ObligationBook(admin);
        clearinghouse = new NetfoldClearinghouse(admin, registry, address(usdc), address(eurc));

        vm.startPrank(admin);
        book.configureClearinghouse(address(clearinghouse));
        clearinghouse.configureObligationBook(address(book));
        vm.stopPrank();

        _registerAndFund(a);
        _registerAndFund(b);
        _registerAndFund(c);
        _registerAndFund(d);
        _registerAndFund(e);
    }

    function _registerAndFund(address participant) internal {
        vm.prank(participant);
        registry.register(keccak256(abi.encode("participant", participant)));
        usdc.mint(participant, 10_000 * UNIT);
        eurc.mint(participant, 10_000 * UNIT);
        vm.startPrank(participant);
        usdc.approve(address(clearinghouse), type(uint256).max);
        eurc.approve(address(clearinghouse), type(uint256).max);
        vm.stopPrank();
    }

    function _createEpoch(address token, address creator) internal returns (uint256 epochId) {
        vm.prank(creator);
        epochId = clearinghouse.createEpoch(token, FUNDING_DURATION, BOND);
    }

    function _join(uint256 epochId, address participant) internal {
        vm.prank(participant);
        clearinghouse.joinEpoch(epochId);
    }

    function _createAndJoinFour(address token) internal returns (uint256 epochId) {
        epochId = _createEpoch(token, a);
        _join(epochId, a);
        _join(epochId, b);
        _join(epochId, c);
        _join(epochId, d);
    }

    function _input(
        uint256 epochId,
        address token,
        address debtor,
        address creditor,
        uint256 amount,
        uint256 nonce
    ) internal view returns (ObligationBook.ObligationInput memory input) {
        input = ObligationBook.ObligationInput({
            epochId: epochId,
            token: token,
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            dueAt: uint64(block.timestamp + 7 days),
            referenceHash: keccak256(abi.encode(epochId, debtor, creditor, amount, nonce)),
            memoHash: keccak256(abi.encode("memo", epochId, nonce)),
            debtorNonce: nonce,
            deadline: uint64(block.timestamp + 1 hours)
        });
    }

    function _propose(ObligationBook.ObligationInput memory input, uint256 debtorKey)
        internal
        returns (uint256 obligationId)
    {
        obligationId = book.propose(input, _obligationSignature(input, debtorKey));
    }

    function _accept(uint256 obligationId, address creditor) internal {
        vm.prank(creditor);
        book.accept(obligationId);
    }

    function _proposeAndAccept(ObligationBook.ObligationInput memory input, uint256 debtorKey)
        internal
        returns (uint256 obligationId)
    {
        obligationId = _propose(input, debtorKey);
        _accept(obligationId, input.creditor);
    }

    function _mandatoryCycle(address token) internal returns (uint256 epochId) {
        epochId = _createAndJoinFour(token);
        _proposeAndAccept(_input(epochId, token, a, b, 100 * UNIT, book.debtorNonces(a)), A_KEY);
        _proposeAndAccept(_input(epochId, token, b, c, 70 * UNIT, book.debtorNonces(b)), B_KEY);
        _proposeAndAccept(_input(epochId, token, c, a, 50 * UNIT, book.debtorNonces(c)), C_KEY);
        _proposeAndAccept(_input(epochId, token, c, d, 20 * UNIT, book.debtorNonces(c)), C_KEY);
        _proposeAndAccept(_input(epochId, token, d, b, 10 * UNIT, book.debtorNonces(d)), D_KEY);
        _proposeAndAccept(_input(epochId, token, b, a, 15 * UNIT, book.debtorNonces(b)), B_KEY);
    }

    function _lockAndFundMandatory(address token) internal returns (uint256 epochId) {
        epochId = _mandatoryCycle(token);
        vm.prank(a);
        clearinghouse.lockEpoch(epochId);
        vm.prank(a);
        clearinghouse.fundDebit(epochId);
    }

    function _signCancellation(ObligationBook.Cancellation memory cancellation, uint256 signerKey)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = book.hashCancellation(cancellation);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _obligationSignature(ObligationBook.ObligationInput memory input, uint256 signerKey)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = book.hashObligation(input);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
