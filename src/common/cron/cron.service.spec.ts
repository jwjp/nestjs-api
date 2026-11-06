import { Logger } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CronService } from './cron.service';

describe('CronService.logHandling', () => {
  let dir: string;
  const s3 = { putObjectFiles: jest.fn() };
  const slack = { sendSlack: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('value') };
  const service = new CronService(
    null,
    s3 as never,
    slack as never,
    config as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('value');
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    dir = mkdtempSync(join(tmpdir(), 'logs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('uploads the content and then empties the file', async () => {
    writeFileSync(join(dir, 'a.log'), 'entry');
    s3.putObjectFiles.mockImplementation(async () => {
      // The file is still intact while the upload runs
      expect(readFileSync(join(dir, 'a.log'), 'utf8')).toBe('entry');
      return {};
    });

    await expect(service.logHandling(dir)).resolves.toHaveLength(1);

    const input = s3.putObjectFiles.mock.calls[0][0];
    expect(input.Key).toMatch(/^logs\/\d{4}-\d{2}-\d{2}\/a\.log$/);
    expect(input.Body.toString()).toBe('entry');
    expect(readFileSync(join(dir, 'a.log'), 'utf8')).toBe('');
  });

  it('keeps a file whose upload failed and continues with the rest', async () => {
    writeFileSync(join(dir, 'a.log'), 'kept');
    writeFileSync(join(dir, 'b.log'), 'sent');
    s3.putObjectFiles
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({});

    await expect(service.logHandling(dir)).resolves.toHaveLength(1);

    expect(readFileSync(join(dir, 'a.log'), 'utf8')).toBe('kept');
    expect(readFileSync(join(dir, 'b.log'), 'utf8')).toBe('');
  });

  it('skips empty and non-log files', async () => {
    writeFileSync(join(dir, 'empty.log'), '');
    writeFileSync(join(dir, 'note.txt'), 'text');

    await service.logHandling(dir);

    expect(s3.putObjectFiles).not.toHaveBeenCalled();
    expect(readFileSync(join(dir, 'note.txt'), 'utf8')).toBe('text');
  });

  it('reports an oversized file instead of uploading it', async () => {
    writeFileSync(join(dir, 'big.log'), Buffer.alloc(10 * 1024 * 1024 + 1));

    await service.logHandling(dir);

    expect(s3.putObjectFiles).not.toHaveBeenCalled();
    expect(slack.sendSlack).toHaveBeenCalledTimes(1);
  });

  it('tolerates a missing folder', async () => {
    await expect(service.logHandling(join(dir, 'none'))).resolves.toEqual([]);
  });
});
