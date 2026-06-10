/**
 * Optimise les URLs d'images Unsplash pour des tailles adaptées
 * - cartes produits : w=100, h=100, fit=crop
 * - modals / détails : w=600
 */

export function optimizeImageUrl(url: string | undefined, size: 'card' | 'modal' = 'card'): string {
  if (!url) return '';
  
  // Ne modifier que les URLs Unsplash
  if (!url.includes('images.unsplash.com')) return url;
  
  // Enlever les paramètres existants pour les remplacer
  const base = url.split('?')[0];
  
  if (size === 'card') {
    return `${base}?q=80&w=100&h=100&fit=crop`;
  }
  
  // modal
  return `${base}?q=80&w=600&fit=crop`;
}