# PHASE 13 INSPECTION REPORT
## Guardian App Frontend Architecture Analysis

---

## 1. FRONTEND FRAMEWORK & TECH STACK

**Framework**: React Native (Expo)
**Version**: React 19.2.3, React Native 0.86.0
**State Management**: Redux + Redux Toolkit
**Navigation**: React Navigation (v7)
- Bottom Tabs Navigator
- Native Stack Navigator
- Drawer Navigator
**HTTP Client**: Axios with custom interceptor (base URL configured)
**Real-time**: Socket.io-client (v4.8.3)
**Maps**: @rnmapbox/maps (v10.3.2) with Mapbox integration
**Notifications**: expo-notifications (v57.0.8)
**UI Utilities**: expo-linear-gradient, Ionicons, react-native-toast-message
**Location**: expo-location (v57.0.6)
**Styling**: React Native StyleSheet with custom theme system

---

## 2. PROJECT STRUCTURE

```
guardian/
├── App.js                          # Root app entry point with navigation logic
├── index.js                        # Entry point
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── src/
│   ├── screens/                    # All screen components
│   ├── components/                 # Reusable UI components
│   ├── lib/                        # Redux slices and thunks
│   ├── hooks/                      # Custom React hooks
│   ├── utils/                      # Utility functions
│   ├── contexts/                   # React contexts (Theme)
│   ├── navigation/                 # Navigation structure
│   ├── store/                      # Redux store configuration
│   └── config/                     # Configuration files
├── assets/                         # App icons, logos
└── android/                        # Android native code
```

---

## 3. GUARDIAN APP SCREENS

### Authentication Screens (Pre-Login)
- `LoginScreen.js`
- `SignupScreen.js`
- `OTPVerificationScreen.js`
- `ForgotPasswordScreen.js`
- `ResetPasswordScreen.js`

### Guardian Flow Screens
- `SetProfileScreen.js` - Initial profile setup after signup
- `SubscriptionScreen.js` - Subscription/plan selection UI
- `FindDriverScreen.js` - Find driver for normal rides

### Main Tab Screens (Post-Authentication)
1. **HomeScreen.js** - Main tracking dashboard
   - Displays children by vehicle/route group
   - Interactive map with vehicle location
   - Real-time tracking updates
   - Student detail cards with vehicle info

2. **NotificationsScreen.js** - Notifications list

3. **RequestsScreen.js** - Guardian requests (join requests, etc.)

4. **RoutesScreen.js** - Vehicle route details

### Stack-Based Screens
**Students Stack**:
- `StudentsScreen.js` - List all guardian's students
- `StudentDetailsScreen.js` - Detailed view of one student
- `AddStudentScreen.js` - Add new student
- `RoutesScreen.js` - Route details

**Messages Stack**:
- `ConversationsScreen.js` - List conversations
- `ChatScreen.js` - Chat thread view
- `NewConversationScreen.js` - Start new conversation

### Drawer Screens (Accessible from sidebar)
- `VehicleScreen.js` - Vehicle information
- `HistoryScreen.js` - Ride history
- `AccountScreen.js` - Account settings
- `SettingsScreen.js` - General settings
- `PaymentScreen.js` - Payment methods
- `NotificationsSettingsScreen.js` - Notification preferences
- `SecurityScreen.js` - Security settings
- `EditProfileScreen.js` - Edit guardian profile

---

## 4. GUARDIAN NAVIGATION STRUCTURE

```
App (Stack Navigator)
├── Auth Stack (if !isAuthenticated)
│   ├── Login
│   ├── Signup
│   ├── OTP
│   ├── ForgotPassword
│   └── ResetPassword
├── Profile Setup (if !hasProfile)
│   └── SetProfile
├── Drawer Navigator (if authenticated & hasProfile)
│   ├── Drawer Content (custom sidebar)
│   └── Main Tab Navigator
│       ├── Home (with HomeStack - StudentsStack)
│       ├── Notifications
│       ├── Requests
│       └── Routes
│   └── Drawer Screens (VehicleScreen, HistoryScreen, etc.)
└── SubscriptionScreen (modal/stack based on context)
```

**Key Navigation Pattern**:
- Uses Redux for auth state to determine which stack to show
- `useGuardianSocket()` hook called at root level (App.js) to maintain single socket connection
- Navigation guards based on:
  - `isAuthenticated` (from AuthSlice)
  - `guardianProfile.id` (from UserSlice)
  - `students` array (from UserSlice)

---

## 5. REDUX STATE STRUCTURE

**Store Location**: `src/store/store.js`

**Reducers** (from `combineReducers`):
```javascript
{
  auth: AuthSlice,                    // User login/logout, auth token
  users: UserSlice,                   // Guardian profile, students, drivers
  vehicleroutes: VehicleRoutesSlice,  // Route information
  vehicletracking: VehicleTrackingSlice, // Real-time vehicle tracking data
  messages: MessagesSlice,            // Chat messages
  guardianRequests: GuardianRequestsSlice, // Join/request tracking
  notifications: NotificationsSlice,  // Push notifications
}
```

### AuthSlice (Authentication State)
**Location**: `src/lib/AuthSlice.js`
**Key Properties**:
- `user` - Current authenticated user object
- `isAuthenticated` - Boolean
- `isInitialized` - Boolean
- `error`, `success` - State messages
- `verificationOTP`, `hasSelectedRoute` - Temp state

**Key Thunks**:
- `LoginUser` - POST `/auth/login`
- `SignupUser` - POST `/auth/signup`
- `LogoutUser` - POST `/auth/logout`
- `forgotPassword` - POST `/auth/forgot-password`
- `validateResetToken` - GET `/auth/validate-reset-token`
- `resetPassword` - POST `/auth/reset-password`
- `loadFromStorage` - Restore session from AsyncStorage

### UserSlice (Guardian & Student Data)
**Location**: `src/lib/UserSlice.js`
**Key Properties**:
- `guardianProfile` - Current guardian's profile object
  - Includes `isSubscribed` boolean
- `students` - Array of guardian's children
  - Each student has `vehicleRoute` with vehicle/route info
- `drivers`, `guardians` - Other user data (if needed)
- `isLoading`, `error` - Loading and error states

**Key Thunks**:
- `getGuardianProfile` - GET `/users/my-profile`
- `getGuardianStudents` - GET `/users/my-students`
- `setGuardianProfile` - POST `/users/create-guardian-profile`
- `updateGuardian` - PATCH `/users/update-guardian/{id}`
- `subscribeGuardian` - POST `/users/subscribe` (subscription)

### VehicleTrackingSlice
**Location**: `src/lib/VehicleTrackingSlice.js`
**Purpose**: Real-time tracking data for vehicles
**Key Data**: Vehicle location, speed, heading, trip status, stops

### MessagesSlice
**Location**: `src/lib/MessagesSlice.js`
**Purpose**: Chat messages and conversations

### GuardianRequestsSlice
**Location**: `src/lib/GuardianRequestsSlice.js`
**Purpose**: Join requests, guardian requests

### NotificationsSlice
**Location**: `src/lib/NotificationsSlice.js`
**Purpose**: In-app notifications and announcements

---

## 6. API SERVICE ARCHITECTURE

**Axios Instance**: `src/utils/axiosInstance.js`
- **Base URL**: `https://38ktx0q1-5007.inc1.devtunnels.ms/api`
- **Features**:
  - Auto token refresh on 401
  - Special error handling for 423 (account locked) and 429 (rate limit)
  - Credential-based requests (HttpOnly cookies)
  - Request/response interceptors

**API Endpoints Used** (from Redux thunks):
- `/auth/*` - Authentication
- `/users/*` - Guardian and student management
  - `GET /users/my-profile` - Get guardian profile
  - `GET /users/my-students` - Get children
  - `POST /users/subscribe` - Subscribe to plan
- `/vehicles/*` - Vehicle info
- `/vehicleroutes/*` - Route info
- `/messages/*` - Chat
- `/notifications/*` - Notifications

---

## 7. AUTHENTICATION IMPLEMENTATION

**Flow**:
1. `LoginScreen` → `LoginUser` thunk → Redux `AuthSlice`
2. Token stored via interceptors + AsyncStorage
3. All requests use JWT token in Authorization header
4. Token refresh automatic on 401 response
5. Logout clears Redux state and AsyncStorage

**Current Guardian Profile Check**:
- Loaded via `getGuardianProfile()` thunk after login
- Returns `null` if not created yet (404 response)
- Navigation gates on `hasProfile` boolean

---

## 8. SUBSCRIPTION/PRO ACCESS IMPLEMENTATION

**Current Subscription System**:
- **Location**: `src/screens/SubscriptionScreen.js`
- **State**: `guardianProfile.isSubscribed` (boolean in Redux)
- **Plans**: Basic, Family, Premium (hardcoded in SubscriptionScreen)
- **Subscription Check**: 
  - `isSubscribed = guardianProfile?.isSubscribed || false`
  - Not currently used to gate navigation (only for UX)
  - Backend is the final authority

**Subscription Thunk**:
- `subscribeGuardian` - POST `/users/subscribe` with plan ID

**Where Used**:
- `SubscriptionScreen.js` - Display and manage subscriptions
- Could be used in conditional rendering for features

---

## 9. EXISTING MAPS & TRACKING IMPLEMENTATION

**Map Component**: Mapbox (@rnmapbox/maps)
**Location**: `src/utils/mapbox.js`

**Key Features**:
- `getRouteDirections()` - Get driving directions between coordinates
- Map display in HomeScreen with vehicle markers
- Real-time location updates via Socket.io

**Real-Time Tracking**:
- **Socket Connection**: `src/utils/socket.js`
- **Hook**: `src/hooks/useSocket.js` (called once in App.js)
- **Purpose**: 
  - Join user's personal room
  - Join vehicle rooms for tracked children
  - Listen for: vehicle-location-update, vehicle-started, vehicle-eta-update, etc.
  - Dispatch updates into Redux (VehicleTrackingSlice)

**Existing Tracking Events** (from socket.js):
- `vehicle-location-update` - GPS position
- `vehicle-started` - Trip started
- `vehicle-stop-arrival` - Arrived at stop
- `vehicle-approaching-stop` - ETA to stop
- `vehicle-departure` - Left stop
- `vehicle-eta-update` - ETA changed
- `vehicle-delayed` - Trip delayed
- `vehicle-alert` - Safety alert
- `trip-ended` - Trip finished
- `driver-sos` - Emergency alert

---

## 10. SOCKET.IO IMPLEMENTATION

**Instance**: `src/utils/socket.js`
- **URL**: `process.env.EXPO_PUBLIC_SOCKET_URL`
- **Transport**: Polling + WebSocket
- **Reconnection**: Auto with 20 attempts
- **Singleton**: Single instance throughout app lifetime

**Hook Integration** (`src/hooks/useSocket.js`):
- Called once at root level (App.js)
- No-ops if user not authenticated
- Joins/leaves rooms automatically
- Listens for all inbound events
- Dispatches Redux actions for each event

**Guardian-Specific Rooms**:
- `join-user` - Personal notifications + messages
- `join-vehicle <id>` - Track specific child's vehicle (one per child)
- `join-vehicle-tracking` - Global tracking room

**Outbound Messaging Helpers**:
- `joinConversation()` - Join chat room
- `leaveConversation()` - Leave chat room
- `sendTyping()` - Typing indicator
- `markMessageRead()` - Read receipt
- `getSocket()` - Access socket directly
- `isSocketHealthy()` - Connection status

---

## 11. NOTIFICATIONS IMPLEMENTATION

**Push Notifications** (Expo):
- **Setup**: `src/utils/notifications.js` - `registerPushNotifications()`
- Called after login in App.js
- Prompts for permission + registers token with backend
- Fire-and-forget (doesn't block if denied)

**In-App Notifications**:
- **Toast**: `react-native-toast-message` with custom config (`src/config/toastConfig.js`)
- **Redux**: NotificationsSlice stores notification list
- **Socket Event**: `new-notification` updates Redux state

**Notification Display**:
- Toast for real-time alerts (top of screen)
- NotificationsScreen for history
- Badge count on tab icon (from Redux)

---

## 12. EXISTING UI COMPONENT PATTERNS

**Theme System** (`src/contexts/ThemeContext.js`):
- Dark and light mode palettes
- Uses context + Redux
- Colors: `T.bg`, `T.text`, `T.accent` (#e83030 red), `T.surface`, etc.
- Preference saved to AsyncStorage

**Common Component Patterns**:
- **Buttons**: TouchableOpacity with custom styling
- **Cards**: Surface containers with borders
- **Text**: Text component with theme colors
- **Lists**: FlatList with item rendering
- **Loading**: ActivityIndicator (Expo default)
- **Icons**: Ionicons from @react-native-vector-icons
- **Modals**: React Native Modal
- **ScrollView**: For scrollable content with RefreshControl

**Shared Styling**:
- All screens use `useTheme()` hook to access `T` object
- SafeAreaInsets via `useSafeAreaInsets()` for notch safety
- Consistent spacing, borders, and color usage

---

## 13. AUTHENTICATION & SUBSCRIPTION GUARDS

**Navigation-Level Guards** (App.js):
```
!isAuthenticated → Show Auth Stack
!hasProfile → Show SetProfile Screen
!hasStudents → Show FindDriver Screen
(else) → Show MainTabs with Drawer
```

**Feature-Level Guards** (Where Implemented):
- Subscription requirements checked at action point
- Backend enforces via `requireProFeature` middleware
- Frontend can check `guardianProfile?.isSubscribed` for UX

---

## 14. EXISTING ERROR HANDLING

**HTTP Errors** (axiosInstance.js):
- 401 → Auto token refresh attempt
- 423 → Account locked message
- 429 → Rate limit message
- Others → Generic error message

**UI Error Display**:
- Toast.show() with error type
- Text fallback messages in screens
- Redux error state storage

**Loading States**:
- ActivityIndicator while loading
- Disabled buttons during API calls
- RefreshControl for pull-to-refresh

---

## 15. FILES THAT SHOULD BE MODIFIED FOR EMERGENCY FEATURE

### Files to Add/Create (New):
1. **Redux Slice**: `src/lib/EmergencyRideSlice.js`
   - Store emergency rides, available drivers, selected driver state

2. **Screens**:
   - `src/screens/EmergencyRideScreen.js` - Entry point/main menu
   - `src/screens/SelectChildForEmergencyScreen.js` - Child selection
   - `src/screens/EmergencyRideFormScreen.js` - Request form
   - `src/screens/AvailableDriversScreen.js` - List available drivers
   - `src/screens/EmergencyRideStatusScreen.js` - Waiting/tracking status
   - `src/screens/EmergencyRideHistoryScreen.js` - Past emergency rides
   - `src/screens/RateEmergencyDriverScreen.js` - Driver rating

3. **Utils**:
   - `src/utils/emergencyRideHelpers.js` - Form validation, helpers

### Files to Modify (Existing):
1. **src/navigation/MainTabs.js**
   - Add emergency ride screen/stack to navigation
   - Add tab icon or menu entry

2. **src/App.js**
   - May need to add EmergencyRide stack to root Navigator
   - Possibly gate behind subscription check

3. **src/lib/UserSlice.js** (Minor)
   - May add getter for subscription status if not already there

4. **src/store/store.js** (Minor)
   - Add EmergencyRideSlice to reducer

5. **src/utils/socket.js** (Minor)
   - Add listener for emergency-ride-related events if any

6. **src/hooks/useSocket.js** (Minor)
   - Wire any emergency ride socket events

---

## 16. NEW FILES ACTUALLY REQUIRED

**Essential New Files**:
1. `src/lib/EmergencyRideSlice.js` - Redux state for emergency rides
2. `src/screens/EmergencyRideScreen.js` - Entry point/main screen
3. `src/screens/SelectChildForEmergencyScreen.js` - Child picker
4. `src/screens/EmergencyRideFormScreen.js` - Request form
5. `src/screens/AvailableDriversScreen.js` - Driver list
6. `src/screens/EmergencyRideStatusScreen.js` - Status display
7. `src/screens/RateEmergencyDriverScreen.js` - Rating form
8. `src/utils/emergencyRideHelpers.js` - Validation & helpers
9. `src/screens/EmergencyRideHistoryScreen.js` - History (optional but recommended)

**Optional Enhancements**:
- `src/components/EmergencyDriverCard.js` - Reusable driver card
- `src/components/EmergencyRideMap.js` - Tracking map component

---

## 17. BACKEND EMERGENCY RIDE ENDPOINTS (Verified)

**Route File**: `backend/routes/emergencyRides.js`

**Guardian Operations**:
- `POST /emergency-rides/request` - Create emergency ride
- `GET /emergency-rides/:id/available-drivers` - Get available drivers
- `POST /emergency-rides/:id/select-driver` - Select a driver

**Driver Operations**:
- `POST /emergency-rides/:id/accept` - Accept ride
- `POST /emergency-rides/:id/reject` - Reject ride
- `POST /emergency-rides/:id/arriving` - Mark arriving at pickup
- `POST /emergency-rides/:id/pickup` - Mark student picked up
- `POST /emergency-rides/:id/start` - Start trip
- `POST /emergency-rides/:id/complete` - Complete trip

**Shared Operations**:
- `POST /emergency-rides/:id/cancel` - Cancel ride

**Requirements**:
- Authenticate with JWT token
- Require guardian/driver role
- `requireProFeature` middleware enforces subscription

---

## 18. BACKEND MODEL: EmergencyRide

**Key Fields** (from controller):
- `id` - Primary key
- `guardianId` - Guardian who requested
- `studentId` - Child for pickup
- `driverId` - Selected driver
- `originalDriverId` - Student's normal driver
- `vehicleId` - Assigned vehicle
- `status` - Enum (SEARCHING, DRIVER_SELECTED, DRIVER_ACCEPTED, DRIVER_ARRIVING, STUDENT_PICKED_UP, IN_TRANSIT, STUDENT_DROPPED_OFF, COMPLETED, CANCELLED, DRIVER_REJECTED, EXPIRED, NO_DRIVER_AVAILABLE)
- `pickupAddress`, `pickupLatitude`, `pickupLongitude`
- `destinationAddress`, `destinationLatitude`, `destinationLongitude`
- `tripType` - Type of emergency
- `emergencyReason` - Description
- `requestedPickupTime` - Desired pickup
- `specialInstructions` - Additional notes
- `price`, `currency` - Cost
- `rating`, `ratingComment` - Driver rating
- Timestamps: `createdAt`, `updatedAt`

---

## 19. INTEGRATION STRATEGY

**Phase 13 Implementation Roadmap**:

### Step 1: Entry Point & Navigation
- Add EmergencyRide stack to MainTabs or root Navigator
- Button/Tab to launch Emergency Ride feature
- PRO badge to indicate feature

### Step 2: Child Selection
- Create SelectChildForEmergencyScreen
- Reuse existing student list from Redux
- Validate guardian ownership

### Step 3: Request Form
- Create EmergencyRideFormScreen
- Collect all required fields
- Validate before submission

### Step 4: Create Ride & Available Drivers
- Call `/emergency-rides/request` endpoint
- Fetch available drivers via `/emergency-rides/:id/available-drivers`
- Display driver cards

### Step 5: Driver Selection & Waiting
- Guardian selects driver
- Call `/emergency-rides/:id/select-driver`
- Show waiting status with selected driver

### Step 6: Real-Time Status
- Listen for status updates (Socket.io)
- Update UI as driver accepts/rejects

### Step 7: Live Tracking
- Use existing Mapbox integration
- Track emergency vehicle location

### Step 8: History & Rating
- Store past rides in Redux
- Show rating form when ride completes

---

## 20. EXISTING ARCHITECTURE STRENGTHS

✅ Redux state management is well-structured
✅ Socket.io integration already working (reusable)
✅ Theme system consistent and flexible
✅ Mapbox integration ready (can reuse)
✅ Authentication/subscription flow already in place
✅ API interceptor handles token refresh
✅ Navigation structure supports nested stacks
✅ Notification system ready
✅ Real-time tracking UI patterns established

---

## 21. IMPORTANT NOTES FOR IMPLEMENTATION

1. **Do NOT modify** normal driver assignment flow
2. **Do NOT rebuild** the app or change main navigation structure
3. **Do NOT create** separate socket connections
4. **Do NOT assume** frontend subscription check is final (backend enforces)
5. **DO reuse** existing map, tracking, notifications, socket
6. **DO follow** existing theme/styling patterns
7. **DO use** Redux for all state
8. **DO maintain** single socket instance
9. **DO implement** proper loading/error states
10. **DO validate** all form data before submission

---

## READY FOR NEXT STEPS

✅ **Inspection Complete**

**Next Steps** (awaiting approval):
1. Create Redux slice for emergency rides
2. Add navigation entry point
3. Implement child selection screen
4. Implement request form screen
5. Implement driver discovery & selection
6. Implement real-time status & tracking
7. Implement history & rating
8. Test entire flow

**Awaiting your approval to proceed with Step 2 (Entry Point & Navigation).**
