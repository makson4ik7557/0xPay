import { IsInt, IsNumberString, IsOptional, IsString } from 'class-validator';

export class RegisterWatchDto {
  @IsString()
  eventId: string;

  @IsInt()
  merchantId: number;

  @IsString()
  address: string;

  @IsNumberString({ no_symbols: true })
  amount: string;

  @IsOptional()
  @IsString()
  tokenContract?: string;

  @IsString()
  chain: string;

  @IsInt()
  confirmations: number;

  @IsInt()
  expiresAt: number;
}
