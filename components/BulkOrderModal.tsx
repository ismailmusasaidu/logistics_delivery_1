import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform } from 'react-native';
import { X, Plus, Trash2, Package, MapPin, User, Phone } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type DeliveryItem = {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  packageDescription: string;
  packageWeight: string;
  notes: string;
};

type Department = {
  id: string;
  name: string;
  code: string;
};

type BulkOrderModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId?: string;
  companyId?: string;
  departments?: Department[];
};

export default function BulkOrderModal({ visible, onClose, onSuccess, customerId, companyId, departments }: BulkOrderModalProps) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([
    {
      id: '1',
      pickupAddress: '',
      deliveryAddress: '',
      recipientName: '',
      recipientPhone: '',
      packageDescription: '',
      packageWeight: '',
      notes: '',
    },
  ]);
  const [bulkNotes, setBulkNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDelivery = () => {
    const newId = (deliveries.length + 1).toString();
    setDeliveries([
      ...deliveries,
      {
        id: newId,
        pickupAddress: '',
        deliveryAddress: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        packageWeight: '',
        notes: '',
      },
    ]);
  };

  const removeDelivery = (id: string) => {
    if (deliveries.length > 1) {
      setDeliveries(deliveries.filter(d => d.id !== id));
    }
  };

  const updateDelivery = (id: string, field: keyof DeliveryItem, value: string) => {
    setDeliveries(deliveries.map(d => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const calculateDiscount = (count: number): number => {
    if (count >= 11) return 15;
    if (count >= 6) return 10;
    if (count >= 3) return 5;
    return 0;
  };

  const validateDeliveries = (): boolean => {
    for (const delivery of deliveries) {
      if (
        !delivery.pickupAddress.trim() ||
        !delivery.deliveryAddress.trim() ||
        !delivery.recipientName.trim() ||
        !delivery.recipientPhone.trim() ||
        !delivery.packageDescription.trim()
      ) {
        setError('Please fill in all required fields for each delivery');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!validateDeliveries()) {
      return;
    }

    if (deliveries.length < 2) {
      setError('Bulk orders must have at least 2 deliveries');
      return;
    }

    setLoading(true);

    try {
      const baseDeliveryFee = 10;
      const totalFee = deliveries.length * baseDeliveryFee;
      const discountPercentage = calculateDiscount(deliveries.length);
      const finalFee = totalFee * (1 - discountPercentage / 100);

      const { data: bulkOrder, error: bulkError } = await supabase
        .from('bulk_orders')
        .insert({
          customer_id: customerId,
          bulk_order_number: '',
          total_orders: deliveries.length,
          total_fee: totalFee,
          discount_percentage: discountPercentage,
          final_fee: finalFee,
          status: 'pending',
          notes: bulkNotes || null,
        })
        .select()
        .single();

      if (bulkError) throw bulkError;

      const orderInserts = deliveries.map(delivery => ({
        customer_id: customerId,
        bulk_order_id: bulkOrder.id,
        order_number: '',
        status: 'pending',
        pickup_address: delivery.pickupAddress,
        pickup_lat: 0,
        pickup_lng: 0,
        delivery_address: delivery.deliveryAddress,
        delivery_lat: 0,
        delivery_lng: 0,
        recipient_name: delivery.recipientName,
        recipient_phone: delivery.recipientPhone,
        package_description: delivery.packageDescription,
        package_weight: delivery.packageWeight ? parseFloat(delivery.packageWeight) : null,
        delivery_fee: baseDeliveryFee,
        notes: delivery.notes || null,
      }));

      const { error: ordersError } = await supabase.from('orders').insert(orderInserts);

      if (ordersError) throw ordersError;

      if (Platform.OS === 'web') {
        alert(`Bulk order created successfully! ${discountPercentage}% discount applied.`);
      }

      setDeliveries([
        {
          id: '1',
          pickupAddress: '',
          deliveryAddress: '',
          recipientName: '',
          recipientPhone: '',
          packageDescription: '',
          packageWeight: '',
          notes: '',
        },
      ]);
      setBulkNotes('');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating bulk order:', error);
      setError(error.message || 'Failed to create bulk order');
    } finally {
      setLoading(false);
    }
  };

  const totalCount = deliveries.length;
  const discount = calculateDiscount(totalCount);
  const baseFee = 10;
  const totalFee = totalCount * baseFee;
  const finalFee = totalFee * (1 - discount / 100);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Bulk Order</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Deliveries:</Text>
              <Text style={styles.summaryValue}>{totalCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base Fee:</Text>
              <Text style={styles.summaryValue}>₦{totalFee.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount ({discount}%):</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-₦{(totalFee - finalFee).toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Final Fee:</Text>
              <Text style={styles.totalValue}>₦{finalFee.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.scrollContainer}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {deliveries.map((delivery, index) => (
              <View key={delivery.id} style={styles.deliveryCard}>
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryTitle}>Delivery #{index + 1}</Text>
                  {deliveries.length > 1 && (
                    <TouchableOpacity onPress={() => removeDelivery(delivery.id)} style={styles.removeButton}>
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pickup Address *</Text>
                  <View style={styles.inputWithIcon}>
                    <MapPin size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="123 Main St, City"
                      value={delivery.pickupAddress}
                      onChangeText={text => updateDelivery(delivery.id, 'pickupAddress', text)}
                      multiline
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Delivery Address *</Text>
                  <View style={styles.inputWithIcon}>
                    <MapPin size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="456 Elm St, City"
                      value={delivery.deliveryAddress}
                      onChangeText={text => updateDelivery(delivery.id, 'deliveryAddress', text)}
                      multiline
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Recipient Name *</Text>
                  <View style={styles.inputWithIcon}>
                    <User size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      value={delivery.recipientName}
                      onChangeText={text => updateDelivery(delivery.id, 'recipientName', text)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Recipient Phone *</Text>
                  <View style={styles.inputWithIcon}>
                    <Phone size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="+1 234 567 8900"
                      value={delivery.recipientPhone}
                      onChangeText={text => updateDelivery(delivery.id, 'recipientPhone', text)}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Package Description *</Text>
                  <View style={styles.inputWithIcon}>
                    <Package size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="Documents, Electronics, etc."
                      value={delivery.packageDescription}
                      onChangeText={text => updateDelivery(delivery.id, 'packageDescription', text)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Package Weight (kg)</Text>
                  <TextInput
                    style={styles.inputSimple}
                    placeholder="5.0"
                    value={delivery.packageWeight}
                    onChangeText={text => updateDelivery(delivery.id, 'packageWeight', text)}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.inputSimple, styles.textArea]}
                    placeholder="Special instructions..."
                    value={delivery.notes}
                    onChangeText={text => updateDelivery(delivery.id, 'notes', text)}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={addDelivery}>
              <Plus size={20} color="#10b981" />
              <Text style={styles.addButtonText}>Add Another Delivery</Text>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bulk Order Notes</Text>
              <TextInput
                style={[styles.inputSimple, styles.textArea]}
                placeholder="Overall notes for this bulk order..."
                value={bulkNotes}
                onChangeText={setBulkNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              <Text style={styles.submitButtonText}>{loading ? 'Creating...' : 'Create Bulk Order'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '95%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    margin: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  discountText: {
    color: '#10b981',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  deliveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  removeButton: {
    padding: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    minHeight: 40,
  },
  inputSimple: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
