import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Package, MapPin, Clock, Filter, Edit2, Trash2, X, Plus, User, Phone, Bike, Layers } from 'lucide-react-native';
import { supabase, Order, Rider, Profile } from '@/lib/supabase';
import { StatusBadge } from '@/components/StatusBadge';

type RiderWithProfile = Rider & { profile: Profile };

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [riders, setRiders] = useState<RiderWithProfile[]>([]);
  const [riderAssignMode, setRiderAssignMode] = useState<'registered' | 'manual'>('registered');

  useEffect(() => {
    loadOrders();
    loadRiders();
  }, []);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(o => o.status === filter));
    }
  }, [filter, orders]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(id, full_name, email, phone),
          rider:riders!orders_rider_id_fkey(
            id,
            status,
            profile:profiles!riders_user_id_fkey(id, full_name, phone)
          ),
          bulk_order:bulk_orders(
            id,
            bulk_order_number,
            total_orders,
            discount_percentage,
            final_fee,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select(`
          *,
          profile:profiles!riders_user_id_fkey(*)
        `)
        .in('status', ['available', 'offline']);

      if (error) throw error;
      setRiders(data as any || []);
    } catch (error) {
      console.error('Error loading riders:', error);
    }
  };

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setRiderAssignMode(order.rider_id ? 'registered' : 'manual');
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedOrder) return;

    try {
      const updateData: any = {
        status: selectedOrder.status,
        pickup_address: selectedOrder.pickup_address,
        delivery_address: selectedOrder.delivery_address,
        recipient_name: selectedOrder.recipient_name,
        recipient_phone: selectedOrder.recipient_phone,
        package_description: selectedOrder.package_description,
        delivery_fee: selectedOrder.delivery_fee,
        notes: selectedOrder.notes,
      };

      if (riderAssignMode === 'registered') {
        updateData.rider_id = selectedOrder.rider_id;
        updateData.rider_name = null;
        updateData.rider_phone = null;
      } else {
        updateData.rider_id = null;
        updateData.rider_name = selectedOrder.rider_name;
        updateData.rider_phone = selectedOrder.rider_phone;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.id);

      if (error) throw error;

      setEditModalVisible(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      if (Platform.OS === 'web') {
        alert('Failed to update order');
      }
    }
  };

  const handleDelete = async (orderId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this order?')
      : true;

    if (confirmed) {
      try {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        if (error) throw error;
        loadOrders();
      } catch (error) {
        console.error('Error deleting order:', error);
        if (Platform.OS === 'web') {
          alert('Failed to delete order');
        }
      }
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

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Active', value: 'in_transit' },
    { label: 'Delivered', value: 'delivered' },
  ];

  const statusOptions: Array<'pending' | 'confirmed' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'> = ['pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Orders</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{orders.length}</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <Filter size={18} color="#6b7280" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.filterButton, filter === item.value && styles.filterButtonActive]}
              onPress={() => setFilter(item.value)}>
              <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />}>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No orders found</Text>
            <Text style={styles.emptySubtext}>Orders will appear here</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(order)}>
                    <Edit2 size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(order.id)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.orderNumberRow}>
                <Text style={styles.orderNumber}>{order.order_number}</Text>
                {(order as any).bulk_order && (
                  <View style={styles.bulkBadge}>
                    <Layers size={14} color="#8b5cf6" />
                    <Text style={styles.bulkBadgeText}>
                      BULK {(order as any).bulk_order.bulk_order_number}
                    </Text>
                  </View>
                )}
              </View>

              {(order as any).bulk_order && (
                <View style={styles.bulkInfo}>
                  <Text style={styles.bulkInfoText}>
                    Part of {(order as any).bulk_order.total_orders} orders • {(order as any).bulk_order.discount_percentage}% discount
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
                  <MapPin size={18} color="#10b981" />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>Pickup</Text>
                    <Text style={styles.addressText}>{order.pickup_address}</Text>
                  </View>
                </View>

                <View style={styles.addressRow}>
                  <MapPin size={18} color="#ef4444" />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>Delivery to {order.recipient_name}</Text>
                    <Text style={styles.addressText}>{order.delivery_address}</Text>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <View style={styles.timeInfo}>
                    <Clock size={16} color="#6b7280" />
                    <Text style={styles.timeText}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.feeText}>₦{order.delivery_fee.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Order</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusSelector}>
                {statusOptions.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      selectedOrder?.status === status && styles.statusOptionActive
                    ]}
                    onPress={() => setSelectedOrder(prev => prev ? { ...prev, status } : null)}>
                    <Text style={[
                      styles.statusOptionText,
                      selectedOrder?.status === status && styles.statusOptionTextActive
                    ]}>
                      {getStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Pickup Address</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.pickup_address}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, pickup_address: text } : null)}
                placeholder="Enter pickup address"
              />

              <Text style={styles.label}>Delivery Address</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.delivery_address}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, delivery_address: text } : null)}
                placeholder="Enter delivery address"
              />

              <Text style={styles.label}>Recipient Name</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.recipient_name}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, recipient_name: text } : null)}
                placeholder="Enter recipient name"
              />

              <Text style={styles.label}>Recipient Phone</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.recipient_phone}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, recipient_phone: text } : null)}
                placeholder="Enter recipient phone"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Package Description</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.package_description}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, package_description: text } : null)}
                placeholder="Enter package description"
              />

              <Text style={styles.label}>Delivery Fee</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.delivery_fee.toString()}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, delivery_fee: parseFloat(text) || 0 } : null)}
                placeholder="Enter delivery fee"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={selectedOrder?.notes || ''}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, notes: text } : null)}
                placeholder="Enter notes"
                multiline
                numberOfLines={3}
              />

              <View style={styles.riderSection}>
                <View style={styles.riderHeader}>
                  <Bike size={20} color="#8b5cf6" />
                  <Text style={styles.riderSectionTitle}>Assign Rider</Text>
                </View>

                <View style={styles.modeSelector}>
                  <TouchableOpacity
                    style={[styles.modeButton, riderAssignMode === 'registered' && styles.modeButtonActive]}
                    onPress={() => setRiderAssignMode('registered')}>
                    <Text style={[styles.modeButtonText, riderAssignMode === 'registered' && styles.modeButtonTextActive]}>
                      Registered Rider
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeButton, riderAssignMode === 'manual' && styles.modeButtonActive]}
                    onPress={() => setRiderAssignMode('manual')}>
                    <Text style={[styles.modeButtonText, riderAssignMode === 'manual' && styles.modeButtonTextActive]}>
                      Manual Entry
                    </Text>
                  </TouchableOpacity>
                </View>

                {riderAssignMode === 'registered' ? (
                  <>
                    <Text style={styles.label}>Select Rider</Text>
                    {riders.length === 0 ? (
                      <Text style={styles.noRidersText}>No registered riders available</Text>
                    ) : (
                      <ScrollView style={styles.ridersList} nestedScrollEnabled>
                        {riders.map((rider) => (
                          <TouchableOpacity
                            key={rider.id}
                            style={[
                              styles.riderCard,
                              selectedOrder?.rider_id === rider.id && styles.riderCardActive
                            ]}
                            onPress={() => setSelectedOrder(prev => prev ? { ...prev, rider_id: rider.id } : null)}>
                            <View style={styles.riderInfo}>
                              <Text style={styles.riderName}>{rider.profile.full_name}</Text>
                              <Text style={styles.riderDetails}>
                                {rider.vehicle_type.charAt(0).toUpperCase() + rider.vehicle_type.slice(1)} • {rider.vehicle_number}
                              </Text>
                              <View style={styles.riderStats}>
                                <Text style={styles.riderStat}>⭐ {rider.rating.toFixed(1)}</Text>
                                <Text style={styles.riderStat}>📦 {rider.total_deliveries} deliveries</Text>
                                <View style={[styles.statusDot, { backgroundColor: rider.status === 'available' ? '#10b981' : '#6b7280' }]} />
                                <Text style={[styles.riderStat, { color: rider.status === 'available' ? '#10b981' : '#6b7280' }]}>
                                  {rider.status}
                                </Text>
                              </View>
                            </View>
                            {selectedOrder?.rider_id === rider.id && (
                              <View style={styles.selectedBadge}>
                                <Text style={styles.selectedBadgeText}>✓</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.riderSectionSubtitle}>Enter rider contact information manually</Text>

                    <Text style={styles.label}>Rider Name</Text>
                    <TextInput
                      style={styles.input}
                      value={selectedOrder?.rider_name || ''}
                      onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, rider_name: text } : null)}
                      placeholder="Enter rider name"
                    />

                    <Text style={styles.label}>Rider Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={selectedOrder?.rider_phone || ''}
                      onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, rider_phone: text } : null)}
                      placeholder="Enter rider phone number"
                      keyboardType="phone-pad"
                    />
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  filterScroll: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#8b5cf6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
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
    marginBottom: 8,
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
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
    color: '#8b5cf6',
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
    maxHeight: '90%',
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
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  statusOptionActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusOptionTextActive: {
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
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  riderSection: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  riderSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  riderSectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  ridersList: {
    maxHeight: 250,
    marginBottom: 16,
  },
  riderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  riderCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  riderDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  riderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riderStat: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  noRidersText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bulkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  bulkBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  bulkInfo: {
    backgroundColor: '#faf5ff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  bulkInfoText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '500',
  },
});
