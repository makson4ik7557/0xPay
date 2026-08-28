import { IsNumberString, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  walletPublicId: string;

  @IsNumberString({ no_symbols: true })
  amount: string;
}
