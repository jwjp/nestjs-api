import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PUBLIC_KEY, ROLES_KEY } from './auth.decorator';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  private accessTokenPayload: {
    id: number;
    username: string;
    role: string;
    iat: number;
    exp: number;
  };

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // isPublic 데코레이터 확인
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Public 데코레이터가 있는 컨트롤러 메소드는 인증없이 접속 가능
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    const accessToken = type === 'Bearer' ? token : undefined;

    // 액세스 토큰이 없는 경우 에러 처리
    if (!accessToken) {
      throw new BadRequestException({
        message: '액세스 토큰이 존재하지 않습니다.',
      });
    }

    // 액세스 토큰 값 확인
    this.accessTokenPayload = await this.jwtService.verifyAsync(accessToken, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET_KEY'),
    });

    // Roles 데코레이터 확인
    const roles: string[] = this.reflector.getAllAndMerge<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 토큰 데이터 중 role 값이 Roles 데코레이터에 등록되어 있지 않으면 에러 처리
    if (!roles?.includes(this.accessTokenPayload.role)) {
      throw new UnauthorizedException({
        message: '잘못 된 권한입니다.',
      });
    }

    return true;
  }
}
