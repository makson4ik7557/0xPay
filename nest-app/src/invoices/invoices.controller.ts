import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserDecorator } from '../auth/current-user.decorator';
import { InvoiceCallbackDto } from './dto/invoice-callback.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUserDecorator() userId: number,
  ) {
    return this.service.createInvoice(dto, userId);
  }

  @Post('/callback')
  handleCallback(@Body() dto: InvoiceCallbackDto) {
    return this.service.handleCallback(dto);
  }
}
