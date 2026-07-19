// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";
import { NetfoldClearinghouse } from "../src/NetfoldClearinghouse.sol";
import { ObligationBook } from "../src/ObligationBook.sol";
import { ParticipantRegistry } from "../src/ParticipantRegistry.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract NetfoldHandler is Test {
    uint256 private constant UNIT = 1e6;
    uint256 private constant A_KEY = 0xA1;
    uint256 private constant B_KEY = 0xB2;
    uint256 private constant C_KEY = 0xC3;
    uint256 private constant D_KEY = 0xD4;

    NetfoldClearinghouse public immutable clearinghouse;
    ObligationBook public immutable book;
    uint256 public immutable epochId;
    address public immutable creator;

    address[4] internal actors;
    uint256[4] internal keys;

    constructor(NetfoldClearinghouse clearinghouse_, ObligationBook book_, uint256 epochId_) {
        clearinghouse = clearinghouse_;
        book = book_;
        epochId = epochId_;
        actors = [vm.addr(A_KEY), vm.addr(B_KEY), vm.addr(C_KEY), vm.addr(D_KEY)];
        keys = [A_KEY, B_KEY, C_KEY, D_KEY];
        creator = actors[0];
    }

    function proposeAndAccept(uint8 debtorSeed, uint8 creditorSeed, uint96 rawAmount) external {
        uint256 debtorIndex = bound(uint256(debtorSeed), 0, 3);
        uint256 creditorIndex = bound(uint256(creditorSeed), 0, 3);
        if (debtorIndex == creditorIndex) return;
        address debtor = actors[debtorIndex];
        address creditor = actors[creditorIndex];
        uint256 amount = bound(uint256(rawAmount), 1, 100 * UNIT);
        uint256 nonce = book.debtorNonces(debtor);
        ObligationBook.ObligationInput memory input = ObligationBook.ObligationInput({
            epochId: epochId,
            token: clearinghouse.usdc(),
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            dueAt: uint64(block.timestamp + 1 days),
            referenceHash: keccak256(abi.encode(debtor, creditor, nonce, amount)),
            memoHash: keccak256(abi.encode("invariant", nonce)),
            debtorNonce: nonce,
            deadline: uint64(block.timestamp + 1 hours)
        });
        bytes32 digest = book.hashObligation(input);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[debtorIndex], digest);
        uint256 id = book.propose(input, abi.encodePacked(r, s, v));
        vm.prank(creditor);
        book.accept(id);
    }

    function tryLock() external {
        vm.prank(creator);
        clearinghouse.lockEpoch(epochId);
    }

    function tryFund(uint8 actorSeed) external {
        address actor = actors[bound(uint256(actorSeed), 0, 3)];
        vm.prank(actor);
        clearinghouse.fundDebit(epochId);
    }

    function tryFinalize() external {
        clearinghouse.finalize(epochId);
    }
}

contract NetfoldInvariantTest is StdInvariant, Test {
    MockERC20 internal usdc;
    ParticipantRegistry internal registry;
    ObligationBook internal book;
    NetfoldClearinghouse internal clearinghouse;
    NetfoldHandler internal handler;
    uint256 internal epochId;
    address[4] internal actors;

    function setUp() public {
        vm.warp(1_800_000_000);
        address admin = vm.addr(0xA0);
        actors = [vm.addr(0xA1), vm.addr(0xB2), vm.addr(0xC3), vm.addr(0xD4)];
        usdc = new MockERC20("USDC", "USDC", 6);
        MockERC20 eurc = new MockERC20("EURC", "EURC", 6);
        registry = new ParticipantRegistry(admin);
        book = new ObligationBook(admin);
        clearinghouse = new NetfoldClearinghouse(admin, registry, address(usdc), address(eurc));
        vm.startPrank(admin);
        book.configureClearinghouse(address(clearinghouse));
        clearinghouse.configureObligationBook(address(book));
        vm.stopPrank();

        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            registry.register(keccak256(abi.encode(actors[i])));
            usdc.mint(actors[i], 1_000_000e6);
            vm.prank(actors[i]);
            usdc.approve(address(clearinghouse), type(uint256).max);
        }
        vm.prank(actors[0]);
        epochId = clearinghouse.createEpoch(address(usdc), 1 days, 2e6);
        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            clearinghouse.joinEpoch(epochId);
        }
        handler = new NetfoldHandler(clearinghouse, book, epochId);
        targetContract(address(handler));
    }

    function invariant_PositionsAlwaysSumToZero() public view {
        int256 sum;
        for (uint256 i; i < actors.length; ++i) {
            sum += clearinghouse.positions(epochId, actors[i]);
        }
        assertEq(sum, 0);
    }

    function invariant_LiabilitiesRemainCovered() public view {
        assertGe(
            usdc.balanceOf(address(clearinghouse)), clearinghouse.totalLiability(address(usdc))
        );
    }

    function invariant_BoundsNeverExceeded() public view {
        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        assertLe(epoch.participantCount, clearinghouse.MAX_PARTICIPANTS());
        assertLe(epoch.obligationCount, clearinghouse.MAX_OBLIGATIONS());
    }

    function invariant_FundingNeverExceedsNetDebit() public view {
        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        assertLe(epoch.totalFunded, epoch.totalNetDebit);
    }
}

