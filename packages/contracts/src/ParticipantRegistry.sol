// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title NETFOLD Participant Registry
/// @notice Self-service participant directory. It never holds participant funds.
contract ParticipantRegistry is AccessControl, Pausable {
    error AlreadyRegistered();
    error NotRegistered();
    error ZeroMetadataHash();

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Participant {
        bytes32 metadataHash;
        uint64 registeredAt;
        bool active;
    }

    mapping(address participant => Participant record) private _participants;

    event ParticipantRegistered(address indexed participant, bytes32 indexed metadataHash);
    event ParticipantMetadataUpdated(address indexed participant, bytes32 indexed metadataHash);
    event ParticipantDeactivated(address indexed participant);
    event ParticipantReactivated(address indexed participant);

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
    }

    function register(bytes32 metadataHash) external whenNotPaused {
        if (metadataHash == bytes32(0)) revert ZeroMetadataHash();
        if (_participants[msg.sender].registeredAt != 0) revert AlreadyRegistered();
        _participants[msg.sender] = Participant({
            metadataHash: metadataHash, registeredAt: uint64(block.timestamp), active: true
        });
        emit ParticipantRegistered(msg.sender, metadataHash);
    }

    function updateMetadata(bytes32 metadataHash) external {
        if (metadataHash == bytes32(0)) revert ZeroMetadataHash();
        Participant storage participant = _participants[msg.sender];
        if (participant.registeredAt == 0) revert NotRegistered();
        participant.metadataHash = metadataHash;
        emit ParticipantMetadataUpdated(msg.sender, metadataHash);
    }

    function deactivate() external {
        Participant storage participant = _participants[msg.sender];
        if (participant.registeredAt == 0 || !participant.active) revert NotRegistered();
        participant.active = false;
        emit ParticipantDeactivated(msg.sender);
    }

    function reactivate() external whenNotPaused {
        Participant storage participant = _participants[msg.sender];
        if (participant.registeredAt == 0) revert NotRegistered();
        participant.active = true;
        emit ParticipantReactivated(msg.sender);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getParticipant(address participant) external view returns (Participant memory) {
        return _participants[participant];
    }

    function isActive(address participant) external view returns (bool) {
        return _participants[participant].active;
    }
}

