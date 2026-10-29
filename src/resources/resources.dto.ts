import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateResourceDto {
  @ApiProperty({ example: 'Meeting room Isar' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: '8 seats, display, whiteboard' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Inactive resources cannot be booked' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListResourcesQuery {
  @ApiPropertyOptional({ description: 'Admins only: include inactive resources' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}

export class AvailabilityQuery {
  @ApiProperty({ example: '2030-01-07T00:00:00Z' })
  @IsISO8601({ strict: true })
  from: string;

  @ApiProperty({ example: '2030-01-08T00:00:00Z' })
  @IsISO8601({ strict: true })
  to: string;
}

export class ResourceDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() active: boolean;
  @ApiProperty() createdAt: Date;
}

export class BusyIntervalDto {
  @ApiProperty() startsAt: Date;
  @ApiProperty() endsAt: Date;
}
