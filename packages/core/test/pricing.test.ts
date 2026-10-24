import { describe, expect, it } from 'vitest';
import { getEffectiveProductPrice, hasPromoPrice } from '../src/utils/pricing';

describe('product promotion pricing', () => {
  it('uses the promo price when it is valid', () => {
    const product = { price: 1000, promo_price: 750 };

    expect(hasPromoPrice(product)).toBe(true);
    expect(getEffectiveProductPrice(product)).toBe(750);
  });

  it.each([null, 0, -1, 1000, 1200, Number.NaN])('ignores invalid promo price %s', (promo_price) => {
    const product = { price: 1000, promo_price };

    expect(hasPromoPrice(product)).toBe(false);
    expect(getEffectiveProductPrice(product)).toBe(1000);
  });
});
