import { Member } from '../src/member/entities/member.entity';
import {
  bearer,
  createAdmin,
  createTestApp,
  logIn,
  PASSWORD,
  signUp,
  TestContext,
  waitFor,
} from './support/test-app';

const NEW_PASSWORD = 'N3w!Passw0rd99';

describe('Authentication (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const storedMember = (id: number) =>
    ctx.db.getRepository(Member).findOne({
      select: {
        id: true,
        role: true,
        refreshToken: true,
        emailValidateAt: true,
        tokenVersion: true,
      },
      where: { id },
    });

  describe('sign-up and login', () => {
    it('ignores a submitted role', async () => {
      const member = await signUp(ctx);
      await ctx
        .http()
        .post('/members')
        .send({
          loginId: `${member.loginId}b`.slice(-20),
          email: `b${member.email}`,
          username: 'second',
          password: PASSWORD,
          role: 'admin',
        })
        .expect(201)
        .expect(({ body }) => expect(body.message.role).not.toBe('admin'));
      expect((await storedMember(member.id)).role).toBe('user');
    });

    it('does not return the password', async () => {
      const { accessToken } = await logIn(ctx, await signUp(ctx));
      const { body } = await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(200);
      expect(body.message.password).toBeUndefined();
      expect(body.message.refreshToken).toBeUndefined();
    });

    it('answers the same for an unknown ID and a wrong password', async () => {
      const member = await signUp(ctx);
      const unknown = await ctx
        .http()
        .post('/members/login')
        .send({ loginId: 'nobodyatall', password: PASSWORD })
        .expect(401);
      const wrong = await ctx
        .http()
        .post('/members/login')
        .send({ loginId: member.loginId, password: 'Wr0ng!Passw0rd' })
        .expect(401);
      expect(unknown.body.message).toEqual(wrong.body.message);
    });

    it('refuses a denied member', async () => {
      const member = await signUp(ctx);
      await ctx.db
        .getRepository(Member)
        .update({ id: member.id }, { role: 'deny' });
      await ctx
        .http()
        .post('/members/login')
        .send({ loginId: member.loginId, password: PASSWORD })
        .expect(403);
    });
  });

  describe('access tokens', () => {
    it('are required', async () => {
      await ctx.http().get('/members/me').expect(401);
    });

    it('reject a forged token', async () => {
      await ctx
        .http()
        .get('/members/me')
        .set(...bearer('a.b.c'))
        .expect(401);
    });

    it('lose access as soon as the role changes', async () => {
      const admin = await createAdmin(ctx);
      const target = await createAdmin(ctx);
      await ctx
        .http()
        .get('/members/count')
        .set(...bearer(target.token))
        .expect(200);

      await ctx
        .http()
        .patch(`/members/${target.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'user' })
        .expect(200);

      await ctx
        .http()
        .get('/members/count')
        .set(...bearer(target.token))
        .expect(403);
    });

    it('stop working when the member is removed', async () => {
      const admin = await createAdmin(ctx);
      const member = await signUp(ctx);
      const { accessToken, refreshToken } = await logIn(ctx, member);

      await ctx
        .http()
        .delete(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .expect(200);
      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(401);

      // Restoring must not bring the old sessions back
      await ctx
        .http()
        .patch(`/members/${member.id}/restore`)
        .set(...bearer(admin.token))
        .expect(200);
      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(401);
      await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken })
        .expect(401);
    });
  });

  describe('refresh', () => {
    it('stores only a digest', async () => {
      const member = await signUp(ctx);
      const { refreshToken } = await logIn(ctx, member);
      const stored = await storedMember(member.id);
      expect(stored.refreshToken).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.refreshToken).not.toBe(refreshToken);
    });

    it('issues a working pair and retires the used token', async () => {
      const member = await signUp(ctx);
      const first = await logIn(ctx, member);

      const { body } = await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken: first.refreshToken })
        .expect(201);
      expect(body.message.refreshToken).not.toBe(first.refreshToken);

      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(body.message.accessToken))
        .expect(200);
      await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken: first.refreshToken })
        .expect(401);
      await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken: body.message.refreshToken })
        .expect(201);
    });

    it('lets only one of two concurrent requests win', async () => {
      const member = await signUp(ctx);
      const { refreshToken } = await logIn(ctx, member);
      const statuses = (
        await Promise.all(
          [1, 2].map(() =>
            ctx
              .http()
              .post('/members/refresh')
              .send({ id: member.id, refreshToken }),
          ),
        )
      )
        .map(({ status }) => status)
        .sort();
      expect(statuses).toEqual([201, 401]);
    });

    it('rejects a token of another purpose', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken: accessToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('ends the access and refresh tokens', async () => {
      const member = await signUp(ctx);
      const { accessToken, refreshToken } = await logIn(ctx, member);

      await ctx
        .http()
        .post('/members/logout')
        .set(...bearer(accessToken))
        .expect(200);

      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(401);
      await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken })
        .expect(401);

      const again = await logIn(ctx, member);
      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(again.accessToken))
        .expect(200);
    });
  });

  describe('my profile', () => {
    it('reaches a regular member', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      const { body } = await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(200);
      expect(body.message.id).toBe(member.id);
    });

    it('is never served from the shared cache to someone else', async () => {
      const first = await signUp(ctx);
      const second = await signUp(ctx);
      const [a, b] = await Promise.all([logIn(ctx, first), logIn(ctx, second)]);

      for (const [token, id] of [
        [a.accessToken, first.id],
        [b.accessToken, second.id],
      ] as const) {
        const { body } = await ctx
          .http()
          .get('/members/me')
          .set(...bearer(token))
          .expect(200);
        expect(body.message.id).toBe(id);
      }
    });

    it('clears the verification when the email changes', async () => {
      const member = await signUp(ctx);
      await ctx.db
        .getRepository(Member)
        .update({ id: member.id }, { emailValidateAt: new Date() });
      const { accessToken } = await logIn(ctx, member);

      await ctx
        .http()
        .patch('/members/me')
        .set(...bearer(accessToken))
        .send({ username: 'renamed' })
        .expect(200);
      expect((await storedMember(member.id)).emailValidateAt).not.toBeNull();

      await ctx
        .http()
        .patch('/members/me')
        .set(...bearer(accessToken))
        .send({ email: `new${member.email}` })
        .expect(200);
      expect((await storedMember(member.id)).emailValidateAt).toBeNull();
    });

    it('cannot change its own role', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .patch('/members/me')
        .set(...bearer(accessToken))
        .send({ username: 'renamed', role: 'admin' })
        .expect(200);
      expect((await storedMember(member.id)).role).toBe('user');
    });

    it('reports a taken email as a conflict', async () => {
      const member = await signUp(ctx);
      const other = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      const { body } = await ctx
        .http()
        .patch('/members/me')
        .set(...bearer(accessToken))
        .send({ email: other.email })
        .expect(409);
      expect(JSON.stringify(body)).not.toMatch(/Duplicate|member\./);
    });
  });

  describe('email verification', () => {
    it('can be requested by the member and does not change the role', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);

      await ctx
        .http()
        .post('/members/me/validation')
        .set(...bearer(accessToken))
        .set('Host', 'evil.example')
        .expect(200);

      const mail = ctx.mails.at(-1);
      expect(mail.to).toBe(member.email);
      const [link, token] = mail.body.match(
        /https:\/\/api\.example\.test\/members\/validate\/([^<\s]+)/,
      );
      expect(link).toBeDefined();
      expect(mail.body).not.toContain('evil.example');

      await ctx.http().get(`/members/validate/${token}`).expect(200);
      const stored = await storedMember(member.id);
      expect(stored.role).toBe('user');
      expect(stored.emailValidateAt).not.toBeNull();

      await ctx.http().get(`/members/validate/${token}`).expect(401);
      await ctx
        .http()
        .post('/members/me/validation')
        .set(...bearer(accessToken))
        .expect(400);
    });
  });

  describe('password change', () => {
    it('needs the current password', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .patch('/members/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: 'Wr0ng!Passw0rd', password: NEW_PASSWORD })
        .expect(400);
    });

    it('rejects a weak password', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .patch('/members/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, password: 'short' })
        .expect(400);
    });

    it('ends existing sessions', async () => {
      const member = await signUp(ctx);
      const { accessToken, refreshToken } = await logIn(ctx, member);

      await ctx
        .http()
        .patch('/members/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, password: NEW_PASSWORD })
        .expect(200);

      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(401);
      await ctx
        .http()
        .post('/members/refresh')
        .send({ id: member.id, refreshToken })
        .expect(401);
      await logIn(ctx, { ...member, password: NEW_PASSWORD });
    });
  });

  describe('password reset', () => {
    const requestReset = async (email: string): Promise<string> => {
      const before = ctx.mails.length;
      await ctx
        .http()
        .post('/members/password/forgot')
        .send({ email })
        .expect(200);
      await waitFor(() => ctx.mails.length > before);
      const mail = ctx.mails.at(-1);
      expect(mail.to).toBe(email);
      expect(mail.body).toContain(
        'https://app.example.test/reset-password?token=',
      );
      return mail.body.match(/token=([^<\s]+)/)[1];
    };

    it('answers the same for an unknown address and sends nothing', async () => {
      const before = ctx.mails.length;
      const { body } = await ctx
        .http()
        .post('/members/password/forgot')
        .send({ email: 'nobody@example.test' })
        .expect(200);
      expect(body.message).toEqual({ accepted: true });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(ctx.mails.length).toBe(before);
    });

    it('sets the new password, ends sessions and works only once', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      const token = await requestReset(member.email);

      await ctx
        .http()
        .post('/members/password/reset')
        .send({ token, password: NEW_PASSWORD })
        .expect(200);

      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(401);
      await logIn(ctx, { ...member, password: NEW_PASSWORD });
      await ctx
        .http()
        .post('/members/login')
        .send({ loginId: member.loginId, password: PASSWORD })
        .expect(401);

      await ctx
        .http()
        .post('/members/password/reset')
        .send({ token, password: 'An0ther!Passw0rd' })
        .expect(401);
    });

    it('rejects a token signed for another purpose', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .post('/members/password/reset')
        .send({ token: accessToken, password: NEW_PASSWORD })
        .expect(401);
    });

    it('sends nothing to a denied member', async () => {
      const member = await signUp(ctx);
      await ctx.db
        .getRepository(Member)
        .update({ id: member.id }, { role: 'deny' });
      const before = ctx.mails.length;
      await ctx
        .http()
        .post('/members/password/forgot')
        .send({ email: member.email })
        .expect(200);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(ctx.mails.length).toBe(before);
    });
  });
});
