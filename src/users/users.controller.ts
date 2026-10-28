import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { User } from './user.entity.js';

class MeDto {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
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
