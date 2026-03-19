import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MainTabs } from './MainTabs';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ForgotPinScreen } from '../screens/auth/ForgotPinScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { SetPinScreen } from '../screens/auth/SetPinScreen';
import { ActivityScreen } from '../screens/activity/ActivityScreen';
import { CardDetailsScreen } from '../screens/cards/CardDetailsScreen';
import { VirtualCardApplyReviewScreen } from '../screens/cards/apply/VirtualCardApplyReviewScreen';
import { VirtualCardApplySecurityScreen } from '../screens/cards/apply/VirtualCardApplySecurityScreen';
import { VirtualCardApplySetupScreen } from '../screens/cards/apply/VirtualCardApplySetupScreen';
import { VirtualCardApplySuccessScreen } from '../screens/cards/apply/VirtualCardApplySuccessScreen';
import { KycScreen } from '../screens/kyc/KycScreen';
import { KycSubmittedScreen } from '../screens/kyc/KycSubmittedScreen';
import { NotificationsScreen } from '../screens/misc/NotificationsScreen';
import { FeesLimitsScreen } from '../screens/profile/FeesLimitsScreen';
import { ProfileDetailsScreen } from '../screens/profile/ProfileDetailsScreen';
import { ProfileEditScreen } from '../screens/profile/ProfileEditScreen';
import { SecurityPinScreen } from '../screens/profile/SecurityPinScreen';
import { AssetsScreen } from '../screens/wallet/AssetsScreen';
import { ExchangeReviewScreen } from '../screens/wallet/ExchangeReviewScreen';
import { ExchangeScreen } from '../screens/wallet/ExchangeScreen';
import { ExchangeSecurityScreen } from '../screens/wallet/ExchangeSecurityScreen';
import { ExchangeSuccessScreen } from '../screens/wallet/ExchangeSuccessScreen';
import { SadaqahScreen } from '../screens/wallet/SadaqahScreen';
import { TopUpInstructionsScreen } from '../screens/wallet/TopUpInstructionsScreen';
import { TopUpReviewScreen } from '../screens/wallet/TopUpReviewScreen';
import { TopUpScreen } from '../screens/wallet/TopUpScreen';
import { TopUpSuccessScreen } from '../screens/wallet/TopUpSuccessScreen';
import { TransferReviewScreen } from '../screens/wallet/TransferReviewScreen';
import { TransferSecurityScreen } from '../screens/wallet/TransferSecurityScreen';
import { TransferScreen } from '../screens/wallet/TransferScreen';
import { TransferSuccessScreen } from '../screens/wallet/TransferSuccessScreen';
import { WithdrawReviewScreen } from '../screens/wallet/WithdrawReviewScreen';
import { WithdrawScreen } from '../screens/wallet/WithdrawScreen';
import { WithdrawSecurityScreen } from '../screens/wallet/WithdrawSecurityScreen';
import { WithdrawSuccessScreen } from '../screens/wallet/WithdrawSuccessScreen';
import { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        animation: 'fade',
        animationDuration: 120,
        contentStyle: { backgroundColor: '#F4F5F7' },
        fullScreenGestureEnabled: true,
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ForgotPin" component={ForgotPinScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="SetPin" component={SetPinScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CardDetails" component={CardDetailsScreen} />
      <Stack.Screen name="Assets" component={AssetsScreen} />
      <Stack.Screen name="TopUp" component={TopUpScreen} />
      <Stack.Screen name="TopUpReview" component={TopUpReviewScreen} />
      <Stack.Screen name="TopUpInstructions" component={TopUpInstructionsScreen} />
      <Stack.Screen name="TopUpSuccess" component={TopUpSuccessScreen} />
      <Stack.Screen name="Exchange" component={ExchangeScreen} />
      <Stack.Screen name="ExchangeReview" component={ExchangeReviewScreen} />
      <Stack.Screen name="ExchangeSecurity" component={ExchangeSecurityScreen} />
      <Stack.Screen name="ExchangeSuccess" component={ExchangeSuccessScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawReview" component={WithdrawReviewScreen} />
      <Stack.Screen name="WithdrawSecurity" component={WithdrawSecurityScreen} />
      <Stack.Screen name="WithdrawSuccess" component={WithdrawSuccessScreen} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="TransferReview" component={TransferReviewScreen} />
      <Stack.Screen name="TransferSecurity" component={TransferSecurityScreen} />
      <Stack.Screen name="TransferSuccess" component={TransferSuccessScreen} />
      <Stack.Screen name="Sadaqah" component={SadaqahScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="SecurityPin" component={SecurityPinScreen} />
      <Stack.Screen name="FeesLimits" component={FeesLimitsScreen} />
      <Stack.Screen name="Kyc" component={KycScreen} />
      <Stack.Screen name="KycSubmitted" component={KycSubmittedScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="VirtualCardApplySetup" component={VirtualCardApplySetupScreen} />
      <Stack.Screen name="VirtualCardApplySecurity" component={VirtualCardApplySecurityScreen} />
      <Stack.Screen name="VirtualCardApplyReview" component={VirtualCardApplyReviewScreen} />
      <Stack.Screen name="VirtualCardApplySuccess" component={VirtualCardApplySuccessScreen} />
    </Stack.Navigator>
  );
}
