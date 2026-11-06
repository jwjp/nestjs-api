import { Authority } from '../src/member/entities/authority.entity';
import { Member } from '../src/member/entities/member.entity';
import {
  bearer,
  createAdmin,
  createBranch,
  createMenu,
  createTestApp,
  logIn,
  signUp,
  TestContext,
  TestMember,
} from './support/test-app';

const NEW_PASSWORD = 'N3w!Passw0rd99';

describe('Member administration (e2e)', () => {
  let ctx: TestContext;
  let admin: TestMember & { token: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await createAdmin(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const stored = (id: number) => ctx.db.getRepository(Member).findOneBy({ id });

  const verified = async (): Promise<TestMember> => {
    const member = await signUp(ctx);
    await ctx.db
      .getRepository(Member)
      .update({ id: member.id }, { emailValidateAt: new Date() });
    return member;
  };

  describe('access', () => {
    it.each([
      ['get', '/members'],
      ['get', '/members/count'],
      ['get', '/branch'],
      ['get', '/menu'],
      ['get', '/cron'],
    ] as const)('%s %s is for administrators', async (method, path) => {
      await ctx.http()[method](path).expect(401);

      const { accessToken } = await logIn(ctx, await signUp(ctx));
      await ctx
        .http()
        [method](path)
        .set(...bearer(accessToken))
        .expect(403);

      await ctx
        .http()
        [method](path)
        .set(...bearer(admin.token))
        .expect(200);
    });
  });

  describe('list', () => {
    it('paginates with the default page size', async () => {
      for (let index = 0; index < 11; index += 1) {
        await signUp(ctx);
      }
      const { body } = await ctx
        .http()
        .get('/members')
        .set(...bearer(admin.token))
        .expect(200);
      expect(body.message).toHaveLength(10);
      expect(body.message[0].password).toBeUndefined();

      const second = await ctx
        .http()
        .get('/members?page=2&perPage=2')
        .set(...bearer(admin.token))
        .expect(200);
      expect(second.body.message).toHaveLength(2);
      expect(second.body.message[0].id).not.toBe(body.message[0].id);
    });
  });

  describe('role changes', () => {
    it('promote only a verified member', async () => {
      const member = await signUp(ctx);
      await ctx
        .http()
        .patch(`/members/${member.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'admin' })
        .expect(400);

      const ready = await verified();
      await ctx
        .http()
        .patch(`/members/${ready.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'admin' })
        .expect(200);
      expect((await stored(ready.id)).role).toBe('admin');
    });

    it('reject an unknown role and member', async () => {
      const member = await verified();
      await ctx
        .http()
        .patch(`/members/${member.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'root' })
        .expect(400);
      await ctx
        .http()
        .patch('/members/99999999/role')
        .set(...bearer(admin.token))
        .send({ role: 'user' })
        .expect(400);
    });

    it('cannot target yourself', async () => {
      await ctx
        .http()
        .patch(`/members/${admin.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'user' })
        .expect(400);
      expect((await stored(admin.id)).role).toBe('admin');
    });

    it('can deny a member', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .patch(`/members/${member.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'deny' })
        .expect(200);
      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(403);
    });
  });

  describe('updates', () => {
    const grant = async (member: TestMember) => {
      const [branch, menu] = await Promise.all([
        createBranch(ctx),
        createMenu(ctx),
      ]);
      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ branchIds: [branch.id], menuIds: [menu.id] })
        .expect(200);
      return { branch, menu };
    };
    const authorityCount = (memberId: number) =>
      ctx.db.getRepository(Authority).countBy({ memberId });

    it('keep role and verification when only the password changes', async () => {
      const member = await verified();
      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ password: NEW_PASSWORD })
        .expect(200);
      const row = await stored(member.id);
      expect(row.role).toBe('user');
      expect(row.emailValidateAt).not.toBeNull();
    });

    it('end the sessions of a member whose password was changed', async () => {
      const member = await signUp(ctx);
      const { accessToken } = await logIn(ctx, member);
      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ password: NEW_PASSWORD })
        .expect(200);
      await ctx
        .http()
        .get('/members/me')
        .set(...bearer(accessToken))
        .expect(401);
    });

    it('keep granted authority unless it is part of the update', async () => {
      const member = await signUp(ctx);
      await grant(member);
      expect(await authorityCount(member.id)).toBe(1);

      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ username: 'renamed' })
        .expect(200);
      expect(await authorityCount(member.id)).toBe(1);
    });

    it('replace authority and clear it with empty lists', async () => {
      const member = await signUp(ctx);
      await grant(member);
      await grant(member);
      expect(await authorityCount(member.id)).toBe(1);

      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ branchIds: [], menuIds: [] })
        .expect(200);
      expect(await authorityCount(member.id)).toBe(0);
    });

    it('reject authority for a branch that does not exist', async () => {
      const member = await signUp(ctx);
      const menu = await createMenu(ctx);
      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ branchIds: [99999999], menuIds: [menu.id] })
        .expect(400);
    });

    it('clear verification and keep the role when the email changes', async () => {
      const member = await verified();
      await ctx
        .http()
        .patch(`/members/${member.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'admin' })
        .expect(200);

      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ email: member.email })
        .expect(200);
      expect((await stored(member.id)).emailValidateAt).not.toBeNull();

      await ctx
        .http()
        .patch(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .send({ email: `new${member.email}` })
        .expect(200);
      const row = await stored(member.id);
      expect(row.emailValidateAt).toBeNull();
      expect(row.role).toBe('admin');
    });
  });

  describe('removal', () => {
    it('cannot target yourself', async () => {
      await ctx
        .http()
        .delete(`/members/${admin.id}`)
        .set(...bearer(admin.token))
        .expect(400);
      expect(await stored(admin.id)).not.toBeNull();
    });

    it('keeps the role and clears verification across a restore', async () => {
      const member = await verified();
      await ctx
        .http()
        .patch(`/members/${member.id}/role`)
        .set(...bearer(admin.token))
        .send({ role: 'admin' })
        .expect(200);

      await ctx
        .http()
        .delete(`/members/${member.id}`)
        .set(...bearer(admin.token))
        .expect(200);
      expect(await stored(member.id)).toBeNull();

      await ctx
        .http()
        .patch(`/members/${member.id}/restore`)
        .set(...bearer(admin.token))
        .expect(200);
      const row = await stored(member.id);
      expect(row.role).toBe('admin');
      expect(row.emailValidateAt).toBeNull();
    });
  });
});
