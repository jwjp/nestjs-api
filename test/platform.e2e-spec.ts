import { DataSource } from 'typeorm';
import {
  signUp,
  createTestApp,
  PASSWORD,
  TestContext,
} from './support/test-app';

describe('Platform (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('schema', () => {
    it('is created by the migrations and matches the entities', async () => {
      const dataSource = ctx.app.get(DataSource);
      const [{ count }] = await dataSource.query(
        'SELECT COUNT(*) AS count FROM migrations',
      );
      expect(Number(count)).toBeGreaterThan(0);

      const { upQueries } = await dataSource.driver.createSchemaBuilder().log();
      expect(upQueries.map(({ query }) => query)).toEqual([]);
    });
  });

  describe('errors', () => {
    it('answer an unknown route with 404', async () => {
      await ctx.http().get('/no-such-route').expect(404);
    });

    it('answer malformed JSON with 400 and no internals', async () => {
      const { body } = await ctx
        .http()
        .post('/members/login')
        .set('Content-Type', 'application/json')
        .send('{"loginId":')
        .expect(400);
      expect(JSON.stringify(body)).not.toMatch(/node_modules|\.js:|stack/);
    });

    it('report validation failures', async () => {
      const { body } = await ctx
        .http()
        .post('/members')
        .send({ loginId: 'x' })
        .expect(400);
      expect(Array.isArray(body.message.error)).toBe(true);
    });

    it('report a duplicate as a conflict without SQL details', async () => {
      const member = await signUp(ctx);
      const { body } = await ctx
        .http()
        .post('/members')
        .send({
          loginId: member.loginId,
          email: `other${member.email}`,
          username: 'other',
          password: PASSWORD,
        })
        .expect(409);
      expect(JSON.stringify(body)).not.toMatch(/INSERT|SQLSTATE|ER_DUP/);
    });

    it('hide tokens in the echoed request path', async () => {
      const { body } = await ctx
        .http()
        .get('/members/validate/aaa.bbb.ccc')
        .expect(401);
      expect(body.request).not.toContain('aaa.bbb.ccc');
    });
  });

  describe('health', () => {
    it('keeps the root route public', async () => {
      await ctx.http().get('/').expect(200);
    });
  });

  describe('security headers', () => {
    it('are set', async () => {
      const { headers } = await ctx.http().get('/').expect(200);
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-powered-by']).toBeUndefined();
    });

    it('do not allow a cross-origin caller without a configured list', async () => {
      const { headers } = await ctx
        .http()
        .get('/')
        .set('Origin', 'https://evil.example')
        .expect(200);
      expect(headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('credential throttling', () => {
    it('limits repeated login attempts', async () => {
      process.env.AUTH_THROTTLE_LIMIT = '3';
      try {
        const statuses: number[] = [];
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const { status } = await ctx
            .http()
            .post('/members/login')
            .send({ loginId: 'throttled', password: 'Wr0ng!Passw0rd' });
          statuses.push(status);
        }
        expect(statuses.at(-1)).toBe(429);
        expect(statuses.slice(0, 3)).not.toContain(429);
      } finally {
        process.env.AUTH_THROTTLE_LIMIT = '100000';
      }
    });
  });
});
