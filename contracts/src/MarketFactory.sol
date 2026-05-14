// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PredictionMarket.sol";

contract MarketFactory is Ownable {
    address public immutable defaultPyth;
    address[] public markets;

    event MarketCreated(address indexed market, string question);

    constructor(address _pyth, address _owner) Ownable(_owner) {
        defaultPyth = _pyth;
    }

    /// @notice Deploy a new PredictionMarket.
    /// @param pythOverride If non-zero, this Pyth address is used instead of defaultPyth.
    ///                     Required for markets that use the beta Pyth contract (e.g. MON/USD).
    function createMarket(
        string memory question,
        string[] memory outcomeLabels,
        uint256 closeTime,
        uint256 resolveTime,
        bytes32 pythPriceFeedId,
        int64[] memory thresholds,
        PredictionMarket.ResolutionType resolutionType,
        address pythOverride
    ) external onlyOwner returns (address market) {
        address pythAddr = pythOverride != address(0) ? pythOverride : defaultPyth;

        PredictionMarket m = new PredictionMarket(
            pythAddr,
            question,
            outcomeLabels,
            closeTime,
            resolveTime,
            pythPriceFeedId,
            thresholds,
            resolutionType
        );

        markets.push(address(m));
        emit MarketCreated(address(m), question);
        return address(m);
    }

    function getAllMarkets() external view returns (address[] memory) {
        return markets;
    }

    function marketCount() external view returns (uint256) {
        return markets.length;
    }
}
