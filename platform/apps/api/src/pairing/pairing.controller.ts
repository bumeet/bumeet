import { Controller, Post, Get, Query, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { PairingService } from './pairing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class RegisterDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]+$/)
  code: string;
}

class ApproveDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]+$/)
  code: string;
}

@Controller('agent/pair')
export class PairingController {
  constructor(private pairing: PairingService) {}

  /** Agent calls this immediately after generating a code. No auth. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    this.pairing.register(dto.code);
    return { ok: true, expiresInSeconds: 300 };
  }

  /** Agent polls this until approved or expired. No auth. */
  @Get('status')
  status(@Query('code') code: string) {
    if (!code || code.length !== 6) throw new BadRequestException('Invalid code');
    return this.pairing.poll(code.toUpperCase());
  }

  /** User submits the code from the portal. Requires JWT. */
  @UseGuards(JwtAuthGuard)
  @Post('approve')
  async approve(@Req() req: any, @Body() dto: ApproveDto) {
    const result = await this.pairing.approve(dto.code, req.user.id);
    if (!result) throw new BadRequestException('Code expired or not found');
    return { ok: true };
  }
}
