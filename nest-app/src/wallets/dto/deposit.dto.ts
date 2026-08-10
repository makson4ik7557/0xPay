import { IsNumberString } from 'class-validator';

export class CreateDepositDto {
  @IsNumberString({ no_symbols: true })
  amount: string;
}
