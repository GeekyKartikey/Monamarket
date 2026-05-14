import PredictionMarketABI from "@/abis/PredictionMarket.json";
import MarketFactoryABI from "@/abis/MarketFactory.json";
import { type Address, type Abi } from "viem";

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

export const PYTH_BETA_ADDRESS =
  "0xad2B52D2af1a9bD5c561894Cdd84f7505e1CD0B5" as Address;

/// Refundable deposit required to create a user market. Matches the contract constant.
export const CREATION_DEPOSIT = BigInt("100000000000000000"); // 0.1 MON in wei

export { PredictionMarketABI, MarketFactoryABI };

export const MARKET_ABI = PredictionMarketABI.abi as Abi;
export const FACTORY_ABI = MarketFactoryABI.abi as Abi;
