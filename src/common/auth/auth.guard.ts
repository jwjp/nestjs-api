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
      throw new BadRequestException({
        message: '액세스 토큰이 존재하지 않습니다.',
      });
    }

    // Verify the access token
    this.accessTokenPayload = await this.jwtService.verifyAsync(accessToken, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET_KEY'),
    });

    // Check the Roles decorator
    const roles: string[] = this.reflector.getAllAndMerge<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Throw an error if the token's role is not registered in the Roles decorator
    if (!roles?.includes(this.accessTokenPayload.role)) {
      throw new UnauthorizedException({
        message: '잘못 된 권한입니다.',
      });
    }

    return true;
  }
}
