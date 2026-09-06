import { Injectable } from '@nestjs/common';
import { assetRegistry } from './asset-registry';

@Injectable()
export class AssetResolverService {
  resolve(
    chainId: number,
    contract: string | null,
  ): { currency: string; network: string } | null {
    const asset = assetRegistry.find(
      (asset) =>
        asset.chainId === chainId && asset.contractAddress === contract,
    );
    if (!asset) return null;
    return {
      currency: asset.currency,
      network: asset.network,
    };
  }
}
