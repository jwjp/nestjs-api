import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Authority } from './authority.entity';
import { ApiHideProperty } from '@nestjs/swagger';

@Entity()
export class Branch {
  /**
   * Branch ID primary key<br/>
   * (Auto Increment)
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Branch name
   * @example 'Suwon Branch'
   */
  @Column('varchar', {
    length: 20,
    nullable: false,
    comment: 'Branch name',
  })
  name: string;

  /**
   * Main display name
   * @example 'Seoul Gangnam Branch'
   */
  @Column('varchar', {
    length: 20,
    nullable: false,
    comment: 'Main display name',
  })
  title: string;

  /**
   * Homepage URL
   * @example https://docs.nestjs.com
   */
  @Column('varchar', {
    length: 100,
    nullable: false,
    comment: 'URL',
  })
  url: string;

  /**
   * Branch display order
   * @example 1
   */
  @Column('integer', {
    nullable: false,
    default: 99,
    comment: 'Order',
  })
  seq: number;

  /**
   * Whether it is shown
   * @example true | false
   */
  @Column('boolean', {
    nullable: false,
    default: false,
    comment: 'Whether it is shown',
  })
  isShow: boolean = false;

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

  @ApiHideProperty()
  @OneToMany(() => Authority, (authority) => authority.branch)
  authority: Authority[];
}
