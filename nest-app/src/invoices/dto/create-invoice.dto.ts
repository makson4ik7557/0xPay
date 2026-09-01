import { IsIn, IsNumberString, IsString } from 'class-validator';
import {
  validCurrencies,
  validNetworks,
} from '../../wallets/wallets.constants';

export class CreateInvoiceDto {
  @IsString()
  @IsIn(validCurrencies)
  currency: string;

  @IsString()
  @IsIn(validNetworks)
  network: string;

  @IsNumberString({ no_symbols: true })
  amount: string;
}
