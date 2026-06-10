import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Order, OrderStatus, CreateOrderInput, OrderContextType } from '../types';
import { apiCreateOrder, apiGetOrders, apiUpdateOrderStatus, apiUpdateOrder, apiDeleteOrder } from '../services/api';

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetOrders();
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  const createOrder = useCallback(async (input: CreateOrderInput): Promise<Order> => {
    const order = await apiCreateOrder(input);
    setOrders(prev => [order, ...prev]);
    return order;
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const updated = await apiUpdateOrderStatus(orderId, status);
    if (updated) {
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    }
  }, []);

  const updateOrder = useCallback(async (orderId: string, updates: Partial<Omit<Order, 'id' | 'createdAt'>>) => {
    const updated = await apiUpdateOrder(orderId, updates);
    if (updated) {
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    }
    return updated;
  }, []);

  const deleteOrder = useCallback(async (orderId: string) => {
    const success = await apiDeleteOrder(orderId);
    if (success) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  }, []);

  const getOrder = useCallback((orderId: string) => {
    return orders.find(o => o.id === orderId);
  }, [orders]);

  return (
    <OrderContext.Provider value={{
      orders, loading, createOrder, updateOrderStatus, updateOrder, deleteOrder, getOrder, refreshOrders,
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrders must be used within an OrderProvider');
  return context;
}
