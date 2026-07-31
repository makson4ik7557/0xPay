import { IsIn, IsString } from 'class-validator';
import { Currency } from '../wallets.constants';

import { validCurrencies, validNetworks } from '../wallets.constants';
export class CreateWalletDto {
  @IsString()
  @IsIn(validCurrencies)
  currency: Currency;

  @IsString()
  @IsIn(validNetworks)
  network: string;
}