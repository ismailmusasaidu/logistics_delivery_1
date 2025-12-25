import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform, ActivityIndicator } from 'react-native';
import { X, Plus, Trash2, Package, MapPin, User, Phone, Navigation } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { calculateDistanceBetweenAddresses, Coordinates } from '@/lib/geocoding';
import { pricingCalculator } from '@/lib/pricingCalculator';

type DeliveryItem = {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  packageDescription: string;
  packageWeight: string;
  notes: string;
  orderTypes: string[];
  distance?: number;
  price?: number;
  pickupCoords?: Coordinates;
  deliveryCoords?: Coordinates;
  calculating?: boolean;
  error?: string;
};

type BulkOrderModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId?: string;
};

export default function BulkOrderModal({ visible, onClose, onSuccess, customerId }: BulkOrderModalProps) {
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
      orderTypes: [],
    },
  ]);
  const [bulkNotes, setBulkNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderTypeOptions = ['Groceries', 'Medicine', 'Express Delivery'];

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
        orderTypes: [],
      },
    ]);
  };

  const removeDelivery = (id: string) => {
    if (deliveries.length > 1) {
      setDeliveries(deliveries.filter(d => d.id !== id));
    }
  };

  const updateDelivery = (id: string, field: keyof DeliveryItem, value: string) => {
    setDeliveries(deliveries.map(d => (d.id === id ? { ...d, [field]: value, distance: undefined, price: undefined } : d)));
  };

  const toggleOrderType = (deliveryId: string, type: string) => {
    setDeliveries(deliveries.map(d => {
      if (d.id === deliveryId) {
        const types = d.orderTypes.includes(type)
          ? d.orderTypes.filter(t => t !== type)
          : [...d.orderTypes, type];
        return { ...d, orderTypes: types, distance: undefined, price: undefined };
      }
      return d;
    }));
  };

  useEffect(() => {
    pricingCalculator.initialize();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateAllDistances();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [deliveries.map(d => `${d.pickupAddress}-${d.deliveryAddress}-${d.orderTypes.join(',')}`).join('|')]);

  const calculateAllDistances = async () => {
    const updatedDeliveries = await Promise.all(
      deliveries.map(async (delivery) => {
        if (!delivery.pickupAddress || !delivery.deliveryAddress) {
          return { ...delivery, distance: undefined, price: undefined, calculating: false, error: undefined };
        }

        if (delivery.pickupAddress.length < 5 || delivery.deliveryAddress.length < 5) {
          return delivery;
        }

        if (delivery.distance !== undefined) {
          return delivery;
        }

        try {
          const updated = { ...delivery, calculating: true, error: undefined };
          setDeliveries(prev => prev.map(d => d.id === delivery.id ? updated : d));

          const result = await calculateDistanceBetweenAddresses(
            delivery.pickupAddress,
            delivery.deliveryAddress
          );

          if (!result) {
            return {
              ...delivery,
              calculating: false,
              error: 'Unable to calculate distance',
              distance: undefined,
              price: undefined,
            };
          }

          await pricingCalculator.initialize();
          const breakdown = pricingCalculator.calculateDeliveryPrice(result.distance, delivery.orderTypes, 0, null);

          return {
            ...delivery,
            distance: result.distance,
            price: breakdown.finalPrice,
            pickupCoords: result.pickupCoords,
            deliveryCoords: result.deliveryCoords,
            calculating: false,
            error: undefined,
          };
        } catch (error: any) {
          console.error('Error calculating distance:', error);
          return {
            ...delivery,
            calculating: false,
            error: error.message || 'Failed to calculate',
            distance: undefined,
            price: undefined,
          };
        }
      })
    );

    setDeliveries(updatedDeliveries);
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

      if (delivery.calculating) {
        setError('Please wait for distance calculations to complete');
        return false;
      }

      if (!delivery.distance || !delivery.price) {
        setError('Unable to calculate pricing. Please check addresses');
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
      const totalFee = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
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
        pickup_lat: delivery.pickupCoords?.lat || 0,
        pickup_lng: delivery.pickupCoords?.lng || 0,
        delivery_address: delivery.deliveryAddress,
        delivery_lat: delivery.deliveryCoords?.lat || 0,
        delivery_lng: delivery.deliveryCoords?.lng || 0,
        recipient_name: delivery.recipientName,
        recipient_phone: delivery.recipientPhone,
        package_description: delivery.packageDescription,
        package_weight: delivery.packageWeight ? parseFloat(delivery.packageWeight) : null,
        delivery_fee: delivery.price || 0,
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
          orderTypes: [],
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
  const totalFee = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  const finalFee = totalFee * (1 - discount / 100);
  const allCalculated = deliveries.every(d => d.price !== undefined);
  const anyCalculating = deliveries.some(d => d.calculating);

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

                {(delivery.pickupAddress && delivery.deliveryAddress) && (
                  <View style={styles.distanceCard}>
                    <View style={styles.distanceHeader}>
                      <Navigation size={16} color="#10b981" />
                      <Text style={styles.distanceTitle}>Distance & Pricing</Text>
                    </View>
                    {delivery.calculating ? (
                      <View style={styles.calculatingContainer}>
                        <ActivityIndicator size="small" color="#10b981" />
                        <Text style={styles.calculatingText}>Calculating...</Text>
                      </View>
                    ) : delivery.error ? (
                      <View style={styles.distanceError}>
                        <Text style={styles.distanceErrorText}>{delivery.error}</Text>
                      </View>
                    ) : delivery.distance && delivery.price ? (
                      <View style={styles.distanceValues}>
                        <View style={styles.distanceRow}>
                          <Text style={styles.distanceLabel}>Distance:</Text>
                          <Text style={styles.distanceValue}>{delivery.distance} km</Text>
                        </View>
                        <View style={styles.distanceRow}>
                          <Text style={styles.distanceLabel}>Price:</Text>
                          <Text style={styles.priceValue}>₦{delivery.price.toFixed(2)}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}

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
                  <Text style={styles.label}>Order Type (Optional)</Text>
                  <View style={styles.orderTypesContainer}>
                    {orderTypeOptions.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.orderTypeChip,
                          delivery.orderTypes.includes(type) && styles.orderTypeChipActive,
                        ]}
                        onPress={() => toggleOrderType(delivery.id, type)}>
                        <Text
                          style={[
                            styles.orderTypeChipText,
                            delivery.orderTypes.includes(type) && styles.orderTypeChipTextActive,
                          ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
              style={[styles.submitButton, (loading || !allCalculated || anyCalculating) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || !allCalculated || anyCalculating}>
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : anyCalculating ? 'Calculating...' : !allCalculated ? 'Enter Addresses' : 'Create Bulk Order'}
              </Text>
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
  distanceCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  distanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculatingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  distanceError: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
  },
  distanceErrorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  distanceValues: {
    gap: 6,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  distanceValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '700',
  },
  orderTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  orderTypeChipActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  orderTypeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  orderTypeChipTextActive: {
    color: '#10b981',
  },
});
