// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { INetfoldClearinghouse } from "./interfaces/INetfoldClearinghouse.sol";

/// @title NETFOLD Obligation Book
/// @notice Stores debtor-signed obligations and requires explicit onchain creditor acceptance.
contract ObligationBook is AccessControl, EIP712, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    error AlreadyConfigured();
    error ClearinghouseNotConfigured();
    error DuplicateDigest();
    error ExpiredSignature();
    error InvalidAddress();
    error InvalidNonce();
    error InvalidSigner();
    error InvalidStatus();
    error InvalidAmount();
    error SelfObligation();
    error UnauthorizedCreditor();
    error EpochNotOpen();

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OBLIGATION_TYPEHASH = keccak256(
        "Obligation(uint256 epochId,address token,address debtor,address creditor,uint256 amount,uint64 dueAt,bytes32 referenceHash,bytes32 memoHash,uint256 debtorNonce,uint64 deadline)"
    );
    bytes32 public constant CANCELLATION_TYPEHASH = keccak256(
        "Cancellation(uint256 obligationId,uint256 epochId,address debtor,address creditor,uint256 debtorNonce,uint256 creditorNonce,uint64 deadline)"
    );

    enum Status {
        NONE,
        PROPOSED,
        ACCEPTED,
        REJECTED,
        CANCELLED
    }

    struct ObligationInput {
        uint256 epochId;
        address token;
        address debtor;
        address creditor;
        uint256 amount;
        uint64 dueAt;
        bytes32 referenceHash;
        bytes32 memoHash;
        uint256 debtorNonce;
        uint64 deadline;
    }

    struct Obligation {
        uint256 id;
        uint256 epochId;
        address token;
        address debtor;
        address creditor;
        uint256 amount;
        uint64 dueAt;
        bytes32 referenceHash;
        bytes32 memoHash;
        uint256 debtorNonce;
        uint64 deadline;
        Status status;
    }

    struct Cancellation {
        uint256 obligationId;
        uint256 epochId;
        address debtor;
        address creditor;
        uint256 debtorNonce;
        uint256 creditorNonce;
        uint64 deadline;
    }

    INetfoldClearinghouse public clearinghouse;
    uint256 public nextObligationId = 1;

    mapping(uint256 obligationId => Obligation obligation) private _obligations;
    mapping(address debtor => uint256 nonce) public debtorNonces;
    mapping(address participant => uint256 nonce) public cancellationNonces;
    mapping(bytes32 digest => bool used) public usedDigests;

    event ClearinghouseConfigured(address indexed clearinghouse);
    event ObligationProposed(
        uint256 indexed obligationId,
        uint256 indexed epochId,
        address indexed debtor,
        address creditor,
        address token,
        uint256 amount,
        bytes32 referenceHash,
        bytes32 memoHash
    );
    event ObligationAccepted(uint256 indexed obligationId, address indexed creditor);
    event ObligationRejected(uint256 indexed obligationId, address indexed creditor);
    event ObligationCancelled(uint256 indexed obligationId);

    constructor(address initialAdmin) EIP712("NETFOLD Obligation Book", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
    }

    function configureClearinghouse(address clearinghouse_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(clearinghouse) != address(0)) revert AlreadyConfigured();
        if (clearinghouse_ == address(0)) revert InvalidAddress();
        clearinghouse = INetfoldClearinghouse(clearinghouse_);
        emit ClearinghouseConfigured(clearinghouse_);
    }

    function propose(ObligationInput calldata input, bytes calldata debtorSignature)
        external
        whenNotPaused
        returns (uint256 obligationId)
    {
        if (address(clearinghouse) == address(0)) revert ClearinghouseNotConfigured();
        if (input.debtor == address(0) || input.creditor == address(0) || input.token == address(0))
        {
            revert InvalidAddress();
        }
        if (input.debtor == input.creditor) revert SelfObligation();
        if (input.amount == 0 || input.amount > uint256(type(int256).max)) revert InvalidAmount();
        if (block.timestamp > input.deadline) revert ExpiredSignature();
        if (input.debtorNonce != debtorNonces[input.debtor]) revert InvalidNonce();
        if (!clearinghouse.isEpochOpen(input.epochId)) revert EpochNotOpen();

        bytes32 digest = hashObligation(input);
        if (usedDigests[digest]) revert DuplicateDigest();
        if (digest.recover(debtorSignature) != input.debtor) revert InvalidSigner();

        usedDigests[digest] = true;
        debtorNonces[input.debtor] = input.debtorNonce + 1;
        obligationId = nextObligationId++;
        _obligations[obligationId] = Obligation({
            id: obligationId,
            epochId: input.epochId,
            token: input.token,
            debtor: input.debtor,
            creditor: input.creditor,
            amount: input.amount,
            dueAt: input.dueAt,
            referenceHash: input.referenceHash,
            memoHash: input.memoHash,
            debtorNonce: input.debtorNonce,
            deadline: input.deadline,
            status: Status.PROPOSED
        });

        emit ObligationProposed(
            obligationId,
            input.epochId,
            input.debtor,
            input.creditor,
            input.token,
            input.amount,
            input.referenceHash,
            input.memoHash
        );
    }

    function accept(uint256 obligationId) external whenNotPaused nonReentrant {
        Obligation storage obligation = _obligations[obligationId];
        if (obligation.status != Status.PROPOSED) revert InvalidStatus();
        if (msg.sender != obligation.creditor) revert UnauthorizedCreditor();
        if (!clearinghouse.isEpochOpen(obligation.epochId)) revert EpochNotOpen();

        obligation.status = Status.ACCEPTED;
        clearinghouse.recordAcceptedObligation(
            obligation.id,
            obligation.epochId,
            obligation.token,
            obligation.debtor,
            obligation.creditor,
            obligation.amount
        );
        emit ObligationAccepted(obligationId, msg.sender);
    }

    function reject(uint256 obligationId) external {
        Obligation storage obligation = _obligations[obligationId];
        if (obligation.status != Status.PROPOSED) revert InvalidStatus();
        if (msg.sender != obligation.creditor) revert UnauthorizedCreditor();
        obligation.status = Status.REJECTED;
        emit ObligationRejected(obligationId, msg.sender);
    }

    function cancelBilateral(
        Cancellation calldata cancellation,
        bytes calldata debtorSignature,
        bytes calldata creditorSignature
    ) external nonReentrant {
        Obligation storage obligation = _obligations[cancellation.obligationId];
        if (obligation.status != Status.PROPOSED && obligation.status != Status.ACCEPTED) {
            revert InvalidStatus();
        }
        if (!clearinghouse.isEpochOpen(obligation.epochId)) revert EpochNotOpen();
        if (block.timestamp > cancellation.deadline) revert ExpiredSignature();
        if (
            cancellation.epochId != obligation.epochId || cancellation.debtor != obligation.debtor
                || cancellation.creditor != obligation.creditor
        ) revert InvalidSigner();
        if (
            cancellation.debtorNonce != cancellationNonces[obligation.debtor]
                || cancellation.creditorNonce != cancellationNonces[obligation.creditor]
        ) revert InvalidNonce();

        bytes32 digest = hashCancellation(cancellation);
        if (usedDigests[digest]) revert DuplicateDigest();
        if (digest.recover(debtorSignature) != obligation.debtor) revert InvalidSigner();
        if (digest.recover(creditorSignature) != obligation.creditor) revert InvalidSigner();

        usedDigests[digest] = true;
        cancellationNonces[obligation.debtor]++;
        cancellationNonces[obligation.creditor]++;
        Status priorStatus = obligation.status;
        obligation.status = Status.CANCELLED;

        if (priorStatus == Status.ACCEPTED) {
            clearinghouse.cancelAcceptedObligation(
                obligation.id,
                obligation.epochId,
                obligation.debtor,
                obligation.creditor,
                obligation.amount
            );
        }
        emit ObligationCancelled(obligation.id);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function hashObligation(ObligationInput calldata input) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OBLIGATION_TYPEHASH,
                    input.epochId,
                    input.token,
                    input.debtor,
                    input.creditor,
                    input.amount,
                    input.dueAt,
                    input.referenceHash,
                    input.memoHash,
                    input.debtorNonce,
                    input.deadline
                )
            )
        );
    }

    function hashCancellation(Cancellation calldata cancellation) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CANCELLATION_TYPEHASH,
                    cancellation.obligationId,
                    cancellation.epochId,
                    cancellation.debtor,
                    cancellation.creditor,
                    cancellation.debtorNonce,
                    cancellation.creditorNonce,
                    cancellation.deadline
                )
            )
        );
    }

    function getObligation(uint256 obligationId) external view returns (Obligation memory) {
        return _obligations[obligationId];
    }
}
