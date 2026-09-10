import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RolesEnum } from '../../common/auth/roles.enum';
import { Authority } from './authority.entity';
import { ApiHideProperty } from '@nestjs/swagger';

@Entity()
@Index('LOGIN', ['loginId'], { unique: true })
@Index('EMAIL', ['email'], { unique: true })
@Index('ROLE', ['role'])
export class Member {
  /**
   * Member ID primary key<br/>
   * (Auto Increment)
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * ID used to log in
   * @example gildong
   */
  @Column('varchar', {
    unique: true,
    length: 20,
    nullable: false,
    comment: 'Login ID',
  })
  loginId: string;

  @Column('varchar', {
    unique: true,
    length: 50,
    nullable: false,
    comment: 'Email address',
  })
  email: string;

  /**
   * Member name
   * @example Hong Gildong
   */
  @Column('varchar', {
    length: 20,
    nullable: false,
    comment: 'Member name',
  })
  username: string;

  /**
   * Password
   * @example P@ssw0rd
   */
  @Column('varchar', {
    length: 100,
    nullable: false,
    comment: 'Password',
    select: false,
  })
  @ApiHideProperty()
  password: string;

  /**
   * Member role
   * @example admin
   */
  @Column('enum', {
    enum: RolesEnum,
    default: 'user',
    nullable: false,
    comment:
      'Member role (admin: administrator, user: regular user, deny: blocked user)',
  })
  role: string;

  /**
   * Refresh token
   */
  @Column('text', {
    nullable: true,
    default: null,
    select: false,
    comment: 'Refresh token',
  })
  @ApiHideProperty()
  refreshToken: string;

  /**
   * Email verification date
   */
  @Column('timestamp', {
    nullable: true,
    default: null,
    comment: 'Email verification date',
  })
  emailValidateAt: Date | null = null;

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
  @OneToMany(() => Authority, (authority) => authority.member)
  authority: Authority[];
}
