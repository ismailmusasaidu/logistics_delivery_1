import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, Mail, Phone, MapPin, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react-native';

export default function CorporateRegister() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    code: '',
    contact_email: user?.email || '',
    contact_phone: '',
    address: '',
    billing_address: '',
    tax_id: '',
    payment_terms: 'NET30',
    requires_approval: true,
  });

  const handleRegister = async () => {
    if (!companyInfo.name.trim() || !companyInfo.code.trim()) {
      Alert.alert('Missing Information', 'Please provide company name and code');
      return;
    }

    if (!companyInfo.contact_email.trim() || !companyInfo.contact_phone.trim()) {
      Alert.alert('Missing Information', 'Please provide contact email and phone');
      return;
    }

    if (!user) {
      Alert.alert('Authentication Required', 'Please log in first');
      router.push('/auth');
      return;
    }

    setLoading(true);

    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyInfo.name,
          code: companyInfo.code.toUpperCase(),
          contact_email: companyInfo.contact_email,
          contact_phone: companyInfo.contact_phone,
          address: companyInfo.address || null,
          billing_address: companyInfo.billing_address || companyInfo.address || null,
          tax_id: companyInfo.tax_id || null,
          payment_terms: companyInfo.payment_terms,
          requires_approval: companyInfo.requires_approval,
          is_active: true,
        })
        .select()
        .single();

      if (companyError) {
        if (companyError.code === '23505') {
          Alert.alert('Company Code Exists', 'This company code is already in use. Please choose another.');
          return;
        }
        throw companyError;
      }

      const { error: staffError } = await supabase
        .from('company_staff')
        .insert({
          company_id: companyData.id,
          user_id: user.id,
          role: 'admin',
          is_active: true,
        });

      if (staffError) throw staffError;

      Alert.alert(
        'Success!',
        'Your corporate account has been created. You can now access the corporate dashboard.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/corporate-dashboard' as any),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error registering company:', error);
      Alert.alert('Registration Failed', error.message || 'Failed to register company');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!companyInfo.name.trim() || !companyInfo.code.trim()) {
        Alert.alert('Missing Information', 'Please provide company name and code');
        return;
      }
    }
    if (step === 2) {
      if (!companyInfo.contact_email.trim() || !companyInfo.contact_phone.trim()) {
        Alert.alert('Missing Information', 'Please provide contact email and phone');
        return;
      }
    }
    setStep(step + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Corporate Registration</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.stepIndicator}>
        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
          </View>
          <Text style={styles.stepLabel}>Company Info</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
          </View>
          <Text style={styles.stepLabel}>Contact</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepContainer}>
          <View style={[styles.stepCircle, step >= 3 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>3</Text>
          </View>
          <Text style={styles.stepLabel}>Billing</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <Building2 size={48} color="#f59e0b" />
            </View>
            <Text style={styles.stepTitle}>Company Information</Text>
            <Text style={styles.stepDescription}>
              Let's start with your company's basic information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Name *</Text>
              <TextInput
                style={styles.input}
                value={companyInfo.name}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, name: text })}
                placeholder="e.g., Acme Corporation"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Code *</Text>
              <TextInput
                style={styles.input}
                value={companyInfo.code}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, code: text.toUpperCase() })}
                placeholder="e.g., ACME"
                autoCapitalize="characters"
                maxLength={10}
              />
              <Text style={styles.hint}>A short, unique identifier for your company</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tax ID / Business Registration (Optional)</Text>
              <TextInput
                style={styles.input}
                value={companyInfo.tax_id}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, tax_id: text })}
                placeholder="e.g., 12-3456789"
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <Mail size={48} color="#f59e0b" />
            </View>
            <Text style={styles.stepTitle}>Contact Information</Text>
            <Text style={styles.stepDescription}>
              How can we reach your company?
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Email *</Text>
              <TextInput
                style={styles.input}
                value={companyInfo.contact_email}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, contact_email: text })}
                placeholder="contact@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Phone *</Text>
              <TextInput
                style={styles.input}
                value={companyInfo.contact_phone}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, contact_phone: text })}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Address (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={companyInfo.address}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, address: text })}
                placeholder="Street address, city, state, zip"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <CreditCard size={48} color="#f59e0b" />
            </View>
            <Text style={styles.stepTitle}>Billing & Settings</Text>
            <Text style={styles.stepDescription}>
              Configure your account settings
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Billing Address (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={companyInfo.billing_address}
                onChangeText={(text) => setCompanyInfo({ ...companyInfo, billing_address: text })}
                placeholder="Same as company address or different"
                multiline
                numberOfLines={3}
              />
              <Text style={styles.hint}>Leave blank to use company address</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Terms</Text>
              <View style={styles.paymentTermsContainer}>
                {['NET15', 'NET30', 'NET60'].map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.paymentTermOption,
                      companyInfo.payment_terms === term && styles.paymentTermOptionActive,
                    ]}
                    onPress={() => setCompanyInfo({ ...companyInfo, payment_terms: term })}
                  >
                    <Text
                      style={[
                        styles.paymentTermText,
                        companyInfo.payment_terms === term && styles.paymentTermTextActive,
                      ]}
                    >
                      {term}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Approval Workflow</Text>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() =>
                  setCompanyInfo({
                    ...companyInfo,
                    requires_approval: !companyInfo.requires_approval,
                  })
                }
              >
                <View style={styles.checkbox}>
                  {companyInfo.requires_approval && (
                    <CheckCircle size={20} color="#f59e0b" />
                  )}
                </View>
                <View style={styles.checkboxLabel}>
                  <Text style={styles.checkboxText}>
                    Require admin approval for all deliveries
                  </Text>
                  <Text style={styles.checkboxHint}>
                    Staff requests will need admin approval before processing
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>What happens next?</Text>
              <Text style={styles.infoBoxText}>
                • You'll become the company administrator{'\n'}
                • You can invite staff members from settings{'\n'}
                • Staff can start creating delivery requests{'\n'}
                • You'll receive monthly invoices and reports
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < 3 ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={nextStep}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  stepContainer: {
    alignItems: 'center',
    gap: 8,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#f59e0b',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
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
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  paymentTermsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentTermOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  paymentTermOptionActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  paymentTermText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  paymentTermTextActive: {
    color: '#f59e0b',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flex: 1,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  checkboxHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
