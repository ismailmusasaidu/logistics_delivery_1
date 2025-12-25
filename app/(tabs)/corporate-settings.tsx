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
} from 'react-native';
import { useCorporate } from '@/contexts/CorporateContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, Users, Plus, X, Trash2, UserPlus } from 'lucide-react-native';

interface Department {
  id: string;
  name: string;
  code: string;
  cost_center: string | null;
  is_active: boolean;
}

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  employee_id: string | null;
  is_active: boolean;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function CorporateSettings() {
  const { company, refreshCorporateData } = useCorporate();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [showNewStaffModal, setShowNewStaffModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newDept, setNewDept] = useState({
    name: '',
    code: '',
    cost_center: '',
  });

  const [newStaff, setNewStaff] = useState({
    email: '',
    role: 'staff' as 'admin' | 'staff' | 'finance',
    employee_id: '',
  });

  const fetchDepartments = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', company.id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchStaff = async () => {
    if (!company) return;

    try {
      const { data, error } = await supabase
        .from('company_staff')
        .select('*, profiles(full_name, email)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchStaff();
  }, [company]);

  const handleCreateDepartment = async () => {
    if (!newDept.name.trim() || !newDept.code.trim()) {
      Alert.alert('Missing Information', 'Please provide department name and code');
      return;
    }

    if (!company) return;

    try {
      const { error } = await supabase
        .from('departments')
        .insert({
          company_id: company.id,
          name: newDept.name,
          code: newDept.code,
          cost_center: newDept.cost_center || null,
          is_active: true,
        });

      if (error) throw error;

      Alert.alert('Success', 'Department created successfully');
      setNewDept({ name: '', code: '', cost_center: '' });
      setShowNewDeptModal(false);
      fetchDepartments();
    } catch (error: any) {
      console.error('Error creating department:', error);
      Alert.alert('Error', error.message || 'Failed to create department');
    }
  };

  const handleToggleDepartment = async (deptId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: !currentStatus })
        .eq('id', deptId);

      if (error) throw error;
      fetchDepartments();
    } catch (error) {
      console.error('Error toggling department:', error);
      Alert.alert('Error', 'Failed to update department');
    }
  };

  const handleInviteStaff = async () => {
    if (!newStaff.email.trim()) {
      Alert.alert('Missing Information', 'Please provide an email address');
      return;
    }

    if (!company) return;

    try {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newStaff.email.toLowerCase())
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        Alert.alert('User Not Found', 'No user found with that email address. They need to sign up first.');
        return;
      }

      const { error: staffError } = await supabase
        .from('company_staff')
        .insert({
          company_id: company.id,
          user_id: userData.id,
          role: newStaff.role,
          employee_id: newStaff.employee_id || null,
          is_active: true,
        });

      if (staffError) {
        if (staffError.code === '23505') {
          Alert.alert('Already Member', 'This user is already a member of your company');
        } else {
          throw staffError;
        }
        return;
      }

      Alert.alert('Success', 'Staff member added successfully');
      setNewStaff({ email: '', role: 'staff', employee_id: '' });
      setShowNewStaffModal(false);
      fetchStaff();
    } catch (error: any) {
      console.error('Error inviting staff:', error);
      Alert.alert('Error', error.message || 'Failed to add staff member');
    }
  };

  const handleToggleStaff = async (staffId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('company_staff')
        .update({ is_active: !currentStatus })
        .eq('id', staffId);

      if (error) throw error;
      fetchStaff();
    } catch (error) {
      console.error('Error toggling staff:', error);
      Alert.alert('Error', 'Failed to update staff member');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Company Settings</Text>
        {company && <Text style={styles.companyName}>{company.name}</Text>}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Company Information</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Company Code:</Text>
              <Text style={styles.infoValue}>{company?.code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contact:</Text>
              <Text style={styles.infoValue}>{company?.contact_email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Terms:</Text>
              <Text style={styles.infoValue}>{company?.payment_terms}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Approval Required:</Text>
              <Text style={styles.infoValue}>
                {company?.requires_approval ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Departments</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowNewDeptModal(true)}
            >
              <Plus size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {departments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No departments yet</Text>
            </View>
          ) : (
            departments.map((dept) => (
              <View key={dept.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{dept.name}</Text>
                  <Text style={styles.itemDetail}>Code: {dept.code}</Text>
                  {dept.cost_center && (
                    <Text style={styles.itemDetail}>Cost Center: {dept.cost_center}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    dept.is_active ? styles.statusActive : styles.statusInactive,
                  ]}
                  onPress={() => handleToggleDepartment(dept.id, dept.is_active)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      dept.is_active ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {dept.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Staff Members</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowNewStaffModal(true)}
            >
              <UserPlus size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {staff.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No staff members yet</Text>
            </View>
          ) : (
            staff.map((member) => (
              <View key={member.id} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{member.profiles?.full_name || 'Unknown'}</Text>
                  <Text style={styles.itemDetail}>{member.profiles?.email}</Text>
                  <Text style={styles.itemDetail}>
                    Role: {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Text>
                  {member.employee_id && (
                    <Text style={styles.itemDetail}>Employee ID: {member.employee_id}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    member.is_active ? styles.statusActive : styles.statusInactive,
                  ]}
                  onPress={() => handleToggleStaff(member.id, member.is_active)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      member.is_active ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showNewDeptModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Department</Text>
            <TouchableOpacity onPress={() => setShowNewDeptModal(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Department Name *</Text>
            <TextInput
              style={styles.input}
              value={newDept.name}
              onChangeText={(text) => setNewDept({ ...newDept, name: text })}
              placeholder="e.g., Marketing"
            />

            <Text style={styles.label}>Department Code *</Text>
            <TextInput
              style={styles.input}
              value={newDept.code}
              onChangeText={(text) => setNewDept({ ...newDept, code: text.toUpperCase() })}
              placeholder="e.g., MKT"
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Cost Center (Optional)</Text>
            <TextInput
              style={styles.input}
              value={newDept.cost_center}
              onChangeText={(text) => setNewDept({ ...newDept, cost_center: text })}
              placeholder="e.g., CC-1001"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.submitButton} onPress={handleCreateDepartment}>
              <Text style={styles.submitButtonText}>Create Department</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showNewStaffModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            <TouchableOpacity onPress={() => setShowNewStaffModal(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={newStaff.email}
              onChangeText={(text) => setNewStaff({ ...newStaff, email: text })}
              placeholder="user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Role *</Text>
            <View style={styles.rolePicker}>
              {(['admin', 'staff', 'finance'] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    newStaff.role === role && styles.roleOptionActive,
                  ]}
                  onPress={() => setNewStaff({ ...newStaff, role })}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      newStaff.role === role && styles.roleOptionTextActive,
                    ]}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Employee ID (Optional)</Text>
            <TextInput
              style={styles.input}
              value={newStaff.employee_id}
              onChangeText={(text) => setNewStaff({ ...newStaff, employee_id: text })}
              placeholder="e.g., EMP-1001"
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                The user must have an existing account. They will need to sign up first before you can add them to your company.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.submitButton} onPress={handleInviteStaff}>
              <Text style={styles.submitButtonText}>Add Staff Member</Text>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  companyName: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
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
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  addButton: {
    backgroundColor: '#f59e0b',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statusTextInactive: {
    color: '#dc2626',
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
  rolePicker: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleOptionTextActive: {
    color: '#ffffff',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
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
