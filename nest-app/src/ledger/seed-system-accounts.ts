import {PrismaService} from '../prisma/prisma.service';
import { assetNetworks } from '../wallets/wallets.constants';

export async function seedSystemAccounts(prisma: PrismaService) {
  for (const [currency, networks] of Object.entries(assetNetworks)) {
    for (const networkInfo of networks) {
      const network = networkInfo.name;
      const existingAccount = await prisma.account.findFirst({
        where: {
          type: 'SYSTEM',
          currency: currency,
          network: network,
        },
      });
      if (!existingAccount) {
        await prisma.account.create({
          data: {
            type: 'SYSTEM',
            currency: currency,
            network: network,
          },
        });
      }
    }
  }
}
