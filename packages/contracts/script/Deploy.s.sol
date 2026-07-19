// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { NetfoldClearinghouse } from "../src/NetfoldClearinghouse.sol";
import { ObligationBook } from "../src/ObligationBook.sol";
import { ParticipantRegistry } from "../src/ParticipantRegistry.sol";

contract DeployNetfold is Script {
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    address internal constant ARC_EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

    function run()
        external
        returns (
            ParticipantRegistry registry,
            ObligationBook book,
            NetfoldClearinghouse clearinghouse
        )
    {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        registry = new ParticipantRegistry(deployer);
        book = new ObligationBook(deployer);
        clearinghouse = new NetfoldClearinghouse(deployer, registry, ARC_USDC, ARC_EURC);
        book.configureClearinghouse(address(clearinghouse));
        clearinghouse.configureObligationBook(address(book));
        vm.stopBroadcast();
    }
}

