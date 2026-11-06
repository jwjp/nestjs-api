import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { S3Service } from './s3.service';
import { AuthorityService } from '../../member/authority.service';
import { BranchService } from '../../member/branch.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Authority } from '../../member/entities/authority.entity';
import { Branch } from '../../member/entities/branch.entity';
import { File } from './entities/file.entity';

@Module({
  imports: [TypeOrmModule.forFeature([File, Branch, Authority])],
  controllers: [FileController],
  providers: [FileService, S3Service, BranchService, AuthorityService],
})
export class FileModule {}
