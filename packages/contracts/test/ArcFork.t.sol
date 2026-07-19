// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Test } from "forge-std/Test.sol";

contract ArcForkTest is Test {
    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    address internal constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address internal constant MEMO = 0x5294E9927c3306DcBaDb03fe70b92e01cCede505;
    address internal constant MULTICALL3_FROM = 0x522fAf9A91c41c443c66765030741e4AaCe147D0;
    address internal constant MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;

    function setUp() public {
        string memory rpc = vm.envOr("ARC_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
    }

    function test_ArcChainId() public view {
        assertEq(block.chainid, 5_042_002);
    }

    function test_ArcStablecoinDecimals() public view {
        assertEq(IERC20Metadata(USDC).decimals(), 6);
        assertEq(IERC20Metadata(EURC).decimals(), 6);
    }

    function test_ArcPredeploysHaveCode() public view {
        assertGt(USDC.code.length, 0);
        assertGt(EURC.code.length, 0);
        assertGt(MEMO.code.length, 0);
        assertGt(MULTICALL3_FROM.code.length, 0);
        assertGt(MULTICALL3.code.length, 0);
    }

    function test_ArcBaseFeeMeetsDocumentedFloor() public view {
        assertGe(block.basefee, 20 gwei);
    }
}
