export interface AssetEntry {
  currency: string;
  network: string;
  chainId: number | null;
  contractAddress: string | null;
  decimals: number;
}

export const assetRegistry: AssetEntry[] = [
  {
    currency: 'ETH',
    network: 'SEPOLIA',
    chainId: 11155111,
    contractAddress: null,
    decimals: 18,
  },
];
