import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedMember } from '../common/auth/auth.decorator';
import { RolesEnum } from '../common/auth/roles.enum';
import { Authority } from './entities/authority.entity';

/**
 * Checks what a member was granted through branch and menu authority<br/>
 * Administrators can access every branch
 */
@Injectable()
export class AuthorityService {
  constructor(
    @InjectRepository(Authority)
    private readonly authorityRepository: Repository<Authority>,
  ) {}

  async assertBranchAccess(
    member: AuthenticatedMember,
    branchId: number,
  ): Promise<void> {
    if (member.role === RolesEnum.admin) {
      return;
    }

    const granted = await this.authorityRepository.count({
      where: { memberId: member.id, branchId },
    });

    if (!granted) {
      throw new ForbiddenException({
        message: '이 지점에 대한 권한이 없습니다.',
      });
    }
  }
}
