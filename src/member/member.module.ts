import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { MemberService } from './member.service';
import { MemberController } from './member.controller';
import { MemberAuthController } from './member-auth.controller';
import { MemberAuthService } from './member-auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from './entities/member.entity';
import { JwtModule } from '@nestjs/jwt';
import { AuthMiddleware } from '../common/auth/auth.middleware';
import { SlackService } from '../common/chat/slack.service';
import { EmailService } from '../common/chat/email.service';
import { Branch } from './entities/branch.entity';
import { Menu } from './entities/menu.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';

@Module({
  imports: [TypeOrmModule.forFeature([Member, Menu, Branch]), JwtModule],
  controllers: [
    MemberAuthController,
    MemberController,
    MenuController,
    BranchController,
  ],
  providers: [
    MemberService,
    MemberAuthService,
    Logger,
    EmailService,
    SlackService,
    MenuService,
    BranchService,
  ],
})
export class MemberModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: '/member/*', method: RequestMethod.POST },
        { path: '/member/*', method: RequestMethod.PATCH },
        { path: '/member/*', method: RequestMethod.DELETE },
      );
  }
}
