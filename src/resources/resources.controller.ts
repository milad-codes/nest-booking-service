import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../auth/auth.decorators.js';
import {
  AvailabilityQuery,
  BusyIntervalDto,
  CreateResourceDto,
  ListResourcesQuery,
  ResourceDto,
  UpdateResourceDto,
} from './resources.dto.js';
import { ResourcesService } from './resources.service.js';

@ApiTags('resources')
@ApiBearerAuth()
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  @ApiOkResponse({ type: [ResourceDto] })
  list(@Query() query: ListResourcesQuery, @CurrentUser() user: AuthUser): Promise<ResourceDto[]> {
    return this.resources.list(user.role === 'admin' && query.includeInactive === true);
  }

  @Post()
  @Roles('admin')
  @ApiCreatedResponse({ type: ResourceDto })
  create(@Body() dto: CreateResourceDto): Promise<ResourceDto> {
    return this.resources.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOkResponse({ type: ResourceDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto): Promise<ResourceDto> {
    return this.resources.update(id, dto);
  }

  @Get(':id/availability')
  @ApiOkResponse({ type: [BusyIntervalDto], description: 'Busy (booked) intervals; everything else is free' })
  availability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQuery,
  ): Promise<BusyIntervalDto[]> {
    return this.resources.availability(id, new Date(query.from), new Date(query.to));
  }
}
