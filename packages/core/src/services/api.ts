import { Order, OrderStatus, CreateOrderInput, PaymentMethod } from '../types';
import { getSupabase } from '../lib/supabaseClient';

function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LUM-${timestamp}-${random}`;
}

function rowToOrder(row: any, items: any[]): Order {
  return {
    id: row.id,
    userId: row.user_id,
    items: items.map((i: any) => ({
      productId: i.product_id,
      name: i.name,
      emoji: i.emoji || '📦',
      price: i.price,
      quantity: i.quantity,
      unit: i.unit,
    })),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    address: row.address,
    city: row.city,
    gps_lat: row.gps_lat,
    gps_lng: row.gps_lng,
    paymentMethod: row.payment_method,
    paymentPhone: row.payment_phone || '',
    totalPrice: row.total_price,
    status: row.status,
    livreurId: row.livreur_id,
    deliveryCode: row.delivery_code || '',
    receivedBy: row.received_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Payment proof fields
    paymentProofUrl: row.payment_proof_url,
    paymentProofFileName: row.payment_proof_file_name,
    paymentProofUploadedAt: row.payment_proof_uploaded_at,
  };
}

// ─── API Functions ───

export async function apiCreateOrder(input: CreateOrderInput): Promise<Order> {
  const supabase = getSupabase();
  const orderId = generateOrderId();
  const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString(); 
  const now = new Date().toISOString();
  
  const totalPrice = input.items.reduce((sum, item) => {
    return sum + (item.product.price * item.quantity);
  }, 0);

  // Insert order
  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    user_id: input.userId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    address: input.address,
    city: input.city,
    gps_lat: input.gps_lat,
    gps_lng: input.gps_lng,
    payment_method: input.paymentMethod,
    payment_phone: input.paymentPhone,
    total_price: totalPrice,
    status: 'en_attente',
    delivery_code: deliveryCode,
    created_at: now,
    updated_at: now,
  });

  if (orderError) throw orderError;

  // Insert order items
  const orderItems = input.items.map(item => ({
    order_id: orderId,
    product_id: item.product.id,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity,
    unit: item.product.unit,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  return {
    id: orderId,
    userId: input.userId,
    items: orderItems.map(i => ({
      productId: i.product_id,
      name: i.name,
      emoji: '📦',
      price: i.price,
      quantity: i.quantity,
      unit: i.unit,
    })),
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    address: input.address,
    city: input.city,
    paymentMethod: input.paymentMethod,
    paymentPhone: input.paymentPhone,
    totalPrice,
    status: 'en_attente',
    deliveryCode,
    createdAt: now,
    updatedAt: now,
  };
}

// Suivi sécurisé d'une commande (invité) : la RLS verrouille `orders`,
// on passe par la fonction SECURITY DEFINER `track_order(numéro, code)`.
export async function apiTrackOrder(orderId: string, deliveryCode: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('track_order', {
    p_order_id: orderId.trim().toUpperCase(),
    p_delivery_code: deliveryCode.trim(),
  });
  if (error || !data) return null;
  return data;
}

// Livreur : liste de ses livraisons assignées SANS le code de livraison.
// Passe par la fonction SECURITY DEFINER get_livreur_orders (la RLS n'autorise
// plus le livreur à lire orders directement → le code ne lui est jamais exposé).
export async function apiGetLivreurOrders(): Promise<Order[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_livreur_orders');
  if (error || !data) return [];
  return (data as any[]).map((o) => rowToOrder(o, o.items || []));
}

// Livreur : validation de livraison côté SERVEUR. Le code est vérifié dans
// confirm_delivery (SECURITY DEFINER) — jamais comparé dans l'app du livreur.
// Renvoie true si validé, false si code incorrect / commande introuvable.
export async function apiConfirmDelivery(
  orderId: string,
  deliveryCode: string,
  receivedBy: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('confirm_delivery', {
    p_order_id: orderId,
    p_delivery_code: deliveryCode.trim(),
    p_received_by: receivedBy.trim(),
  });
  if (error) return false;
  return data === true;
}

export async function apiGetOrders(): Promise<Order[]> {
  const supabase = getSupabase();
  // Fetch orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (ordersError || !orders) return [];

  // Fetch all order items
  const orderIds = orders.map((o: any) => o.id);
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);

  if (itemsError || !items) return orders.map((o: any) => rowToOrder(o, []));

  // Group items by order_id
  const itemsByOrder: Record<string, any[]> = {};
  items.forEach((item: any) => {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  });

  return orders.map((o: any) => rowToOrder(o, itemsByOrder[o.id] || []));
}

export async function apiGetOrder(orderId: string): Promise<Order | undefined> {
  const supabase = getSupabase();
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) return undefined;

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  return rowToOrder(order, items || []);
}

export async function apiUpdateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: now })
    .eq('id', orderId)
    .select()
    .single();

  if (error || !data) return null;

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  return rowToOrder(data, items || []);
}

export async function apiUpdateOrder(orderId: string, updates: Partial<Omit<Order, 'id' | 'createdAt'>>): Promise<Order | null> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const updateData: any = { updated_at: now };

  if (updates.userId !== undefined) updateData.user_id = updates.userId;
  if (updates.customerName !== undefined) updateData.customer_name = updates.customerName;
  if (updates.customerPhone !== undefined) updateData.customer_phone = updates.customerPhone;
  if (updates.address !== undefined) updateData.address = updates.address;
  if (updates.city !== undefined) updateData.city = updates.city;
  if (updates.gps_lat !== undefined) updateData.gps_lat = updates.gps_lat;
  if (updates.gps_lng !== undefined) updateData.gps_lng = updates.gps_lng;
  if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
  if (updates.paymentPhone !== undefined) updateData.payment_phone = updates.paymentPhone;
  if (updates.totalPrice !== undefined) updateData.total_price = updates.totalPrice;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.livreurId !== undefined) updateData.livreur_id = updates.livreurId;
  if (updates.receivedBy !== undefined) updateData.received_by = updates.receivedBy;
  // Payment proof fields
  if (updates.paymentProofUrl !== undefined) updateData.payment_proof_url = updates.paymentProofUrl;
  if (updates.paymentProofFileName !== undefined) updateData.payment_proof_file_name = updates.paymentProofFileName;
  if (updates.paymentProofUploadedAt !== undefined) updateData.payment_proof_uploaded_at = updates.paymentProofUploadedAt;

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (error || !data) return null;

  // Update items if provided
  if (updates.items && updates.items.length > 0) {
    // Delete old items
    await supabase.from('order_items').delete().eq('order_id', orderId);

    // Insert new items
    const newItems = updates.items.map(item => ({
      order_id: orderId,
      product_id: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit,
    }));

    await supabase.from('order_items').insert(newItems);
  }

  // Fetch updated order with items
  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  return rowToOrder(data, items || []);
}

export async function apiDeleteOrder(orderId: string): Promise<boolean> {
  const supabase = getSupabase();
  // order_items will be cascade deleted
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  return !error;
}

// ─── Stats ───

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  deliveredOrders: number;
  todayOrders: number;
  todayRevenue: number;
  byStatus: Record<OrderStatus, number>;
}

export async function apiGetStats(): Promise<DashboardStats> {
  const supabase = getSupabase();
  const { data: orders } = await supabase
    .from('orders')
    .select('status, total_price, created_at');

  const list = orders || [];
  const today = new Date().toISOString().split('T')[0];

  const byStatus = list.reduce((acc: any, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const todayOrders = list.filter((o: any) => o.created_at?.startsWith(today));
  const todayRevenue = todayOrders.reduce((s: number, o: any) => s + (o.total_price || 0), 0);

  return {
    totalOrders: list.length,
    totalRevenue: list.reduce((s: number, o: any) => s + (o.total_price || 0), 0),
    pendingOrders: list.filter((o: any) => o.status === 'en_attente' || o.status === 'confirmee').length,
    deliveredOrders: list.filter((o: any) => o.status === 'livree').length,
    todayOrders: todayOrders.length,
    todayRevenue,
    byStatus,
  };
}

// ─── Méthodes de paiement (config pilotée par l'admin) ───

// 'cash' = à la livraison · 'manual' = numéro + WhatsApp · 'link' = page de paiement hébergée (pay_url)
export type PaymentMethodType = 'cash' | 'manual' | 'link';

export type PaymentMethodConfig = {
  id: PaymentMethod;
  label: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  type: PaymentMethodType;
  payUrl: string | null;
};

// Toutes les méthodes, triées. Le checkout filtre `enabled` ; l'admin voit tout.
// Lecture publique (RLS) → disponible aussi pour l'invité. Renvoie [] si la table
// n'existe pas encore → l'UI bascule alors sur sa liste par défaut (pas de casse).
export async function apiGetPaymentMethods(): Promise<PaymentMethodConfig[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id as PaymentMethod,
    label: r.label,
    description: r.description ?? '',
    enabled: !!r.enabled,
    sortOrder: r.sort_order ?? 0,
    type: (r.type ?? 'manual') as PaymentMethodType,
    payUrl: r.pay_url ?? null,
  }));
}

// Mise à jour d'une méthode (admin uniquement, verrouillé par la RLS).
export async function apiUpdatePaymentMethod(
  id: PaymentMethod,
  updates: Partial<Omit<PaymentMethodConfig, 'id'>>,
): Promise<boolean> {
  const supabase = getSupabase();
  const patch: any = {};
  if (updates.label !== undefined) patch.label = updates.label;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.enabled !== undefined) patch.enabled = updates.enabled;
  if (updates.sortOrder !== undefined) patch.sort_order = updates.sortOrder;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.payUrl !== undefined) patch.pay_url = updates.payUrl;
  const { error } = await supabase.from('payment_methods').update(patch).eq('id', id);
  return !error;
}
