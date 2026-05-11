import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass@123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Target tenant ID (uses first active tenant if omitted)' })
  @IsString()
  @IsOptional()
  tenantId?: string;
}
