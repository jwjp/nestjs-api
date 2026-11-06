import { isAllowedUpload } from './allowed-mime.array';

describe('isAllowedUpload', () => {
  it('accepts matching MIME types and extensions', () => {
    expect(isAllowedUpload('image/png', 'photo.PNG')).toBe(true);
    expect(isAllowedUpload('image/jpeg', 'photo.jpeg')).toBe(true);
  });

  it('rejects mismatched, missing and unknown types', () => {
    expect(isAllowedUpload('image/png', 'page.html')).toBe(false);
    expect(isAllowedUpload('text/html', 'page.html')).toBe(false);
    expect(isAllowedUpload('image/png', 'no-extension')).toBe(false);
    expect(isAllowedUpload('constructor', 'photo.png')).toBe(false);
  });
});
