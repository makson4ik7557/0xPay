import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import {assetNetworks} from './wallets.constants'

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}
  async createWallet(dto: CreateWalletDto, userId: number) {
    if (!assetNetworks[dto.currency].map((n: {name:string}) => n.name).includes(dto.network)) {
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

  async allUserWallets(userId: number) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId: userId },
    });
    return wallets.map((w) => ({
      publicId: w.publicId,
      address: w.address,
      currency: w.currency,
      network: w.network,
      createdAt: w.createdAt,
    }));
  }

  async getWallet(params: string, userId:number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { publicId: params } });
    if (!wallet || wallet.userId !== userId) throw new NotFoundException();
    return {
      publicId: wallet.publicId,
      address: wallet.address,
      currency: wallet.currency,
      network: wallet.network,
      createdAt: wallet.createdAt,
    };
  }
}