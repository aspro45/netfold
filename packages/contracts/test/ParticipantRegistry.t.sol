// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ParticipantRegistry } from "../src/ParticipantRegistry.sol";
import { NetfoldTestBase } from "./NetfoldTestBase.sol";

contract ParticipantRegistryTest is NetfoldTestBase {
    function test_RegisterStoresActiveParticipant() public view {
        ParticipantRegistry.Participant memory participant = registry.getParticipant(a);
        assertTrue(participant.active);
        assertGt(participant.registeredAt, 0);
        assertTrue(participant.metadataHash != bytes32(0));
    }

    function test_RegisterRejectsDuplicate() public {
        vm.expectRevert(ParticipantRegistry.AlreadyRegistered.selector);
        vm.prank(a);
        registry.register(bytes32(uint256(1)));
    }

    function test_RegisterRejectsZeroMetadata() public {
        address newcomer = makeAddr("newcomer");
        vm.expectRevert(ParticipantRegistry.ZeroMetadataHash.selector);
        vm.prank(newcomer);
        registry.register(bytes32(0));
    }

    function test_UpdateMetadata() public {
        bytes32 replacement = keccak256("replacement");
        vm.prank(a);
        registry.updateMetadata(replacement);
        assertEq(registry.getParticipant(a).metadataHash, replacement);
    }

    function test_UpdateMetadataRejectsUnknownParticipant() public {
        vm.expectRevert(ParticipantRegistry.NotRegistered.selector);
        vm.prank(makeAddr("unknown"));
        registry.updateMetadata(bytes32(uint256(1)));
    }

    function test_DeactivateRemovesActiveStatus() public {
        vm.prank(a);
        registry.deactivate();
        assertFalse(registry.isActive(a));
    }

    function test_ReactivateRestoresActiveStatus() public {
        vm.prank(a);
        registry.deactivate();
        vm.prank(a);
        registry.reactivate();
        assertTrue(registry.isActive(a));
    }

    function test_PauseStopsRegistration() public {
        vm.prank(admin);
        registry.pause();
        vm.expectRevert();
        vm.prank(makeAddr("newcomer"));
        registry.register(bytes32(uint256(1)));
    }

    function test_PauseDoesNotStopMetadataUpdate() public {
        vm.prank(admin);
        registry.pause();
        bytes32 replacement = keccak256("still-allowed");
        vm.prank(a);
        registry.updateMetadata(replacement);
        assertEq(registry.getParticipant(a).metadataHash, replacement);
    }

    function test_OnlyPauserCanPause() public {
        vm.expectRevert();
        vm.prank(a);
        registry.pause();
    }

    function test_OnlyPauserCanUnpause() public {
        vm.prank(admin);
        registry.pause();
        vm.expectRevert();
        vm.prank(a);
        registry.unpause();
    }

    function test_DeactivateTwiceReverts() public {
        vm.prank(a);
        registry.deactivate();
        vm.expectRevert(ParticipantRegistry.NotRegistered.selector);
        vm.prank(a);
        registry.deactivate();
    }
}

