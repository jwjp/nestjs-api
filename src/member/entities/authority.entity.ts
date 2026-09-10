import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Member } from './member.entity';
import { Menu } from './menu.entity';
import { Branch } from './branch.entity';

@Entity()
@Index('MEMBER', ['memberId'])
@Index('SEARCH_BRANCH_MENU', ['memberId', 'branchId'])
export class Authority {
  /**
   * Authority ID primary key<br/>
   * (Auto Increment)
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Branch ID primary key
   * @example 1
   */
  @Column('integer', {
    nullable: false,
    comment: 'Branch ID',
  })
  branchId: number;

  /**
   * Menu ID primary key
   * @example 1
   */
  @Column('integer', {
    nullable: false,
    comment: 'Menu ID',
  })
  menuId: number;

  /**
   * Member ID primary key
   * @example 1
   */
  @Column('integer', {
    nullable: false,
    comment: 'Menu ID',
  })
  memberId: number;

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

  // If a menu row is hard deleted, its authority rows are deleted too
  @ManyToOne(() => Menu, {
    onDelete: 'CASCADE',
  })
  menu: Menu;

  // If a branch row is hard deleted, its authority rows are deleted too
  @ManyToOne(() => Branch, {
    onDelete: 'CASCADE',
  })
  branch: Branch;

  // If a member row is hard deleted, its authority rows are deleted too
  @ManyToOne(() => Member, {
    onDelete: 'CASCADE',
  })
  member: Member;
}
