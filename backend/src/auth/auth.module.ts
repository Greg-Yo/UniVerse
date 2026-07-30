import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDbService } from './auth-db.service';
import { MailerModule } from '../common/mailer/mailer.module';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [ConfigModule, PassportModule, JwtModule.register({}), MailerModule],
  controllers: [AuthController],
  providers: [AuthService, AuthDbService, TokenService, JwtStrategy],
  exports: [AuthDbService, TokenService, AuthService],
})
export class AuthModule {}
