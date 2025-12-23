import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { X, Wallet, CreditCard, Banknote, CheckCircle2 } from 'lucide-react-native';
import { PricingBreakdown as PricingBreakdownType } from '@/lib/pricingCalculator';
import { PaymentMethod, walletService } from '@/lib/wallet';
import { PricingBreakdown } from './PricingBreakdown';

type CheckoutModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => Promise<void>;
  pricing: PricingBreakdownType;
  userId: string;
};

export function CheckoutModal({ visible, onClose, onConfirm, pricing, userId }: CheckoutModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadWalletBalance();
    }
  }, [visible]);

  const loadWalletBalance = async () => {
    setLoadingBalance(true);
    try {
      const balance = await walletService.getBalance(userId);
      setWalletBalance(balance);
    } catch (err: any) {
      console.error('Error loading wallet balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleConfirmPayment = async () => {
    setError(null);

    if (selectedPayment === 'wallet' && walletBalance < pricing.finalPrice) {
      setError('Insufficient wallet balance. Please recharge your wallet or choose another payment method.');
      return;
    }

    if (selectedPayment === 'online') {
      setError('Online payment is not yet configured. Please use Wallet or Cash on Delivery.');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(selectedPayment);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentOptions = [
    {
      id: 'wallet' as PaymentMethod,
      title: 'Wallet',
      description: `Balance: ${walletService.formatCurrency(walletBalance)}`,
      icon: Wallet,
      available: walletBalance >= pricing.finalPrice,
      badge: walletBalance >= pricing.finalPrice ? null : 'Insufficient Balance',
    },
    {
      id: 'online' as PaymentMethod,
      title: 'Online Payment',
      description: 'Pay via Credit/Debit Card',
      icon: CreditCard,
      available: false,
      badge: 'Coming Soon',
    },
    {
      id: 'cash' as PaymentMethod,
      title: 'Cash on Delivery',
      description: 'Pay when you receive',
      icon: Banknote,
      available: true,
      badge: null,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Checkout</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <PricingBreakdown breakdown={pricing} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>

              {loadingBalance ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.loadingText}>Loading payment options...</Text>
                </View>
              ) : (
                <View style={styles.paymentOptions}>
                  {paymentOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.paymentOption,
                        selectedPayment === option.id && styles.paymentOptionSelected,
                        !option.available && styles.paymentOptionDisabled,
                      ]}
                      onPress={() => option.available && setSelectedPayment(option.id)}
                      disabled={!option.available || loading}>
                      <View style={styles.paymentOptionLeft}>
                        <View
                          style={[
                            styles.iconContainer,
                            selectedPayment === option.id && styles.iconContainerSelected,
                          ]}>
                          <option.icon
                            size={24}
                            color={selectedPayment === option.id ? '#10b981' : '#6b7280'}
                          />
                        </View>
                        <View style={styles.paymentOptionText}>
                          <View style={styles.paymentTitleRow}>
                            <Text
                              style={[
                                styles.paymentTitle,
                                !option.available && styles.paymentTitleDisabled,
                              ]}>
                              {option.title}
                            </Text>
                            {option.badge && (
                              <View
                                style={[
                                  styles.badge,
                                  !option.available && styles.badgeWarning,
                                ]}>
                                <Text
                                  style={[
                                    styles.badgeText,
                                    !option.available && styles.badgeTextWarning,
                                  ]}>
                                  {option.badge}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.paymentDescription,
                              !option.available && styles.paymentDescriptionDisabled,
                            ]}>
                            {option.description}
                          </Text>
                        </View>
                      </View>
                      {selectedPayment === option.id && option.available && (
                        <CheckCircle2 size={24} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                {walletService.formatCurrency(pricing.finalPrice)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
              onPress={handleConfirmPayment}
              disabled={loading || loadingBalance}>
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm & Place Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  paymentOptions: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  paymentOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  paymentOptionDisabled: {
    opacity: 0.5,
    backgroundColor: '#f9fafb',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerSelected: {
    backgroundColor: '#d1fae5',
  },
  paymentOptionText: {
    flex: 1,
    gap: 4,
  },
  paymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  paymentTitleDisabled: {
    color: '#9ca3af',
  },
  paymentDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentDescriptionDisabled: {
    color: '#9ca3af',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
  },
  badgeTextWarning: {
    color: '#92400e',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10b981',
  },
  confirmButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
