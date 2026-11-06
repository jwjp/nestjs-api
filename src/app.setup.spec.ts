import { corsOrigin } from './app.setup';

describe('corsOrigin', () => {
  it('uses the configured list in every environment', () => {
    expect(corsOrigin('https://a.test, https://b.test', 'prod')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
    expect(corsOrigin('https://a.test', 'local')).toEqual(['https://a.test']);
  });

  it.each(['local', 'dev'])(
    'accepts any origin in %s without a list',
    (env) => {
      expect(corsOrigin(undefined, env)).toBe(true);
    },
  );

  it.each(['prod', 'test', undefined])(
    'accepts no cross-origin requests in %s without a list',
    (env) => {
      expect(corsOrigin('', env)).toBe(false);
    },
  );
});
