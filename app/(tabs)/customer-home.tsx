import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Platform, Linking, ActivityIndicator } from 'react-native';
import { Package, MapPin, Clock, Plus, X, User, Phone, ChevronDown, ChevronUp, Layers, Navigation } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Order, OrderTracking } from '@/lib/supabase';
import BulkOrderModal from '@/components/BulkOrderModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { PricingBreakdown } from '@/components/PricingBreakdown';
import { pricingCalculator, PricingBreakdown as PricingBreakdownType, Promotion } from '@/lib/pricingCalculator';
import { calculateDistanceBetweenAddresses, Coordinates } from '@/lib/geocoding';
import { PaymentMethod, walletService } from '@/lib/wallet';

export default function CustomerHome() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [orderTracking, setOrderTracking] = useState<Record<string, OrderTracking[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [newOrder, setNewOrder] = useState({
    pickupAddress: '',
    deliveryAddress: '',
    recipientName: '',
    recipientPhone: '',
    packageDescription: '',
    orderTypes: [] as string[],
    promoCode: '',
  });
  const [orderCoordinates, setOrderCoordinates] = useState<{
    pickup: Coordinates | null;
    delivery: Coordinates | null;
    distance: number | null;
  }>({
    pickup: null,
    delivery: null,
    distance: null,
  });
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdownType | null>(null);
  const [validatedPromo, setValidatedPromo] = useState<Promotion | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);

  const orderTypeOptions = ['Groceries', 'Medicine', 'Bulk / Heavy Items', 'Express Delivery'];

  useEffect(() => {
    pricingCalculator.initialize();
    loadOrders();

    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${profile?.id}`,
        },
        (payload) => {
          console.log('Order change detected:', payload);
          loadOrders();
        }
      )
      .subscribe();

    const trackingChannel = supabase
      .channel('customer-tracking-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_tracking',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTracking = payload.new as OrderTracking;
            setOrderTracking(prev => ({
              ...prev,
              [newTracking.order_id]: [
                ...(prev[newTracking.order_id] || []),
                newTracking
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(trackingChannel);
    };
  }, [profile?.id]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Loaded orders:', data);
      console.log('Orders with rider info:', data?.filter(o => o.rider_name || o.rider_phone));
      setOrders(data || []);

      if (data && data.length > 0) {
        const orderIds = data.map(o => o.id);
        const { data: trackingData } = await supabase
          .from('order_tracking')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false });

        if (trackingData) {
          const trackingByOrder: Record<string, OrderTracking[]> = {};
          trackingData.forEach((tracking) => {
            if (!trackingByOrder[tracking.order_id]) {
              trackingByOrder[tracking.order_id] = [];
            }
            trackingByOrder[tracking.order_id].push(tracking);
          });
          setOrderTracking(trackingByOrder);
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const calculateDistanceAndPricing = useCallback(async () => {
    if (!newOrder.pickupAddress || !newOrder.deliveryAddress) {
      setOrderCoordinates({ pickup: null, delivery: null, distance: null });
      setPricingBreakdown(null);
      setGeocodingError(null);
      return;
    }

    if (newOrder.pickupAddress.length < 5 || newOrder.deliveryAddress.length < 5) {
      return;
    }

    setCalculatingDistance(true);
    setGeocodingError(null);

    try {
      const result = await calculateDistanceBetweenAddresses(
        newOrder.pickupAddress,
        newOrder.deliveryAddress
      );

      if (!result) {
        setGeocodingError('Unable to find addresses. Please check and try again.');
        setOrderCoordinates({ pickup: null, delivery: null, distance: null });
        setPricingBreakdown(null);
        return;
      }

      setOrderCoordinates({
        pickup: result.pickupCoords,
        delivery: result.deliveryCoords,
        distance: result.distance,
      });

      await pricingCalculator.initialize();

      let promo: Promotion | null = null;
      if (newOrder.promoCode.trim()) {
        promo = await pricingCalculator.validatePromoCode(
          newOrder.promoCode.trim(),
          profile?.id || '',
          0
        );
        setValidatedPromo(promo);
      } else {
        setValidatedPromo(null);
      }

      const breakdown = pricingCalculator.calculateDeliveryPrice(
        result.distance,
        newOrder.orderTypes,
        0,
        promo
      );

      setPricingBreakdown(breakdown);
      setGeocodingError(null);
    } catch (error: any) {
      console.error('Error calculating distance and pricing:', error);
      setGeocodingError(error.message || 'Failed to calculate distance');
      setPricingBreakdown(null);
      setOrderCoordinates({ pickup: null, delivery: null, distance: null });
    } finally {
      setCalculatingDistance(false);
    }
  }, [newOrder.pickupAddress, newOrder.deliveryAddress, newOrder.orderTypes, newOrder.promoCode, profile?.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateDistanceAndPricing();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [calculateDistanceAndPricing]);

  const toggleOrderType = (type: string) => {
    setNewOrder(prev => {
      const types = prev.orderTypes.includes(type)
        ? prev.orderTypes.filter(t => t !== type)
        : [...prev.orderTypes, type];
      return { ...prev, orderTypes: types };
    });
  };

  const proceedToCheckout = () => {
    if (!newOrder.pickupAddress || !newOrder.deliveryAddress || !newOrder.recipientName || !newOrder.recipientPhone || !newOrder.packageDescription) {
      if (Platform.OS === 'web') {
        alert('Please fill in all fields');
      }
      return;
    }

    if (!pricingBreakdown) {
      if (Platform.OS === 'web') {
        alert('Please wait for pricing to be calculated');
      }
      return;
    }

    setCheckoutModalVisible(true);
  };

  const createOrderWithPayment = async (paymentMethod: PaymentMethod) => {
    if (!pricingBreakdown || !profile?.id) {
      throw new Error('Missing required information');
    }

    try {
      const orderNumber = `ORD-${Date.now()}`;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.id,
          order_number: orderNumber,
          pickup_address: newOrder.pickupAddress,
          pickup_lat: orderCoordinates.pickup?.lat || 0,
          pickup_lng: orderCoordinates.pickup?.lng || 0,
          delivery_address: newOrder.deliveryAddress,
          delivery_lat: orderCoordinates.delivery?.lat || 0,
          delivery_lng: orderCoordinates.delivery?.lng || 0,
          recipient_name: newOrder.recipientName,
          recipient_phone: newOrder.recipientPhone,
          package_description: newOrder.packageDescription,
          delivery_fee: pricingBreakdown.finalPrice,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash' ? 'pending' : 'pending',
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      if (paymentMethod === 'wallet') {
        const success = await walletService.processWalletPayment(
          profile.id,
          pricingBreakdown.finalPrice,
          orderData.id,
          orderNumber
        );

        if (!success) {
          await supabase.from('orders').delete().eq('id', orderData.id);
          throw new Error('Insufficient wallet balance');
        }
      }

      if (validatedPromo) {
        await pricingCalculator.incrementPromoUsage(validatedPromo.promo_code);
      }

      if (Platform.OS === 'web') {
        const paymentMsg = paymentMethod === 'wallet'
          ? 'Order placed and paid via wallet!'
          : paymentMethod === 'online'
          ? 'Order placed! Complete payment to confirm.'
          : 'Order placed! Pay cash on delivery.';
        alert(paymentMsg);
      }

      setModalVisible(false);
      setCheckoutModalVisible(false);
      setNewOrder({
        pickupAddress: '',
        deliveryAddress: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        orderTypes: [],
        promoCode: '',
      });
      setOrderCoordinates({ pickup: null, delivery: null, distance: null });
      setPricingBreakdown(null);
      setValidatedPromo(null);
      setGeocodingError(null);
      loadOrders();
    } catch (error: any) {
      console.error('Order creation error:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      assigned: '#8b5cf6',
      picked_up: '#6366f1',
      in_transit: '#06b6d4',
      delivered: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const formatTrackingTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Track your deliveries</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.bulkButton} onPress={() => setBulkModalVisible(true)}>
            <Layers size={20} color="#10b981" />
            <Text style={styles.bulkButtonText}>Bulk</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />}>

        <View style={styles.statsContainer}>
          <View  style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'in_transit').length}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
          </View>
          <View  style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'delivered').length}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View  style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Orders</Text>

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>Create your first delivery order</Text>
          </View>
        ) : (
          orders.map((order, index) => (
            <View key={order.id} >
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                  </View>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.addressRow}>
                    <MapPin size={20} color="#10b981" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Pickup</Text>
                      <Text style={styles.addressText}>{order.pickup_address}</Text>
                    </View>
                  </View>

                  <View style={styles.addressRow}>
                    <MapPin size={20} color="#ef4444" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Delivery</Text>
                      <Text style={styles.addressText}>{order.delivery_address}</Text>
                    </View>
                  </View>

                  {(order.rider_name && order.rider_phone) ? (
                    <View style={styles.riderInfo}>
                      <View style={styles.riderHeader}>
                        <User size={16} color="#10b981" />
                        <Text style={styles.riderLabel}>Assigned Rider</Text>
                      </View>
                      <View style={styles.riderDetails}>
                        <View style={styles.riderDetail}>
                          <Text style={styles.riderName}>{order.rider_name}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() => handleCall(order.rider_phone!)}>
                          <Phone size={16} color="#10b981" />
                          <Text style={styles.callButtonText}>{order.rider_phone}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    console.log('No rider info for order:', order.order_number, 'rider_name:', order.rider_name, 'rider_phone:', order.rider_phone),
                    null
                  )}
                </View>

                {orderTracking[order.id] && orderTracking[order.id].length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.trackingToggle}
                      onPress={() => toggleOrderExpanded(order.id)}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.trackingToggleText}>
                        Tracking History ({orderTracking[order.id]?.length || 0})
                      </Text>
                      {expandedOrders.has(order.id) ? (
                        <ChevronUp size={16} color="#6b7280" />
                      ) : (
                        <ChevronDown size={16} color="#6b7280" />
                      )}
                    </TouchableOpacity>

                    {expandedOrders.has(order.id) && (
                      <View style={styles.trackingTimeline}>
                        {orderTracking[order.id].map((tracking, idx) => (
                          <View key={tracking.id} style={styles.trackingItem}>
                            <View style={styles.trackingDot} />
                            {idx < orderTracking[order.id].length - 1 && (
                              <View style={styles.trackingLine} />
                            )}
                            <View style={styles.trackingContent}>
                              <View style={styles.trackingHeader}>
                                <Text style={styles.trackingStatus}>
                                  {getStatusLabel(tracking.status)}
                                </Text>
                                <Text style={styles.trackingTime}>
                                  {formatTrackingTime(tracking.created_at)}
                                </Text>
                              </View>
                              {tracking.notes && (
                                <Text style={styles.trackingNotes}>{tracking.notes}</Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <View style={styles.orderDetails}>
                  <View style={styles.orderFooter}>
                    <View style={styles.timeInfo}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeText}>{new Date(order.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.feeText}>₦{order.delivery_fee.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Order</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pickup Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123 Main St"
                  value={newOrder.pickupAddress}
                  onChangeText={(text) => setNewOrder({ ...newOrder, pickupAddress: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="456 Oak Ave"
                  value={newOrder.deliveryAddress}
                  onChangeText={(text) => setNewOrder({ ...newOrder, deliveryAddress: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={newOrder.recipientName}
                  onChangeText={(text) => setNewOrder({ ...newOrder, recipientName: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 234 567 8900"
                  value={newOrder.recipientPhone}
                  onChangeText={(text) => setNewOrder({ ...newOrder, recipientPhone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Package Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your package"
                  value={newOrder.packageDescription}
                  onChangeText={(text) => setNewOrder({ ...newOrder, packageDescription: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {(newOrder.pickupAddress && newOrder.deliveryAddress) && (
                <View style={styles.distanceDisplayContainer}>
                  <View style={styles.distanceHeader}>
                    <Navigation size={20} color="#10b981" />
                    <Text style={styles.distanceTitle}>Delivery Distance</Text>
                  </View>
                  {calculatingDistance ? (
                    <View style={styles.calculatingContainer}>
                      <ActivityIndicator size="small" color="#10b981" />
                      <Text style={styles.calculatingText}>Calculating distance...</Text>
                    </View>
                  ) : geocodingError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{geocodingError}</Text>
                    </View>
                  ) : orderCoordinates.distance !== null ? (
                    <View style={styles.distanceValueContainer}>
                      <Text style={styles.distanceValue}>{orderCoordinates.distance} km</Text>
                      <Text style={styles.distanceHint}>Distance calculated automatically</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order Type (Optional)</Text>
                <View style={styles.orderTypesContainer}>
                  {orderTypeOptions.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.orderTypeChip,
                        newOrder.orderTypes.includes(type) && styles.orderTypeChipActive,
                      ]}
                      onPress={() => toggleOrderType(type)}>
                      <Text
                        style={[
                          styles.orderTypeChipText,
                          newOrder.orderTypes.includes(type) && styles.orderTypeChipTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Promo Code (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter promo code"
                  value={newOrder.promoCode}
                  onChangeText={(text) => setNewOrder({ ...newOrder, promoCode: text.toUpperCase() })}
                  autoCapitalize="characters"
                />
                {validatedPromo && (
                  <Text style={styles.promoSuccess}>✓ {validatedPromo.promo_name} applied!</Text>
                )}
                {newOrder.promoCode && !validatedPromo && pricingBreakdown && !calculatingDistance && (
                  <Text style={styles.promoError}>Invalid or expired promo code</Text>
                )}
              </View>

              {pricingBreakdown && (
                <View style={styles.breakdownContainer}>
                  <PricingBreakdown breakdown={pricingBreakdown} />
                </View>
              )}

              <TouchableOpacity
                style={[styles.createButton, !pricingBreakdown && styles.createButtonDisabled]}
                onPress={proceedToCheckout}
                disabled={!pricingBreakdown}>
                <Text style={styles.createButtonText}>
                  {pricingBreakdown ? `Proceed to Checkout - ₦${pricingBreakdown.finalPrice.toFixed(2)}` : 'Calculate Price First'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {pricingBreakdown && (
        <CheckoutModal
          visible={checkoutModalVisible}
          onClose={() => setCheckoutModalVisible(false)}
          onConfirm={createOrderWithPayment}
          pricing={pricingBreakdown}
          userId={profile?.id || ''}
        />
      )}

      <BulkOrderModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onSuccess={() => {
          loadOrders();
          setBulkModalVisible(false);
        }}
        customerId={profile?.id || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subGreeting: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#10b981',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  orderDetails: {
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  feeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  riderInfo: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  riderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  riderDetails: {
    gap: 8,
  },
  riderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  callButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  trackingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    marginTop: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  trackingToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  trackingTimeline: {
    marginTop: 16,
    paddingLeft: 8,
    paddingBottom: 8,
  },
  trackingItem: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 16,
  },
  trackingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    marginTop: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trackingLine: {
    position: 'absolute',
    left: 5.5,
    top: 16,
    width: 1,
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  trackingContent: {
    flex: 1,
    marginLeft: 12,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  trackingStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  trackingTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  trackingNotes: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  bulkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  distanceDisplayContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  distanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculatingText: {
    fontSize: 14,
    color: '#6b7280',
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
  distanceValueContainer: {
    gap: 4,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10b981',
  },
  distanceHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
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
  promoSuccess: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 4,
  },
  promoError: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 4,
  },
  breakdownContainer: {
    marginBottom: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
});
