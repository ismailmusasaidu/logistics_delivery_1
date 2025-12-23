import { supabase } from './supabase';

export type WalletTransaction = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  description: string;
  reference_type: 'recharge' | 'order_payment' | 'refund' | 'admin_adjustment';
  reference_id: string | null;
  balance_after: number;
  created_at: string;
};

export type PaymentMethod = 'wallet' | 'online' | 'cash';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export const walletService = {
  async getBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.wallet_balance || 0;
  },

  async getTransactions(userId: string, limit = 50): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async processWalletPayment(
    userId: string,
    amount: number,
    orderId: string,
    orderNumber: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('process_wallet_payment', {
      p_user_id: userId,
      p_amount: amount,
      p_order_id: orderId,
      p_order_number: orderNumber,
    });

    if (error) {
      console.error('Wallet payment error:', error);
      throw new Error('Failed to process wallet payment');
    }

    return data === true;
  },

  async addBalance(
    userId: string,
    amount: number,
    description: string,
    referenceType: 'recharge' | 'admin_adjustment' = 'recharge'
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('add_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
      p_reference_type: referenceType,
    });

    if (error) {
      console.error('Add balance error:', error);
      throw new Error('Failed to add wallet balance');
    }

    return data === true;
  },

  async refundToWallet(
    userId: string,
    amount: number,
    orderId: string,
    orderNumber: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('refund_to_wallet', {
      p_user_id: userId,
      p_amount: amount,
      p_order_id: orderId,
      p_order_number: orderNumber,
    });

    if (error) {
      console.error('Refund error:', error);
      throw new Error('Failed to process refund');
    }

    return data === true;
  },

  formatCurrency(amount: number): string {
    return `₦${amount.toFixed(2)}`;
  },

  getTransactionIcon(type: 'credit' | 'debit'): string {
    return type === 'credit' ? '+' : '-';
  },

  getTransactionColor(type: 'credit' | 'debit'): string {
    return type === 'credit' ? '#10b981' : '#ef4444';
  },
};
