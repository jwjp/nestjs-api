import { File } from '../src/common/file/entities/file.entity';
import { Branch } from '../src/member/entities/branch.entity';
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

describe('Files (e2e)', () => {
  let ctx: TestContext;
  let admin: TestMember & { token: string };
  let branch: Branch;
  let otherBranch: Branch;
  let memberToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await createAdmin(ctx);
    [branch, otherBranch] = await Promise.all([
      createBranch(ctx),
      createBranch(ctx),
    ]);

    const member = await signUp(ctx);
    const menu = await createMenu(ctx);
    await ctx
      .http()
      .patch(`/members/${member.id}`)
      .set(...bearer(admin.token))
      .send({ branchIds: [branch.id], menuIds: [menu.id] })
      .expect(200);
    memberToken = (await logIn(ctx, member)).accessToken;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const upload = (
    token: string,
    branchId: number,
    name = 'note.txt',
    content = 'hello',
  ) =>
    ctx
      .http()
      .post('/files/s3')
      .set(...bearer(token))
      .field('branchId', branchId)
      .attach('files', Buffer.from(content), name);

  const uploadedFile = async (branchId: number, name = 'note.txt') => {
    const before = await ctx.db.getRepository(File).countBy({ branchId });
    await upload(admin.token, branchId, name).expect(201);
    const rows = await ctx.db.getRepository(File).find({
      where: { branchId },
      order: { id: 'DESC' },
    });
    expect(rows).toHaveLength(before + 1);
    return rows[0];
  };

  describe('upload', () => {
    it('stores the object under the recorded key', async () => {
      const { body } = await upload(memberToken, branch.id).expect(201);
      expect(body.message[0].result).toBe(true);

      const row = await ctx.db.getRepository(File).findOne({
        where: { branchId: branch.id },
        order: { id: 'DESC' },
      });
      expect(row.path).toBe(`files/${branch.id}/${row.filename}`);
      const object = ctx.s3.objects.get(row.path);
      expect(object.body.toString()).toBe('hello');
      expect(object.contentType).toBe('text/plain');
    });

    it('keeps a Korean filename intact', async () => {
      const row = await uploadedFile(branch.id, '한글 이름.txt');
      expect(row.originalname).toBe('한글 이름.txt');
      expect(row.filename).toMatch(/^[0-9a-f-]{36}\.txt$/);
    });

    it('ignores path segments in the filename for the key', async () => {
      const row = await uploadedFile(branch.id, '../../evil.txt');
      expect(row.path).toBe(`files/${branch.id}/${row.filename}`);
      expect(row.path).not.toContain('..');
    });

    it.each([
      ['an extension that is not allowed', 'run.exe'],
      ['a script disguised by its type', 'page.html'],
    ])('rejects %s', async (_name, filename) => {
      await upload(admin.token, branch.id, filename).expect(415);
    });

    it('rejects a request without files', async () => {
      await ctx
        .http()
        .post('/files/s3')
        .set(...bearer(admin.token))
        .field('branchId', branch.id)
        .expect(400);
    });

    it('rejects a branch that does not exist', async () => {
      await upload(admin.token, 99999999).expect(400);
    });

    it('reports a failed object without recording it', async () => {
      const before = await ctx.db
        .getRepository(File)
        .countBy({ branchId: branch.id });
      ctx.s3.failNextPut = true;
      const { body } = await upload(admin.token, branch.id).expect(201);
      expect(body.message[0]).toEqual({ url: '', result: false });
      expect(
        await ctx.db.getRepository(File).countBy({ branchId: branch.id }),
      ).toBe(before);
    });
  });

  describe('branch authority', () => {
    it('blocks a member from a branch they were not granted', async () => {
      await upload(memberToken, otherBranch.id).expect(403);
      await ctx
        .http()
        .get(`/files?branch=${otherBranch.id}`)
        .set(...bearer(memberToken))
        .expect(403);
    });

    it('hides a file in another branch as if it did not exist', async () => {
      const file = await uploadedFile(otherBranch.id);
      await ctx
        .http()
        .get(`/files/${file.id}`)
        .set(...bearer(memberToken))
        .expect(404);
      await ctx
        .http()
        .delete(`/files/${file.id}`)
        .set(...bearer(memberToken))
        .expect(404);
      expect(ctx.s3.objects.has(file.path)).toBe(true);
    });

    it('blocks a member without any authority', async () => {
      const { accessToken } = await logIn(ctx, await signUp(ctx));
      await upload(accessToken, branch.id).expect(403);
    });

    it('needs a token', async () => {
      await ctx.http().get(`/files?branch=${branch.id}`).expect(401);
    });

    it('lets an administrator reach every branch', async () => {
      await ctx
        .http()
        .get(`/files?branch=${otherBranch.id}`)
        .set(...bearer(admin.token))
        .expect(200);
    });
  });

  describe('read', () => {
    it('lists the files of the branch', async () => {
      const file = await uploadedFile(branch.id);
      const { body } = await ctx
        .http()
        .get(`/files?branch=${branch.id}&perPage=1`)
        .set(...bearer(memberToken))
        .expect(200);
      expect(body.message).toHaveLength(1);
      expect(body.message[0].id).toBe(file.id);
    });

    it('returns a download link and records the access', async () => {
      const file = await uploadedFile(branch.id, '보고서.txt');
      const { body } = await ctx
        .http()
        .get(`/files/${file.id}`)
        .set(...bearer(memberToken))
        .expect(200);
      expect(body.message.originalname).toBe('보고서.txt');
      expect(body.message.downloadUrl).toContain(file.path);

      const row = await ctx.db.getRepository(File).findOneBy({ id: file.id });
      expect(row.lastAccessedAt).not.toBeNull();
    });

    it('answers 404 for an unknown file and 400 for an invalid ID', async () => {
      await ctx
        .http()
        .get('/files/99999999')
        .set(...bearer(admin.token))
        .expect(404);
      await ctx
        .http()
        .get('/files/not-a-number')
        .set(...bearer(admin.token))
        .expect(400);
    });
  });

  describe('delete', () => {
    it('removes the object and hides the record', async () => {
      const file = await uploadedFile(branch.id);
      await ctx
        .http()
        .delete(`/files/${file.id}`)
        .set(...bearer(memberToken))
        .expect(200);
      expect(ctx.s3.objects.has(file.path)).toBe(false);
      await ctx
        .http()
        .get(`/files/${file.id}`)
        .set(...bearer(memberToken))
        .expect(404);
    });

    it('still hides the record when S3 fails', async () => {
      const file = await uploadedFile(branch.id);
      ctx.s3.failNextRemove = true;
      await ctx
        .http()
        .delete(`/files/${file.id}`)
        .set(...bearer(admin.token))
        .expect(200);
      await ctx
        .http()
        .get(`/files/${file.id}`)
        .set(...bearer(admin.token))
        .expect(404);
    });
  });
});
