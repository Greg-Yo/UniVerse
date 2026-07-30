import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Jeton de verification recu par email / expose en dev.' })
  @IsString()
  @MinLength(16)
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}
