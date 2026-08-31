import { IsIn, IsNumberString, IsString } from 'class-validator';
import { validCurrencies, validNetworks } from '../wallets.constants';

export class CreateWithdrawalDto {
  @IsString()
  @IsIn(validCurrencies)
  currency: string;

  @IsString()
  @IsIn(validNetworks)
  network: string;

  @IsNumberString({ no_symbols: true })
  amount: string;
}
