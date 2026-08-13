import {IsNumberString} from 'class-validator';

export class CreateWithdrawalDto {
  @IsNumberString({ no_symbols: true })
  amount: string;
}
