import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class InvoiceCallbackDto {
  @IsString()
  address: string;

  @IsString()
  txHash: string;

  @IsInt()
  logIndex: number;

  @IsNumberString({ no_symbols: true })
  amount: string;

  @IsInt()
  blockNumber: number;

  @IsInt()
  chainId: number;

  @IsOptional()
  @IsString()
  tokenContract?: string;

  @IsString()
  fromAddress: string;

  @IsInt()
  timestamp: number;

  @IsIn(['success', 'failed'])
  status: 'success' | 'failed';

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  fee?: string;
}
