import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  content: string;
}

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  getAll(@Req() req: any) {
    return this.messages.getAll(req.user.id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateMessageDto) {
    return this.messages.create(req.user.id, dto.content);
  }

  @Get('latest-pending')
  getLatestPending(@Req() req: any) {
    return this.messages.getLatestPending(req.user.id);
  }

  @Get(':id')
  findById(@Req() req: any, @Param('id') id: string) {
    return this.messages.findById(req.user.id, id);
  }

  @Patch(':id/deliver')
  markDelivered(@Req() req: any, @Param('id') id: string) {
    return this.messages.markDelivered(req.user.id, id);
  }
}
