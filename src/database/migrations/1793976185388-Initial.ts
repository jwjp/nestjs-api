import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1793976185388 implements MigrationInterface {
  name = 'Initial1793976185388';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`member\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`loginId\` varchar(20) NOT NULL COMMENT 'Login ID',
                \`email\` varchar(50) NOT NULL COMMENT 'Email address',
                \`username\` varchar(20) NOT NULL COMMENT 'Member name',
                \`password\` varchar(100) NOT NULL COMMENT 'Password',
                \`role\` enum ('admin', 'user', 'deny') NOT NULL COMMENT 'Member role (admin: administrator, user: regular user, deny: blocked user)' DEFAULT 'user',
                \`refreshToken\` text NULL COMMENT 'Refresh token',
                \`emailValidateAt\` timestamp NULL COMMENT 'Email verification date',
                \`createdAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updatedAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                \`deletedAt\` timestamp(0) NULL,
                INDEX \`ROLE\` (\`role\`),
                UNIQUE INDEX \`EMAIL\` (\`email\`),
                UNIQUE INDEX \`LOGIN\` (\`loginId\`),
                UNIQUE INDEX \`IDX_986c24441c1cc7594a67fa3dda\` (\`loginId\`),
                UNIQUE INDEX \`IDX_4678079964ab375b2b31849456\` (\`email\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`menu\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`title\` varchar(20) NOT NULL COMMENT 'Menu name',
                \`link\` varchar(20) NOT NULL COMMENT 'Link address',
                \`seq\` int NOT NULL COMMENT 'Menu order' DEFAULT '99',
                \`createdAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updatedAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                \`deletedAt\` timestamp(0) NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`branch\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`name\` varchar(20) NOT NULL COMMENT 'Branch name',
                \`title\` varchar(20) NOT NULL COMMENT 'Main display name',
                \`url\` varchar(100) NOT NULL COMMENT 'URL',
                \`seq\` int NOT NULL COMMENT 'Order' DEFAULT '99',
                \`isShow\` tinyint NOT NULL COMMENT 'Whether it is shown' DEFAULT 0,
                \`createdAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updatedAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                \`deletedAt\` timestamp(0) NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`authority\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`branchId\` int NOT NULL COMMENT 'Branch ID',
                \`menuId\` int NOT NULL COMMENT 'Menu ID',
                \`memberId\` int NOT NULL COMMENT 'Menu ID',
                \`createdAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updatedAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                \`deletedAt\` timestamp(0) NULL,
                INDEX \`SEARCH_BRANCH_MENU\` (\`memberId\`, \`branchId\`),
                INDEX \`MEMBER\` (\`memberId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`file\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`branchId\` int NOT NULL COMMENT 'Branch primary key',
                \`originalname\` varchar(255) NOT NULL COMMENT 'Filename at the time of upload',
                \`filename\` varchar(255) NOT NULL COMMENT 'Unique filename',
                \`mimetype\` varchar(255) NOT NULL COMMENT 'MimeType',
                \`size\` int NOT NULL COMMENT 'File size (bytes)',
                \`storage\` enum ('s3', 'disk') NOT NULL COMMENT 'Storage type (s3, disk)' DEFAULT 's3',
                \`path\` varchar(255) NOT NULL COMMENT 'Path the file is stored at',
                \`url\` varchar(255) NOT NULL COMMENT 'File access URL',
                \`lastAccessedAt\` timestamp NULL COMMENT 'Last accessed timestamp',
                \`createdAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updatedAt\` timestamp(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                \`deletedAt\` timestamp(0) NULL,
                UNIQUE INDEX \`IDX_51e2d4c72df88f28a560615379\` (\`filename\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            ALTER TABLE \`authority\`
            ADD CONSTRAINT \`FK_5998b476cff609740239720023d\` FOREIGN KEY (\`menuId\`) REFERENCES \`menu\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE \`authority\`
            ADD CONSTRAINT \`FK_372be754c949f868afdfda02740\` FOREIGN KEY (\`branchId\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE \`authority\`
            ADD CONSTRAINT \`FK_5d2ef6d32384fc743418c66d382\` FOREIGN KEY (\`memberId\`) REFERENCES \`member\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`authority\` DROP FOREIGN KEY \`FK_5d2ef6d32384fc743418c66d382\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`authority\` DROP FOREIGN KEY \`FK_372be754c949f868afdfda02740\`
        `);
    await queryRunner.query(`
            ALTER TABLE \`authority\` DROP FOREIGN KEY \`FK_5998b476cff609740239720023d\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_51e2d4c72df88f28a560615379\` ON \`file\`
        `);
    await queryRunner.query(`
            DROP TABLE \`file\`
        `);
    await queryRunner.query(`
            DROP INDEX \`MEMBER\` ON \`authority\`
        `);
    await queryRunner.query(`
            DROP INDEX \`SEARCH_BRANCH_MENU\` ON \`authority\`
        `);
    await queryRunner.query(`
            DROP TABLE \`authority\`
        `);
    await queryRunner.query(`
            DROP TABLE \`branch\`
        `);
    await queryRunner.query(`
            DROP TABLE \`menu\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_4678079964ab375b2b31849456\` ON \`member\`
        `);
    await queryRunner.query(`
            DROP INDEX \`IDX_986c24441c1cc7594a67fa3dda\` ON \`member\`
        `);
    await queryRunner.query(`
            DROP INDEX \`LOGIN\` ON \`member\`
        `);
    await queryRunner.query(`
            DROP INDEX \`EMAIL\` ON \`member\`
        `);
    await queryRunner.query(`
            DROP INDEX \`ROLE\` ON \`member\`
        `);
    await queryRunner.query(`
            DROP TABLE \`member\`
        `);
  }
}
