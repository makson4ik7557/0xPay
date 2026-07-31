import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import {assetNetworks} from './wallets.constants'

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
  async createWallet(dto:CreateWalletDto,userId:any){
    if(!assetNetworks[dto.currency].map(n => n.name).includes(dto.network)){
      throw new BadRequestException('Invalid chain or network');
    }
    const newWallet = await this.prisma.wallet.create({
      data: {
        userId: userId,
        address: 'PLACEHOLDER_ADDRESS',
        currency: dto.currency,
        network: dto.network,
      },
    });

    return {
      publicId: newWallet.publicId,
      address: newWallet.address,
      currency: newWallet.currency,
      network: newWallet.network,
      createdAt: newWallet.createdAt,
    };
  }
}