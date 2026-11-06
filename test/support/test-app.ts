import { randomBytes } from 'crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { EmailService } from '../../src/common/chat/email.service';
import { SlackService } from '../../src/common/chat/slack.service';
import { S3Service } from '../../src/common/file/s3.service';
import { Branch } from '../../src/member/entities/branch.entity';
import { Member } from '../../src/member/entities/member.entity';
import { Menu } from '../../src/member/entities/menu.entity';

export const PASSWORD = 'Str0ng!Passw0rd';

export interface SentMail {
  to: string;
  subject: string;
  body: string;
}

export interface TestContext {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  db: DataSource;
  mails: SentMail[];
  s3: {
    objects: Map<string, { body: Buffer; contentType: string }>;
    failNextPut: boolean;
    failNextRemove: boolean;
  };
  close: () => Promise<void>;
}

/**
 * The real application, with only outbound services replaced
 */
export async function createTestApp(): Promise<TestContext> {
  const mails: SentMail[] = [];
  const s3: TestContext['s3'] = {
    objects: new Map(),
    failNextPut: false,
    failNextRemove: false,
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue({
      sendEmail: async (to: string, subject: string, body: string) => {
        mails.push({ to, subject, body });
        return { accepted: [to], rejected: [] };
      },
    })
    .overrideProvider(SlackService)
    .useValue({ sendSlack: async () => ({ result: 'ok' }) })
    .overrideProvider(S3Service)
    .useValue({
      putObjectFiles: async (input) => {
        if (s3.failNextPut) {
          s3.failNextPut = false;
          throw new Error('S3 unavailable');
        }
        s3.objects.set(input.Key, {
          body: input.Body,
          contentType: input.ContentType,
        });
        return {};
      },
      createDownloadUrl: async (key: string, filename: string) =>
        `https://signed.example.test/${key}?name=${encodeURIComponent(
          filename,
        )}`,
      removeObject: async (key: string) => {
        if (s3.failNextRemove) {
          s3.failNextRemove = false;
          throw new Error('S3 unavailable');
        }
        s3.objects.delete(key);
        return {};
      },
    })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();

  return {
    app,
    http: () => request(app.getHttpServer()),
    db: app.get(DataSource),
    mails,
    s3,
    close: () => app.close(),
  };
}

/**
 * A unique login ID of at most 20 characters, because every spec shares one database
 */
export function uniqueId(prefix: string): string {
  return prefix.slice(0, 6) + randomBytes(7).toString('hex');
}

export interface TestMember {
  id: number;
  loginId: string;
  email: string;
  username: string;
  password: string;
}

export async function signUp(
  ctx: TestContext,
  prefix = 'member',
): Promise<TestMember> {
  const loginId = uniqueId(prefix);
  const member = {
    loginId,
    email: `${loginId}@example.test`,
    username: loginId,
    password: PASSWORD,
  };
  const { body, status } = await ctx.http().post('/members').send(member);
  if (status !== 201) {
    throw new Error(`Sign-up failed: ${JSON.stringify(body)}`);
  }
  return { ...member, id: body.message.id };
}

export async function logIn(
  ctx: TestContext,
  member: Pick<TestMember, 'loginId' | 'password'>,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { body, status } = await ctx
    .http()
    .post('/members/login')
    .send({ loginId: member.loginId, password: member.password });
  if (status !== 201) {
    throw new Error(`Login failed: ${JSON.stringify(body)}`);
  }
  return body.message;
}

/**
 * An administrator can only be created directly in the database
 */
export async function createAdmin(
  ctx: TestContext,
): Promise<TestMember & { token: string }> {
  const member = await signUp(ctx, 'admin');
  await ctx.db
    .getRepository(Member)
    .update({ id: member.id }, { role: 'admin', emailValidateAt: new Date() });
  const { accessToken } = await logIn(ctx, member);
  return { ...member, token: accessToken };
}

export async function createBranch(ctx: TestContext): Promise<Branch> {
  const name = uniqueId('branch');
  return ctx.db.getRepository(Branch).save({
    name,
    title: name,
    url: 'https://branch.example.test',
    seq: 1,
    isShow: true,
  } as Branch);
}

export async function createMenu(ctx: TestContext): Promise<Menu> {
  const title = uniqueId('menu');
  return ctx.db.getRepository(Menu).save({
    title,
    link: title,
    seq: 1,
    isShow: true,
  } as unknown as Menu);
}

export function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

/**
 * For work that continues after the response has been sent
 */
export async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Condition was not met in time');
}
