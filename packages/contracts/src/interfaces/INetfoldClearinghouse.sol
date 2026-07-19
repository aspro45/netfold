// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface INetfoldClearinghouse {
    function recordAcceptedObligation(
        uint256 obligationId,
        uint256 epochId,
        address token,
        address debtor,
        address creditor,
        uint256 amount
    ) external;

    function cancelAcceptedObligation(
        uint256 obligationId,
        uint256 epochId,
        address debtor,
        address creditor,
        uint256 amount
    ) external;

    function isEpochOpen(uint256 epochId) external view returns (bool);
}

