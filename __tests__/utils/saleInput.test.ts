import { parseSaleNumber, normalizeKenyanPhoneInput } from '@/utils/saleInput';

describe('sale numeric input', () => {
  test.each(['2abc', '1.2.3', 'Infinity', '-1', '0', '', '1e3', '1,2,3'])(
    'rejects malformed or nonpositive input %s', (input) => expect(parseSaleNumber(input)).toBeNull(),
  );
  it('accepts decimal quantities and Kenyan keyboard comma separators', () => {
    expect(parseSaleNumber('0,5')).toBe(0.5);
    expect(parseSaleNumber(' .25 ')).toBe(0.25);
    expect(parseSaleNumber('12', true)).toBe(12);
  });
  it('rejects fractional whole units instead of truncating them', () => {
    expect(parseSaleNumber('1.5', true)).toBeNull();
    expect(parseSaleNumber('9007199254740992', true)).toBeNull();
  });
});

 test.each(['0712345678', '+254712345678', '254712345678', '712345678', '0712 345 678'])(
  'normalizes pasted phone %s', (value) => expect(normalizeKenyanPhoneInput(value)).toBe('+254712345678'),
 );
