// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { NetfoldClearinghouse } from "../src/NetfoldClearinghouse.sol";
import { ParticipantRegistry } from "../src/ParticipantRegistry.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract ContractSolverDifferentialTest is Test {
    uint256 internal constant UNIT = 1e6;
    address internal constant A = address(0xA1);
    address internal constant B = address(0xB2);
    address internal constant C = address(0xC3);
    address internal constant D = address(0xD4);
    bytes32 internal constant EXPECTED_DATASET_HASH =
        0xe7f3e6efd7eb10e17a6411e96c0e088f98466cfdccb9b73cd87e2ee92a93a243;

    function test_MatchesTypeScriptReferenceFixture() public {
        MockERC20 usdc = new MockERC20("USDC", "USDC", 6);
        MockERC20 eurc = new MockERC20("EURC", "EURC", 6);
        ParticipantRegistry registry = new ParticipantRegistry(address(this));
        NetfoldClearinghouse clearinghouse =
            new NetfoldClearinghouse(address(this), registry, address(usdc), address(eurc));
        clearinghouse.configureObligationBook(address(this));

        address[4] memory actors = [A, B, C, D];
        for (uint256 i; i < actors.length; ++i) {
            usdc.mint(actors[i], 1_000 * UNIT);
            vm.prank(actors[i]);
            registry.register(keccak256(abi.encode(actors[i])));
            vm.prank(actors[i]);
            usdc.approve(address(clearinghouse), type(uint256).max);
        }

        vm.prank(A);
        uint256 epochId = clearinghouse.createEpoch(address(usdc), 1 days, 2 * UNIT);
        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            clearinghouse.joinEpoch(epochId);
        }

        clearinghouse.recordAcceptedObligation(1, epochId, address(usdc), A, B, 100 * UNIT);
        clearinghouse.recordAcceptedObligation(2, epochId, address(usdc), B, C, 70 * UNIT);
        clearinghouse.recordAcceptedObligation(3, epochId, address(usdc), C, A, 50 * UNIT);
        clearinghouse.recordAcceptedObligation(4, epochId, address(usdc), C, D, 20 * UNIT);
        clearinghouse.recordAcceptedObligation(5, epochId, address(usdc), D, B, 10 * UNIT);
        clearinghouse.recordAcceptedObligation(6, epochId, address(usdc), B, A, 15 * UNIT);

        vm.prank(A);
        clearinghouse.lockEpoch(epochId);

        NetfoldClearinghouse.Epoch memory epoch = clearinghouse.getEpoch(epochId);
        assertEq(clearinghouse.positions(epochId, A), -int256(35 * UNIT));
        assertEq(clearinghouse.positions(epochId, B), int256(25 * UNIT));
        assertEq(clearinghouse.positions(epochId, C), 0);
        assertEq(clearinghouse.positions(epochId, D), int256(10 * UNIT));
        assertEq(epoch.grossVolume, 265 * UNIT);
        assertEq(epoch.totalNetDebit, 35 * UNIT);
        assertEq(epoch.totalNetCredit, 35 * UNIT);
        assertEq(epoch.liquiditySaved, 230 * UNIT);
        assertEq(epoch.datasetHash, EXPECTED_DATASET_HASH);
    }
}
