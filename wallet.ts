export const assetNetworks = {
    BTC:  ["BITCOIN"],
    ETH:  ["ARBITRUM", "OPTIMISM", "ERC-20"],
    USDT: ["ERC-20", "TRC-20", "ARBITRUM"],
} as const;
export type Currency = keyof typeof assetNetworks;
export type Networks = typeof assetNetworks[Currency][number];

export interface Wallet{
    id: number;
    ownerId: number;
    address: string;
    balance: bigint;
    decimals: number;
    currency: Currency;
    network: Networks;
}