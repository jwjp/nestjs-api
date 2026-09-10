import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FileStorageEnum } from '../file.enum';

@Entity()
export class File {
  /**
   * File primary key<br/>
   * (Auto Increment)
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Branch primary key
   */
  @Column('int', {
    nullable: false,
    comment: 'Branch primary key',
  })
  branchId: number;

  /**
   * Filename at the time of upload<br/>
   * Used as the download filename (editable)
   */
  @Column('varchar', {
    nullable: false,
    comment: 'Filename at the time of upload',
  })
  originalname: string;

  /**
   * Unique filename<br/>
   * Used to fetch the file (generated via randomUUID or similar, not editable)
   */
  @Column('varchar', {
    unique: true,
    nullable: false,
    comment: 'Unique filename',
  })
  filename: string;

  /**
   * File MimeType
   */
  @Column('varchar', {
    nullable: false,
    comment: 'MimeType',
  })
  mimetype: string;

  /**
   * File size (bytes)
   */
  @Column('int', {
    nullable: false,
    comment: 'File size (bytes)',
  })
  size: number;

  /**
   * Storage type (s3, disk)
   * @example 's3'
   */
  @Column('enum', {
    enum: FileStorageEnum,
    default: 's3',
    nullable: false,
    comment: 'Storage type (s3, disk)',
  })
  storage: FileStorageEnum;

  /**
   * Path the file is stored at
   * @example 'files/{branchId}/{date(YYYYMMDD)}'
   */
  @Column('varchar', {
    nullable: false,
    comment: 'Path the file is stored at',
  })
  path: string;

  /**
   * File access URL
   * @example 'https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{Key}'
   */
  @Column('varchar', {
    nullable: false,
    comment: 'File access URL',
  })
  url: string;

  /**
   * Last accessed timestamp
   */
  @Column('timestamp', {
    nullable: true,
    default: null,
    comment: 'Last accessed timestamp',
  })
  lastAccessedAt: Date | null = null;

  /**
   * Created timestamp
   * default: CURRENT_TIMESTAMP
   */
  @CreateDateColumn({
    type: 'timestamp',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  /**
   * Updated timestamp
   * default CURRENT_TIMESTAMP
   * On Update CURRENT_TIMESTAMP
   */
  @UpdateDateColumn({
    type: 'timestamp',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  /**
   * Deleted timestamp
   */
  @DeleteDateColumn({
    type: 'timestamp',
    precision: 0,
    default: null,
  })
  deletedAt: Date | null = null;
}
