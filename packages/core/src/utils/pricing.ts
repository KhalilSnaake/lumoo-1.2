import type { Product } from '../types';

export function hasPromoPrice(product: Pick<Product, 'price' | 'promo_price'>): boolean {
  return typeof product.promo_price === 'number'
    && Number.isFinite(product.promo_price)
    && product.promo_price > 0
    && product.promo_price < product.price;
}

export function getEffectiveProductPrice(product: Pick<Product, 'price' | 'promo_price'>): number {
  return hasPromoPrice(product) ? product.promo_price ?? product.price : product.price;
}
