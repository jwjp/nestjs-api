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
export class Menu {
  /**
   * Menu ID primary key<br/>
   * (Auto Increment)
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Menu name
   * @example Branch Management
   */
  @Column('varchar', {
    length: 20,
    nullable: false,
    comment: 'Menu name',
  })
  title: string;

  /**
   * Link address
   * @example /branch
   */
  @Column('varchar', {
    length: 20,
    nullable: false,
    comment: 'Link address',
  })
  link: string;

  /**
   * Menu order
   * @example 1
   */
  @Column('integer', {
    nullable: false,
    default: 99,
    comment: 'Menu order',
  })
  seq: number;

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
  @OneToMany(() => Authority, (authority) => authority.menu)
  authority: Authority[];
}
