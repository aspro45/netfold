// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";

interface IArcMemo {
    function memo(address target, bytes calldata data, bytes32 memoId, bytes calldata memoData)
        external;
}

interface IArcMulticall3From {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external returns (Result[] memory);
}

contract ArcSenderRecorder {
    address public lastSender;
    uint256 public callCount;

    event SenderRecorded(address indexed sender, uint256 indexed callCount);

    function record() external {
        lastSender = msg.sender;
        callCount++;
        emit SenderRecorded(msg.sender, callCount);
    }
}

/// @notice Optional live smoke test. It must be broadcast by an EOA on Arc Testnet.
contract ArcExtensionsSmoke is Script {
    address internal constant MEMO = 0x5294E9927c3306DcBaDb03fe70b92e01cCede505;
    address internal constant MULTICALL3_FROM = 0x522fAf9A91c41c443c66765030741e4AaCe147D0;

    function run() external returns (ArcSenderRecorder recorder) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        recorder = new ArcSenderRecorder();

        bytes memory callData = abi.encodeCall(recorder.record, ());
        IArcMemo(MEMO)
            .memo(
                address(recorder),
                callData,
                keccak256("NETFOLD:MEMO-SMOKE"),
                bytes("NETFOLD Arc Testnet memo smoke test")
            );

        IArcMulticall3From.Call3[] memory calls = new IArcMulticall3From.Call3[](2);
        calls[0] = IArcMulticall3From.Call3({
            target: address(recorder), allowFailure: false, callData: callData
        });
        calls[1] = calls[0];
        IArcMulticall3From(MULTICALL3_FROM).aggregate3(calls);
        vm.stopBroadcast();
    }
}
