import { Controller, Get, Patch, Delete, Body, Req, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto, ChangePasswordDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.users.findById(req.user.id);
  }

  @Patch('me')
  update(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.users.update(req.user.id, dto);
  }

  @Patch('me/password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(req.user.id, dto);
  }

  @Delete('me')
  deleteAccount(@Req() req: any) {
    return this.users.deleteAccount(req.user.id);
  }

  @Get('me/sessions')
  getSessions(@Req() req: any) {
    return this.users.getSessions(req.user.id);
  }

  @Delete('me/sessions/:id')
  deleteSession(@Req() req: any, @Param('id') id: string) {
    return this.users.deleteSession(req.user.id, id);
  }

  @Get('me/activity')
  getActivity(@Req() req: any) {
    return this.users.getActivity(req.user.id);
  }
}
