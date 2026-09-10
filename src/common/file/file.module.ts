import { Module } from '@nestjs/common';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { BranchService } from '../../member/branch.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../../member/entities/branch.entity';
import { File } from './entities/file.entity';

@Module({
  imports: [TypeOrmModule.forFeature([File, Branch])],
  controllers: [FileController],
  providers: [FileService, BranchService],
})
export class FileModule {}
