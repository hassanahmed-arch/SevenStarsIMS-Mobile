import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSignIn = () => {
    // Add your sign in logic here
    console.log('Sign in with:', { email, password });
  };

  const handleForgotPassword = () => {
    // Add your forgot password logic here
    console.log('Forgot password pressed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Login Form Section */}
          <View style={styles.formContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.loginText}>Log In</Text>
              <View style={styles.underline} />
            </View>

            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.instructionText}>
              Fill out the information below in order to access your account.
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused
                ]}
                placeholder=""
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused
                  ]}
                  placeholder=""
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <Pressable
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#999"
                  />
                </Pressable>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={handleSignIn}
              activeOpacity={0.8}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity 
              onPress={handleForgotPassword}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  logo: {
    width: 200,
    height: 60,
  },
  formContainer: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  underline: {
    width: 60,
    height: 3,
    backgroundColor: '#e9220cff',
    borderRadius: 2,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 35,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  inputFocused: {
    borderColor: '#e9220cff',
    borderWidth: 1.5,
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 15,
  },
  signInButton: {
    height: 50,
    backgroundColor: '#e9220cff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 25,
    shadowColor: '#e9220cff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#666666',
    textDecorationLine: 'underline',
  },
})

export default LoginScreen;