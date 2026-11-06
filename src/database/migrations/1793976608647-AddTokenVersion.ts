import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenVersion1793976608647 implements MigrationInterface {
  name = 'AddTokenVersion1793976608647';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`member\`
            ADD \`tokenVersion\` int NOT NULL COMMENT 'Access token version' DEFAULT '0'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`member\` DROP COLUMN \`tokenVersion\`
        `);
  }
}
