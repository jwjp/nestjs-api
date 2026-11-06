import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PUBLIC_KEY, ROLES_KEY } from './auth.decorator';
import { Member } from '../../member/entities/member.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check the isPublic decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Controller methods with the Public decorator can be accessed without authentication
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    const accessToken = type === 'Bearer' ? token : undefined;

    // Throw an error if the access token is missing
    if (!accessToken) {
      throw new UnauthorizedException({
        message: '액세스 토큰이 존재하지 않습니다.',
      });
    }

    // Verify the access token
    const payload = await this.jwtService.verifyAsync(accessToken, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET_KEY'),
    });

    // The database decides, so a role change, a removal or a sign-out applies
    // immediately instead of when the token expires
    const member = await this.memberRepository.findOne({
      select: { id: true, role: true, tokenVersion: true },
      where: { id: payload.id },
    });

    if (!member || member.tokenVersion !== (payload.ver ?? 0)) {
      throw new UnauthorizedException({
        message: '만료된 세션입니다. 다시 로그인해주세요.',
      });
    }

    // Check the Roles decorator
    const roles: string[] = this.reflector.getAllAndMerge<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Throw an error if the member's role is not registered in the Roles decorator
    if (!roles?.includes(member.role)) {
      throw new ForbiddenException({
        message: '잘못 된 권한입니다.',
      });
    }

    request.member = { id: member.id, role: member.role };

    return true;
  }
}
