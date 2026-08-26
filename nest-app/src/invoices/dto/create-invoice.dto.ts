import { IsNumberString, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsNumberString({ no_symbols: true })
  amount: string;

  @IsString()
  currency: string;

  @IsString()
  network: string;
}
