import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCorporate } from '@/contexts/CorporateContext';
import { supabase } from '@/lib/supabase';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'customer' | 'rider' | 'admin'>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rider-specific fields
  const [riderStep, setRiderStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const { signIn, signUp, session, profile } = useAuth();
  const { isCorporateUser, loading: corporateLoading } = useCorporate();
  const router = useRouter();

  useEffect(() => {
    if (session && profile && !corporateLoading) {
      console.log('Auth: User logged in, redirecting based on role:', profile.role, 'isCorporate:', isCorporateUser);
      if (isCorporateUser) {
        router.replace('/(tabs)/corporate-dashboard' as any);
      } else if (profile.role === 'admin') {
        router.replace('/(tabs)/admin-dashboard');
      } else if (profile.role === 'rider') {
        router.replace('/(tabs)/rider-home');
      } else {
        router.replace('/(tabs)/customer-home');
      }
    }
  }, [session, profile, isCorporateUser, corporateLoading]);

  const validateRiderStep1 = () => {
    if (!email || !password || !fullName || !phoneNumber || !address) {
      setError('Please fill in all required fields');
      return false;
    }
    return true;
  };

  const validateRiderStep2 = () => {
    if (!vehicleType || !vehicleNumber || !licenseNumber) {
      setError('Please fill in all vehicle and license information');
      return false;
    }
    return true;
  };

  const validateRiderStep3 = () => {
    if (!emergencyContactName || !emergencyContactPhone) {
      setError('Please provide emergency contact information');
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !fullName)) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignUp && role === 'customer' && !phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        // For rider role, handle signup and rider data separately
        if (role === 'rider') {
          // Create auth account
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                role: 'rider',
              },
              emailRedirectTo: undefined,
            },
          });

          if (authError) throw authError;
          if (!authData.user) throw new Error('Failed to create account');

          // Insert rider-specific data
          const { error: riderError } = await supabase.from('riders').insert({
            user_id: authData.user.id,
            phone_number: phoneNumber,
            address: address,
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber,
            license_number: licenseNumber,
            emergency_contact_name: emergencyContactName,
            emergency_contact_phone: emergencyContactPhone,
            status: 'offline',
            approval_status: 'pending',
          });

          if (riderError) throw riderError;

          if (Platform.OS === 'web') {
            alert('Rider application submitted! Please wait for admin approval.');
          }
        } else {
          await signUp(email, password, fullName, role, phoneNumber);
          if (Platform.OS === 'web') {
            console.log('Account created successfully!');
          }
        }
      } else {
        await signIn(email, password);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const renderRiderSignupStep1 = () => (
    <>
      <Text style={styles.stepIndicator}>Step 1 of 3: Personal Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 234 567 8900"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Residential Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main St, City, State, ZIP"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={2}
        />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (validateRiderStep1()) {
            setError(null);
            setRiderStep(2);
          }
        }}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </>
  );

  const renderRiderSignupStep2 = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => setRiderStep(1)}>
        <ArrowLeft size={20} color="#10b981" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.stepIndicator}>Step 2 of 3: Vehicle Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Type *</Text>
        <View style={styles.roleContainer}>
          {['bike', 'motorcycle', 'car', 'van'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.vehicleButton, vehicleType === type && styles.roleButtonActive]}
              onPress={() => setVehicleType(type)}>
              <Text style={[styles.roleText, vehicleType === type && styles.roleTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Vehicle Registration Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="ABC-1234"
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Driver License Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="DL123456789"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          autoCapitalize="characters"
        />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          if (validateRiderStep2()) {
            setError(null);
            setRiderStep(3);
          }
        }}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </>
  );

  const renderRiderSignupStep3 = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => setRiderStep(2)}>
        <ArrowLeft size={20} color="#10b981" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.stepIndicator}>Step 3 of 3: Emergency Contact</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Emergency Contact Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Jane Doe"
          value={emergencyContactName}
          onChangeText={setEmergencyContactName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Emergency Contact Phone *</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 234 567 8900"
          value={emergencyContactPhone}
          onChangeText={setEmergencyContactPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.infoBox}>
        <AlertCircle size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          Your application will be reviewed by our admin team. You'll be notified once approved.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => {
          if (validateRiderStep3()) {
            handleAuth();
          }
        }}
        disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Submitting...' : 'Submit Application'}</Text>
      </TouchableOpacity>
    </>
  );

  const renderCustomerSignup = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 234 567 8900"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>I am a</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleButton, role === 'customer' && styles.roleButtonActive]}
            onPress={() => setRole('customer')}>
            <Text style={[styles.roleText, role === 'customer' && styles.roleTextActive]}>Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleButton, role === 'rider' && styles.roleButtonActive]}
            onPress={() => {
              setRole('rider');
              setRiderStep(1);
            }}>
            <Text style={[styles.roleText, role === 'rider' && styles.roleTextActive]}>Rider</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAuth}
        disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Sign Up'}</Text>
      </TouchableOpacity>
    </>
  );

  const renderSignInForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAuth}
        disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Sign In'}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Danhausa Logistics</Text>
          <Text style={styles.subtitle}>Fast & Reliable Delivery Service</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {isSignUp ? (role === 'rider' ? 'Rider Application' : 'Create Account') : 'Welcome Back'}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <AlertCircle size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!isSignUp && renderSignInForm()}
          {isSignUp && role === 'customer' && renderCustomerSignup()}
          {isSignUp && role === 'rider' && riderStep === 1 && renderRiderSignupStep1()}
          {isSignUp && role === 'rider' && riderStep === 2 && renderRiderSignupStep2()}
          {isSignUp && role === 'rider' && riderStep === 3 && renderRiderSignupStep3()}

          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setRiderStep(1);
              setRole('customer');
              setError(null);
              setPhoneNumber('');
              setAddress('');
              setVehicleNumber('');
              setLicenseNumber('');
              setEmergencyContactName('');
              setEmergencyContactPhone('');
            }}
            style={styles.switchButton}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextBold}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
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
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleTextActive: {
    color: '#10b981',
  },
  button: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#6b7280',
  },
  switchTextBold: {
    fontWeight: '700',
    color: '#10b981',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  vehicleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    minWidth: 70,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    lineHeight: 20,
  },
});
