import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { User } from './user.entity.js';

class MeDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ['admin', 'member'] }) role: string;
  @ApiProperty() createdAt: Date;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly em: EntityManager) {}

  @Get('me')
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentUser() current: AuthUser): Promise<MeDto> {
    const user = await this.em.findOneOrFail(User, current.id);
    return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
  }
}
