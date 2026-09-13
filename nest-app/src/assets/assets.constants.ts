export const assetNetworks = {
  BTC: [{ name: 'BITCOIN', decimals: 8 }],
  ETH: [
    { name: 'ARBITRUM', decimals: 18 },
    { name: 'OPTIMISM', decimals: 18 },
    { name: 'ERC-20', decimals: 18 },
    { name: 'SEPOLIA', decimals: 18 },
  ],
  USDT: [
    { name: 'ERC-20', decimals: 6 },
    { name: 'TRC-20', decimals: 6 },
    { name: 'ARBITRUM', decimals: 6 },
  ],
} as const;

export type Currency = keyof typeof assetNetworks;

export const validCurrencies = Object.keys(assetNetworks);
export const validNetworks = [
  ...new Set(
    Object.values(assetNetworks)
      .flat()
      .map((n) => n.name),
  ),
];
