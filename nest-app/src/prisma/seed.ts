import {assetNetworks} from '../wallets/wallets.constants'
import { PrismaService } from './prisma.service'; // твій шлях

const prisma = new PrismaService();

async function main(){
  for( const [currency,networks] of Object.entries(assetNetworks)){
    for(const networkInfo of networks){
      const network = networkInfo.name;
      const existingAccount = await prisma.account.findFirst({
        where: {
          type: 'SYSTEM',
          currency: currency,
          network: network,
        }
      });
      if(!existingAccount){
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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });