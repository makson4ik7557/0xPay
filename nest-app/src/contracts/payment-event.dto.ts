import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export const PAYMENT_EVENT_STATUSES = ['PENDING', 'PENDING_CONFIRMED'] as const;

export type PaymentEventStatus = (typeof PAYMENT_EVENT_STATUSES)[number];

export class PaymentEventDto {
  @IsString()
  eventId: string;

  @IsInt()
  merchantId: number;

  @IsString()
  hash: string;

  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsNumberString({ no_symbols: true })
  amount: string;

  @IsOptional()
  @IsString()
  contract?: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  fee?: string;

  @IsInt()
  blockNumber: number;

  @IsString()
  chain: string;

  @IsIn(PAYMENT_EVENT_STATUSES)
  status: PaymentEventStatus;
}
