import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Modal, TextInput } from 'react-native';
import { Bike, MapPin, Package, CheckCircle, Navigation, AlertCircle, X, MessageSquare, Clock, ChevronDown, ChevronUp, User, Layers } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Order, Rider, OrderTracking } from '@/lib/supabase';

export default function RiderHome() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riderData, setRiderData] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complaintModalVisible, setComplaintModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [complaintType, setComplaintType] = useState<string>('customer_issue');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [orderTracking, setOrderTracking] = useState<Record<string, OrderTracking[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.id) {
      loadRiderData();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (riderData?.id) {
      loadOrders();

      const ordersSubscription = supabase
        .channel('rider-orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `rider_id=eq.${riderData.id}`,
          },
          () => {
            loadOrders();
          }
        )
        .subscribe();

      const trackingSubscription = supabase
        .channel('order-tracking-updates')
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
        ordersSubscription.unsubscribe();
        trackingSubscription.unsubscribe();
      };
    }
  }, [riderData?.id]);

  const loadRiderData = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('user_id', profile?.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Rider profile not found. Please contact admin.');
      } else {
        setRiderData(data);

        if (data.approval_status === 'rejected') {
          setError(`Your rider application was rejected. Reason: ${data.rejection_reason || 'No reason provided.'}`);
        }
      }
    } catch (error: any) {
      console.error('Error loading rider data:', error);
      setError(error.message || 'Failed to load rider data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      let riderId = riderData?.id;

      if (!riderId) {
        const { data: rData } = await supabase
          .from('riders')
          .select('id')
          .eq('user_id', profile?.id)
          .maybeSingle();

        if (rData) {
          riderId = rData.id;
        }
      }

      if (riderId) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            customer:profiles!orders_customer_id_fkey(id, full_name, email, phone),
            bulk_order:bulk_orders(
              id,
              bulk_order_number,
              total_orders,
              discount_percentage,
              status
            )
          `)
          .eq('rider_id', riderId)
          .order('created_at', { ascending: false });

        if (error) throw error;
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
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, note?: string) => {
    try {
      setError(null);
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {})
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: newStatus,
        notes: note || `Order ${newStatus.replace('_', ' ')}`,
      });

      if (trackingError) {
        console.error('Tracking insert error:', trackingError);
        throw trackingError;
      }

      loadOrders();
      setStatusModalVisible(false);
      setStatusNote('');
    } catch (error: any) {
      console.error('Error updating order:', error);
      setError(error.message || 'Failed to update order status');
    }
  };

  const openStatusModal = (order: Order) => {
    setSelectedOrder(order);
    setStatusNote('');
    setStatusModalVisible(true);
  };

  const openComplaintModal = (order: Order) => {
    setSelectedOrder(order);
    setComplaintType('customer_issue');
    setComplaintDescription('');
    setComplaintModalVisible(true);
  };

  const submitComplaint = async () => {
    if (!selectedOrder || !riderData || !complaintDescription.trim()) {
      setError('Please provide a complaint description');
      return;
    }

    try {
      setError(null);
      const { error } = await supabase.from('order_complaints').insert({
        order_id: selectedOrder.id,
        rider_id: riderData.id,
        complaint_type: complaintType,
        description: complaintDescription.trim(),
      });

      if (error) throw error;

      setComplaintModalVisible(false);
      setComplaintDescription('');
      if (Platform.OS === 'web') {
        alert('Complaint submitted successfully');
      }
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      setError(error.message || 'Failed to submit complaint');
    }
  };

  const toggleStatus = async () => {
    if (!riderData) {
      setError('Rider data not loaded. Please refresh the page.');
      return;
    }

    const newStatus = riderData.status === 'available' ? 'offline' : 'available';
    try {
      setError(null);
      const { error } = await supabase
        .from('riders')
        .update({ status: newStatus })
        .eq('id', riderData.id);

      if (error) throw error;
      setRiderData({ ...riderData, status: newStatus });
    } catch (error: any) {
      console.error('Error toggling status:', error);
      setError(error.message || 'Failed to update status');
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

  const getNextAction = (status: string) => {
    const actions: Record<string, string> = {
      confirmed: 'assigned',
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
    };
    return actions[status];
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

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'delivered');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Manage your deliveries</Text>
        </View>
        <TouchableOpacity
          style={[styles.statusButton, riderData?.status === 'available' && styles.statusButtonActive]}
          onPress={toggleStatus}>
          <Text style={[styles.statusText, riderData?.status === 'available' && styles.statusTextActive]}>
            {riderData?.status === 'available' ? 'Available' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {riderData?.approval_status === 'pending' ? (
        <View style={styles.pendingContainer}>
          <Clock size={64} color="#f59e0b" />
          <Text style={styles.pendingTitle}>Application Under Review</Text>
          <Text style={styles.pendingText}>
            Your rider application is currently being reviewed by our admin team. You will be notified once your application is approved.
          </Text>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingInfoLabel}>What happens next?</Text>
            <Text style={styles.pendingInfoText}>• Admin will review your documents</Text>
            <Text style={styles.pendingInfoText}>• Verification typically takes 24-48 hours</Text>
            <Text style={styles.pendingInfoText}>• You'll receive an email notification</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRiderData(); loadOrders(); }} />}>

          <View style={styles.statsContainer}>
          <View  style={styles.statCard}>
            <Bike size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{riderData?.total_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          <View  style={styles.statCard}>
            <Package size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>{activeOrders.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View  style={styles.statCard}>
            <CheckCircle size={28} color="#10b981" />
            <Text style={styles.statNumber}>{riderData?.rating?.toFixed(1) || '5.0'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Deliveries</Text>

        {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Bike size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No active deliveries</Text>
            <Text style={styles.emptySubtext}>You'll see assigned deliveries here</Text>
          </View>
        ) : (
          activeOrders.map((order, index) => (
            <View key={order.id} >
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                  </View>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                </View>

                {(order as any).bulk_order && (
                  <View style={styles.bulkBadge}>
                    <Layers size={14} color="#8b5cf6" />
                    <Text style={styles.bulkBadgeText}>
                      BULK ORDER ({(order as any).bulk_order.total_orders} items)
                    </Text>
                  </View>
                )}

                {(order as any).customer && (
                  <View style={styles.customerInfo}>
                    <User size={16} color="#6b7280" />
                    <View style={styles.customerDetails}>
                      <Text style={styles.customerName}>{(order as any).customer.full_name || 'Unknown'}</Text>
                      <Text style={styles.customerContact}>
                        {(order as any).customer.phone || (order as any).customer.email || 'No contact'}
                      </Text>
                    </View>
                  </View>
                )}

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
                      <Text style={styles.addressLabel}>Delivery to {order.recipient_name}</Text>
                      <Text style={styles.addressText}>{order.delivery_address}</Text>
                      <Text style={styles.phoneText}>{order.recipient_phone}</Text>
                    </View>
                  </View>

                  <View style={styles.packageInfo}>
                    <Package size={16} color="#6b7280" />
                    <Text style={styles.packageText}>{order.package_description}</Text>
                  </View>
                </View>

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

                {expandedOrders.has(order.id) && orderTracking[order.id] && (
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

                <View style={styles.orderActions}>
                  {getNextAction(order.status) && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openStatusModal(order)}>
                      <Navigation size={20} color="#ffffff" />
                      <Text style={styles.actionButtonText}>
                        Mark as {getStatusLabel(getNextAction(order.status))}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.complaintButton}
                    onPress={() => openComplaintModal(order)}>
                    <AlertCircle size={18} color="#ef4444" />
                    <Text style={styles.complaintButtonText}>Report Issue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        {completedOrders.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Completed</Text>
            {completedOrders.slice(0, 5).map((order, index) => (
              <View key={order.id} >
                <View style={styles.completedCard}>
                  <View style={styles.completedHeader}>
                    <Text style={styles.completedNumber}>{order.order_number}</Text>
                    <Text style={styles.completedFee}>₦{order.delivery_fee.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.completedAddress}>{order.delivery_address}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      )}

      <Modal
        visible={statusModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order Status</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Order: {selectedOrder?.order_number}
              </Text>
              <Text style={styles.modalInfo}>
                Status will be updated to: {selectedOrder && getStatusLabel(getNextAction(selectedOrder.status))}
              </Text>

              <Text style={styles.label}>Add Note (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={statusNote}
                onChangeText={setStatusNote}
                placeholder="Add any notes about this status update"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setStatusModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => selectedOrder && updateOrderStatus(selectedOrder.id, getNextAction(selectedOrder.status), statusNote)}>
                <Text style={styles.confirmButtonText}>Update Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={complaintModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setComplaintModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <TouchableOpacity onPress={() => setComplaintModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Order: {selectedOrder?.order_number}
              </Text>

              <Text style={styles.label}>Issue Type</Text>
              <View style={styles.complaintTypes}>
                {[
                  { value: 'customer_issue', label: 'Customer Issue' },
                  { value: 'address_problem', label: 'Address Problem' },
                  { value: 'package_issue', label: 'Package Issue' },
                  { value: 'payment_issue', label: 'Payment Issue' },
                  { value: 'other', label: 'Other' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.complaintTypeButton,
                      complaintType === type.value && styles.complaintTypeButtonActive
                    ]}
                    onPress={() => setComplaintType(type.value)}>
                    <Text style={[
                      styles.complaintTypeText,
                      complaintType === type.value && styles.complaintTypeTextActive
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={complaintDescription}
                onChangeText={setComplaintDescription}
                placeholder="Describe the issue in detail"
                multiline
                numberOfLines={6}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setComplaintModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitComplaint}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '600',
  },
  errorDismiss: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '700',
    marginLeft: 12,
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
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  statusButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  statusTextActive: {
    color: '#3b82f6',
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
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginVertical: 8,
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
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginTop: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerContact: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
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
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  packageText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  orderActions: {
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  complaintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  complaintButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: '#3b82f6',
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
  completedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  completedNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  completedFee: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  completedAddress: {
    fontSize: 13,
    color: '#6b7280',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
  },
  modalInfo: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  modalBody: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  complaintTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  complaintTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  complaintTypeButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  complaintTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  complaintTypeTextActive: {
    color: '#ffffff',
  },
  modalFooter: {
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
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  pendingContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  pendingInfo: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pendingInfoLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  pendingInfoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  bulkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  bulkBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8b5cf6',
  },
});
