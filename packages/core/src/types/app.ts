import type { Category } from './category';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  unit: string;
  category_id?: number | null;
  // `category` peut être un objet Category (jointure Supabase) OU un slug
  // string utilisé par le seed local `data/products.ts` et par les filtres
  // `p.category === 'legumes'` dans les composants.
  category?: string | Category | null;
  image_url: string;
  labels?: string;
  stock_quantity: number;
  bgColor: string;
  inStock: boolean;
  published: boolean;
  is_popular?: boolean;
  createdAt?: string;
}


export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'orange_money' | 'moov_money' | 'wave' | 'livraison';

export type OrderStatus = 'en_attente' | 'confirmee' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

export interface OrderItem {
  productId: number;
  name: string;
  emoji: string;
  price: number;
  quantity: number;
  unit: string;
}

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  gps_lat?: number;
  gps_lng?: number;
  paymentMethod: PaymentMethod;
  paymentPhone: string;
  totalPrice: number;
  status: OrderStatus;
  livreurId?: string;
  deliveryCode: string;
  receivedBy?: string;
  createdAt: string;
  updatedAt: string;
  // Payment proof fields
  paymentProofUrl?: string | null;
  paymentProofFileName?: string | null;
  paymentProofUploadedAt?: string | null;
}

export interface OrderContextType {
  orders: Order[];
  loading: boolean;
  createOrder: (data: CreateOrderInput) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrder: (orderId: string, updates: Partial<Omit<Order, 'id' | 'createdAt'>>) => Promise<Order | null>;
  deleteOrder: (orderId: string) => void;
  getOrder: (orderId: string) => Order | undefined;
  refreshOrders: () => void;
}

export interface CreateOrderInput {
  userId?: string;
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  gps_lat?: number;
  gps_lng?: number;
  paymentMethod: PaymentMethod;
  paymentPhone: string;
}

export interface ProductContextType {
  products: Product[];
  loading: boolean;
  fetchProducts: () => Promise<void>;
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => Promise<Product | null>;
  updateProduct: (id: number, p: Partial<Product>) => Promise<Product | null>;
  deleteProduct: (id: number) => Promise<boolean>;
  seedProducts: () => Promise<void>;
}

export type AdPosition = 'top' | 'middle' | 'sidebar' | 'footer';

export interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url?: string;
  position: AdPosition;
  active: boolean;
  created_at?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  created_at: string;
  is_read?: boolean;
  responded_at?: string;
  response?: string;
}

export interface AdContextType {
  ads: Ad[];
  loading: boolean;
  fetchAds: () => Promise<void>;
  addAd: (ad: Omit<Ad, 'id' | 'created_at'>) => Promise<Ad | null>;
  updateAd: (id: string, updates: Partial<Ad>) => Promise<Ad | null>;
  deleteAd: (id: string) => Promise<boolean>;
  seedAds: () => Promise<void>;
}
