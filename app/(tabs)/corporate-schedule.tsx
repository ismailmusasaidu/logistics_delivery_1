import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useCorporate } from '@/contexts/CorporateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, Plus, X, Calendar, MapPin, ToggleLeft, ToggleRight } from 'lucide-react-native';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface ScheduledDelivery {
  id: string;
  name: string;
  pickup_address: string;
  dropoff_address: string;
  package_description: string;
  recurrence_type: 'daily' | 'weekly' | 'monthly';
  recurrence_day: number | null;
  recurrence_time: string;
  is_active: boolean;
  next_execution: string | null;
  department: { name: string } | null;
}

export default function CorporateSchedule() {
  const { company } = useCorporate();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduledDelivery[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newSchedule, setNewSchedule] = useState({
    name: '',
    pickup_address: '',
    dropoff_address: '',
    package_description: '',
    department_id: '',
    recurrence_type: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recurrence_day: '1',
    recurrence_time: '09:00',
  });

  const fetchSchedules = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('scheduled_deliveries')
        .select('*, department:departments(name)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDepartments = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchDepartments();
  }, [company]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedules();
  };

  const handleCreateSchedule = async () => {
    if (
      !newSchedule.name.trim() ||
      !newSchedule.pickup_address.trim() ||
      !newSchedule.dropoff_address.trim() ||
      !newSchedule.package_description.trim()
    ) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    if (!company || !user) return;

    try {
      const { error } = await supabase.from('scheduled_deliveries').insert({
        company_id: company.id,
        department_id: newSchedule.department_id || null,
        name: newSchedule.name,
        pickup_address: newSchedule.pickup_address,
        dropoff_address: newSchedule.dropoff_address,
        package_description: newSchedule.package_description,
        recurrence_type: newSchedule.recurrence_type,
        recurrence_day: newSchedule.recurrence_type !== 'daily' ? parseInt(newSchedule.recurrence_day) : null,
        recurrence_time: newSchedule.recurrence_time,
        is_active: true,
        created_by: user.id,
      });

      if (error) throw error;

      Alert.alert('Success', 'Scheduled delivery created successfully');
      setNewSchedule({
        name: '',
        pickup_address: '',
        dropoff_address: '',
        package_description: '',
        department_id: '',
        recurrence_type: 'weekly',
        recurrence_day: '1',
        recurrence_time: '09:00',
      });
      setShowNewScheduleModal(false);
      fetchSchedules();
    } catch (error) {
      console.error('Error creating schedule:', error);
      Alert.alert('Error', 'Failed to create scheduled delivery');
    }
  };

  const handleToggleSchedule = async (scheduleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_deliveries')
        .update({ is_active: !currentStatus })
        .eq('id', scheduleId);

      if (error) throw error;
      fetchSchedules();
    } catch (error) {
      console.error('Error toggling schedule:', error);
      Alert.alert('Error', 'Failed to update schedule');
    }
  };

  const getRecurrenceText = (schedule: ScheduledDelivery): string => {
    const time = schedule.recurrence_time.substring(0, 5);

    if (schedule.recurrence_type === 'daily') {
      return `Daily at ${time}`;
    }

    if (schedule.recurrence_type === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = schedule.recurrence_day ? days[schedule.recurrence_day % 7] : 'Unknown';
      return `Weekly on ${dayName} at ${time}`;
    }

    if (schedule.recurrence_type === 'monthly') {
      const day = schedule.recurrence_day || 1;
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
      return `Monthly on ${day}${suffix} at ${time}`;
    }

    return 'Unknown';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scheduled Deliveries</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading schedules...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scheduled Deliveries</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewScheduleModal(true)}
        >
          <Plus size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {schedules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Clock size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No scheduled deliveries yet</Text>
            <Text style={styles.emptySubtext}>
              Create recurring deliveries that automatically run on a schedule
            </Text>
          </View>
        ) : (
          schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <View style={styles.scheduleHeaderLeft}>
                  <Clock size={20} color="#f59e0b" />
                  <Text style={styles.scheduleName}>{schedule.name}</Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleSchedule(schedule.id, schedule.is_active)}>
                  {schedule.is_active ? (
                    <ToggleRight size={32} color="#10b981" />
                  ) : (
                    <ToggleLeft size={32} color="#d1d5db" />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.recurrenceContainer}>
                <Calendar size={16} color="#6b7280" />
                <Text style={styles.recurrenceText}>{getRecurrenceText(schedule)}</Text>
              </View>

              {schedule.department && (
                <Text style={styles.departmentText}>
                  Department: {schedule.department.name}
                </Text>
              )}

              <View style={styles.locationContainer}>
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#10b981" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {schedule.pickup_address}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <MapPin size={16} color="#ef4444" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {schedule.dropoff_address}
                  </Text>
                </View>
              </View>

              <Text style={styles.packageText}>{schedule.package_description}</Text>

              <View style={styles.statusBadge}>
                <Text style={[styles.statusText, schedule.is_active && styles.statusTextActive]}>
                  {schedule.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showNewScheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Scheduled Delivery</Text>
            <TouchableOpacity onPress={() => setShowNewScheduleModal(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Schedule Name *</Text>
            <TextInput
              style={styles.input}
              value={newSchedule.name}
              onChangeText={(text) => setNewSchedule({ ...newSchedule, name: text })}
              placeholder="e.g., Weekly Supply Delivery"
            />

            <Text style={styles.label}>Pickup Address *</Text>
            <TextInput
              style={styles.input}
              value={newSchedule.pickup_address}
              onChangeText={(text) => setNewSchedule({ ...newSchedule, pickup_address: text })}
              placeholder="Enter pickup address"
            />

            <Text style={styles.label}>Dropoff Address *</Text>
            <TextInput
              style={styles.input}
              value={newSchedule.dropoff_address}
              onChangeText={(text) => setNewSchedule({ ...newSchedule, dropoff_address: text })}
              placeholder="Enter dropoff address"
            />

            <Text style={styles.label}>Package Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newSchedule.package_description}
              onChangeText={(text) => setNewSchedule({ ...newSchedule, package_description: text })}
              placeholder="Describe the package"
              multiline
              numberOfLines={3}
            />

            {departments.length > 0 && (
              <>
                <Text style={styles.label}>Department (Optional)</Text>
                <View style={styles.departmentPicker}>
                  {departments.map((dept) => (
                    <TouchableOpacity
                      key={dept.id}
                      style={[
                        styles.departmentOption,
                        newSchedule.department_id === dept.id && styles.departmentOptionActive,
                      ]}
                      onPress={() => setNewSchedule({ ...newSchedule, department_id: dept.id })}
                    >
                      <Text
                        style={[
                          styles.departmentOptionText,
                          newSchedule.department_id === dept.id && styles.departmentOptionTextActive,
                        ]}
                      >
                        {dept.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Recurrence Type *</Text>
            <View style={styles.recurrencePicker}>
              {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.recurrenceOption,
                    newSchedule.recurrence_type === type && styles.recurrenceOptionActive,
                  ]}
                  onPress={() => setNewSchedule({ ...newSchedule, recurrence_type: type })}
                >
                  <Text
                    style={[
                      styles.recurrenceOptionText,
                      newSchedule.recurrence_type === type && styles.recurrenceOptionTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newSchedule.recurrence_type === 'weekly' && (
              <>
                <Text style={styles.label}>Day of Week *</Text>
                <View style={styles.dayPicker}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayOption,
                        newSchedule.recurrence_day === index.toString() && styles.dayOptionActive,
                      ]}
                      onPress={() => setNewSchedule({ ...newSchedule, recurrence_day: index.toString() })}
                    >
                      <Text
                        style={[
                          styles.dayOptionText,
                          newSchedule.recurrence_day === index.toString() && styles.dayOptionTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {newSchedule.recurrence_type === 'monthly' && (
              <>
                <Text style={styles.label}>Day of Month *</Text>
                <TextInput
                  style={styles.input}
                  value={newSchedule.recurrence_day}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 1;
                    const day = Math.min(Math.max(num, 1), 31);
                    setNewSchedule({ ...newSchedule, recurrence_day: day.toString() });
                  }}
                  placeholder="1-31"
                  keyboardType="number-pad"
                />
              </>
            )}

            <Text style={styles.label}>Time *</Text>
            <TextInput
              style={styles.input}
              value={newSchedule.recurrence_time}
              onChangeText={(text) => setNewSchedule({ ...newSchedule, recurrence_time: text })}
              placeholder="HH:MM (24-hour format)"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreateSchedule}
            >
              <Text style={styles.submitButtonText}>Create Schedule</Text>
            </TouchableOpacity>
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
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#f59e0b',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  scheduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  scheduleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  recurrenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recurrenceText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  departmentText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  locationContainer: {
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  packageText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusTextActive: {
    color: '#10b981',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  departmentPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  departmentOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  departmentOptionActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  departmentOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  departmentOptionTextActive: {
    color: '#ffffff',
  },
  recurrencePicker: {
    flexDirection: 'row',
    gap: 8,
  },
  recurrenceOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  recurrenceOptionActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  recurrenceOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  recurrenceOptionTextActive: {
    color: '#ffffff',
  },
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayOption: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOptionActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  dayOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dayOptionTextActive: {
    color: '#ffffff',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
