/**
 * RideWave — script.js
 * Complete ride-booking app logic using Vanilla JS + localStorage
 * ---------------------------------------------------------------
 * Sections:
 *  1. Constants & State
 *  2. Utility Helpers
 *  3. Auth (Login / Signup)
 *  4. Dashboard Routing
 *  5. Book Ride Logic
 *  6. Fare Calculation
 *  7. Confirm Modal
 *  8. Ride Tracker (status simulation)
 *  9. Driver Panel Logic
 * 10. Ride History
 * 11. Profile
 * 12. Init
 */

/* ============================================================
   1. CONSTANTS & STATE
   ============================================================ */

// Fare rates (₹ per km)
const FARE_RATES = { bike: 8, auto: 14, cab: 18, premium: 28 };
// Base fares
const BASE_FARES = { bike: 20, auto: 35, cab: 50, premium: 100 };

// Simulated driver names pool
const DRIVER_NAMES = ['Rahul Sharma', 'Amit Kumar', 'Priya Singh', 'Deepak Verma', 'Sunita Rao', 'Vikram Patel'];
const VEHICLE_PLATES = ['DL 3C AB 1234', 'UP 16 GH 5678', 'MH 12 CD 9012', 'KA 01 EF 3456'];

// App state
let currentUser   = null;   // Logged-in user object
let currentRide   = null;   // Active ride booking object
let currentRating = 0;      // Star rating value
let rideStatusInterval = null;  // Interval for status simulation
let driverAcceptTimeout = null; // Timeout for auto-reject simulation
let activeDriverRide    = null; // Driver's current ride
let driverRideStep      = 0;    // Driver ride progress step (0-2)

/* ============================================================
   2. UTILITY HELPERS
   ============================================================ */

/**
 * Show a toast notification
 * @param {string} msg   - Message text
 * @param {string} type  - 'success' | 'error' | 'info'
 */
function showToast(msg, type = 'success') {
  const toast   = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const icon    = toast.querySelector('.toast-icon');

  toastMsg.textContent = msg;
  icon.className = 'toast-icon fa-solid ' + (
    type === 'error'   ? 'fa-circle-xmark'  :
    type === 'info'    ? 'fa-circle-info'   :
                         'fa-circle-check'
  );
  icon.style.color = type === 'error' ? '#EF4444' : type === 'info' ? '#F59E0B' : '#10B981';

  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 3000);
}

/**
 * Show / hide a loading overlay with custom message
 */
function showLoading(text = 'Processing...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

/**
 * Open / close a generic modal
 */
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

/** Toggle password visibility */
function togglePw(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    iconEl.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    iconEl.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

/** Generate initials from a full name */
function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Format a timestamp into readable date/time */
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Set an error message for a field */
function setError(id, msg) { document.getElementById(id).textContent = msg; }
function clearError(id)    { document.getElementById(id).textContent = ''; }

/** Email validation regex */
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

/** Get all stored users */
function getUsers()       { return JSON.parse(localStorage.getItem('rw_users')   || '[]'); }
/** Get all stored rides */
function getRides()       { return JSON.parse(localStorage.getItem('rw_rides')   || '[]'); }
/** Save rides array */
function saveRides(rides) { localStorage.setItem('rw_rides', JSON.stringify(rides)); }

/* ============================================================
   3. AUTH — LOGIN / SIGNUP
   ============================================================ */

/** Switch between Login and Signup tabs */
function switchAuthTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden',  tab !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('loginTab').classList.toggle('active',   tab === 'login');
  document.getElementById('signupTab').classList.toggle('active',  tab === 'signup');
}

/** Login form submit */
document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  let valid = true;

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const role     = document.querySelector('input[name="loginRole"]:checked').value;

  // Validate
  if (!isValidEmail(email)) { setError('loginEmailErr', 'Enter a valid email address'); valid = false; }
  else clearError('loginEmailErr');

  if (password.length < 6) { setError('loginPasswordErr', 'Password must be at least 6 characters'); valid = false; }
  else clearError('loginPasswordErr');

  if (!valid) return;

  // Find user in localStorage (or create guest if none)
  const users = getUsers();
  let user = users.find(u => u.email === email && u.role === role);

  if (!user) {
    // Auto-create user on first login (demo convenience)
    user = { name: email.split('@')[0], email, role, phone: '+91 9999999999', joined: Date.now() };
    users.push(user);
    localStorage.setItem('rw_users', JSON.stringify(users));
  }

  showLoading('Signing you in...');
  setTimeout(() => {
    hideLoading();
    currentUser = user;
    localStorage.setItem('rw_currentUser', JSON.stringify(user));
    enterDashboard(user.role);
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`);
  }, 1200);
});

/** Signup form submit */
document.getElementById('signupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  let valid = true;

  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const phone    = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;
  const role     = document.querySelector('input[name="signupRole"]:checked').value;

  // Validate each field
  if (name.length < 2) { setError('signupNameErr', 'Enter your full name'); valid = false; }
  else clearError('signupNameErr');

  if (!isValidEmail(email)) { setError('signupEmailErr', 'Enter a valid email address'); valid = false; }
  else clearError('signupEmailErr');

  if (!/^\+?\d{10,13}$/.test(phone.replace(/\s/g, ''))) { setError('signupPhoneErr', 'Enter a valid phone number'); valid = false; }
  else clearError('signupPhoneErr');

  if (password.length < 6) { setError('signupPasswordErr', 'Password must be at least 6 characters'); valid = false; }
  else clearError('signupPasswordErr');

  if (password !== confirm) { setError('signupConfirmErr', 'Passwords do not match'); valid = false; }
  else clearError('signupConfirmErr');

  if (!valid) return;

  // Check duplicate email
  const users = getUsers();
  if (users.find(u => u.email === email && u.role === role)) {
    setError('signupEmailErr', 'Account already exists. Please login.');
    return;
  }

  const newUser = { name, email, phone, role, joined: Date.now() };
  users.push(newUser);
  localStorage.setItem('rw_users', JSON.stringify(users));

  showLoading('Creating your account...');
  setTimeout(() => {
    hideLoading();
    currentUser = newUser;
    localStorage.setItem('rw_currentUser', JSON.stringify(newUser));
    enterDashboard(role);
    showToast(`Account created! Welcome, ${name.split(' ')[0]}! 🎉`);
  }, 1500);
});

/** Logout */
function logout() {
  clearInterval(rideStatusInterval);
  clearTimeout(driverAcceptTimeout);
  currentUser = null;
  currentRide = null;
  localStorage.removeItem('rw_currentUser');

  document.getElementById('userDashboard').classList.add('hidden');
  document.getElementById('driverDashboard').classList.add('hidden');
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('loginEmail').value    = '';
  document.getElementById('loginPassword').value = '';
  showToast('Signed out successfully', 'info');
}

/* ============================================================
   4. DASHBOARD ROUTING
   ============================================================ */

/** Enter the appropriate dashboard based on role */
function enterDashboard(role) {
  document.getElementById('authSection').classList.add('hidden');

  if (role === 'driver') {
    document.getElementById('driverDashboard').classList.remove('hidden');
    initDriverDashboard();
  } else {
    document.getElementById('userDashboard').classList.remove('hidden');
    initUserDashboard();
  }
}

/** Show a page inside user dashboard (Book/History/Profile) */
function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('#userDashboard .page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });

  // Show target
  const target = document.getElementById(pageId);
  target.classList.remove('hidden');
  target.classList.add('active');

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navMap = { bookRide: 'navBook', rideHistory: 'navHistory', userProfile: 'navProfile' };
  const navBtn = document.getElementById(navMap[pageId]);
  if (navBtn) navBtn.classList.add('active');

  // Load content per page
  if (pageId === 'rideHistory') renderHistory();
  if (pageId === 'userProfile') renderProfile();
}

/* ============================================================
   5. BOOK RIDE LOGIC
   ============================================================ */

/** Initialize user dashboard */
function initUserDashboard() {
  document.getElementById('userGreeting').textContent =
    'Good ' + getTimeOfDay() + ', ' + currentUser.name.split(' ')[0] + '! 👋';
  showPage('bookRide');
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/** Fill a location field with a quick-pick value */
function fillLocation(field, value) {
  document.getElementById(field).value = value;
  updateFareEstimate();
  showToast(`${field === 'pickup' ? 'Pickup' : 'Drop'} set to ${value}`, 'info');
}

/** Select ride type card */
function selectRideType(el) {
  document.querySelectorAll('.ride-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  updateFareEstimate();
}

/** Update fare estimate whenever pickup/drop changes */
function updateFareEstimate() {
  const pickup = document.getElementById('pickup').value.trim();
  const drop   = document.getElementById('drop').value.trim();

  if (!pickup || !drop) {
    // Reset stats
    document.getElementById('estDistance').textContent = '-- km';
    document.getElementById('estTime').textContent     = '-- min';
    document.getElementById('estFare').textContent     = '₹--';
    ['bike','auto','cab','premium'].forEach(t => {
      document.getElementById(t + 'Fare').textContent = '₹--';
    });
    return;
  }

  // Pseudo-distance based on string lengths (demo logic)
  const dist = estimateDistance(pickup, drop);
  const time = Math.round(dist * 2.8 + Math.random() * 5);

  document.getElementById('estDistance').textContent = dist.toFixed(1) + ' km';
  document.getElementById('estTime').textContent     = time + ' min';

  // Update all ride type fares
  const selected = document.querySelector('.ride-type-card.selected')?.dataset.type || 'bike';
  ['bike','auto','cab','premium'].forEach(type => {
    const fare = calcFare(type, dist);
    document.getElementById(type + 'Fare').textContent = '₹' + fare;
  });

  const selectedFare = calcFare(selected, dist);
  document.getElementById('estFare').textContent = '₹' + selectedFare;
}

/**
 * Pseudo-distance estimator from two location strings
 * Uses char codes to generate a consistent, reproducible number
 */
function estimateDistance(a, b) {
  const hash = str => str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const raw  = Math.abs(hash(a) - hash(b)) % 40 + 3;   // 3–43 km
  return parseFloat(raw.toFixed(1));
}

/* ============================================================
   6. FARE CALCULATION
   ============================================================ */

/**
 * Calculate fare for a given type and distance
 * Formula: base + rate × distance + surge (random 0–20%)
 */
function calcFare(type, distKm) {
  const base  = BASE_FARES[type]  || 20;
  const rate  = FARE_RATES[type]  || 10;
  const surge = 1 + Math.random() * 0.2;  // 0–20% surge
  return Math.round((base + rate * distKm) * surge);
}

/* ============================================================
   7. CONFIRM MODAL
   ============================================================ */

/** Open the booking confirmation modal */
function openConfirmModal() {
  const pickup = document.getElementById('pickup').value.trim();
  const drop   = document.getElementById('drop').value.trim();

  // Validate inputs
  let valid = true;
  if (!pickup) { setError('pickupErr', 'Enter a pickup location'); valid = false; }
  else clearError('pickupErr');
  if (!drop) { setError('dropErr', 'Enter a drop location'); valid = false; }
  else clearError('dropErr');
  if (pickup && drop && pickup.toLowerCase() === drop.toLowerCase()) {
    setError('dropErr', 'Pickup and drop cannot be the same');
    valid = false;
  }
  if (!valid) return;

  // Gather booking data
  const type    = document.querySelector('.ride-type-card.selected')?.dataset.type || 'bike';
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
  const dist    = estimateDistance(pickup, drop);
  const fare    = calcFare(type, dist);
  const time    = Math.round(dist * 2.8 + 5);

  // Populate modal
  document.getElementById('confirmPickup').textContent  = pickup;
  document.getElementById('confirmDrop').textContent    = drop;
  document.getElementById('confirmType').textContent    = type.charAt(0).toUpperCase() + type.slice(1);
  document.getElementById('confirmDist').textContent    = dist.toFixed(1) + ' km';
  document.getElementById('confirmTime').textContent    = time + ' min';
  document.getElementById('confirmPayment').textContent = payment.toUpperCase();
  document.getElementById('confirmFare').textContent    = '₹' + fare;

  // Store pending ride in state
  currentRide = { pickup, drop, type, payment, dist, fare, time, riderName: currentUser.name };

  openModal('confirmModal');
}

/** User confirms booking — save ride and start simulation */
function confirmBooking() {
  closeModal('confirmModal');

  const ride = {
    ...currentRide,
    id       : 'R' + Date.now(),
    userId   : currentUser.email,
    status   : 'requested',
    timestamp: Date.now(),
    driver   : null,
    rating   : null,
  };

  // Save to localStorage
  const rides = getRides();
  rides.unshift(ride);
  saveRides(rides);
  currentRide = ride;

  showLoading('Booking your ride...');
  setTimeout(() => {
    hideLoading();
    openRideTracker(ride);
    simulateRideStatus(ride);
  }, 1000);
}

/* ============================================================
   8. RIDE TRACKER & STATUS SIMULATION
   ============================================================ */

const TRACKER_STEPS = [
  { id: 1, msg: 'Searching for nearby drivers...',    msgClass: 'info'  },
  { id: 2, msg: 'Driver found! On the way to you.',  msgClass: 'success' },
  { id: 3, msg: 'Driver is approaching your pickup!', msgClass: 'success' },
  { id: 4, msg: 'Ride completed! Hope you enjoyed.', msgClass: 'done'  },
];

/** Open ride tracker overlay with ride data */
function openRideTracker(ride) {
  const driver = DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)];
  const plate  = VEHICLE_PLATES[Math.floor(Math.random() * VEHICLE_PLATES.length)];
  ride.driver  = driver;
  ride.plate   = plate;

  // Set initial tracker content
  document.getElementById('trackerPickup').textContent      = ride.pickup;
  document.getElementById('trackerDrop').textContent        = ride.drop;
  document.getElementById('trackerFare').textContent        = '₹' + ride.fare;
  document.getElementById('trackerFareLabel').textContent   = 'Estimated Fare';
  document.getElementById('trackerDriverName').textContent  = 'Finding driver...';
  document.getElementById('trackerVehicle').textContent     = '';
  document.getElementById('trackerMsgText').textContent     = TRACKER_STEPS[0].msg;

  // Set driver avatar placeholder initially
  document.getElementById('trackerDriverAvatar').textContent = '?';
  document.getElementById('trackerDriverAvatar').style.background = '#9CA3AF';

  // Reset status steps
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById('ts' + i);
    step.classList.remove('active', 'done');
  }
  for (let i = 1; i <= 3; i++) {
    document.getElementById('tsl' + i)?.classList.remove('done');
  }
  document.getElementById('ts1').classList.add('active');

  document.getElementById('cancelRideBtn').classList.remove('hidden');
  document.getElementById('rideTrackerOverlay').classList.remove('hidden');
}

/** Close tracker overlay */
function closeTracker() {
  document.getElementById('rideTrackerOverlay').classList.add('hidden');
  clearInterval(rideStatusInterval);
}

/** Cancel current ride */
function cancelRide() {
  clearInterval(rideStatusInterval);
  closeTracker();

  // Update ride status in storage
  const rides = getRides();
  const idx   = rides.findIndex(r => r.id === currentRide.id);
  if (idx !== -1) { rides[idx].status = 'cancelled'; saveRides(rides); }

  showToast('Ride cancelled', 'error');
  currentRide = null;
}

/**
 * Simulate ride progression: Requested → Accepted → En Route → Completed
 * Each step takes a few seconds (demo timing)
 */
function simulateRideStatus(ride) {
  const delays = [3000, 5000, 8000, 6000]; // ms per step
  let step     = 0;

  function advanceStep() {
    step++;
    if (step > 3) return;

    const ts = TRACKER_STEPS[step];

    // Update status bar
    for (let i = 1; i <= step; i++) {
      document.getElementById('ts' + i)?.classList.replace('active', 'done') ||
      document.getElementById('ts' + i)?.classList.add('done');
      if (i < 4) document.getElementById('tsl' + i)?.classList.add('done');
    }
    const next = document.getElementById('ts' + (step + 1));
    if (next) next.classList.add('active');

    // Update message
    document.getElementById('trackerMsgText').textContent = ts.msg;

    // Step 1 → driver accepted
    if (step === 1) {
      const driver = ride.driver;
      document.getElementById('trackerDriverName').textContent  = driver;
      document.getElementById('trackerVehicle').textContent     = ride.type.toUpperCase() + ' · ' + ride.plate;
      document.getElementById('trackerDriverAvatar').textContent = initials(driver);
      document.getElementById('trackerDriverAvatar').style.background = 'var(--primary)';
    }

    // Step 3 → completed
    if (step === 3) {
      document.getElementById('cancelRideBtn').classList.add('hidden');
      document.getElementById('trackerFareLabel').textContent = 'Final Fare';

      // Update ride in storage
      const rides = getRides();
      const idx   = rides.findIndex(r => r.id === ride.id);
      if (idx !== -1) { rides[idx].status = 'completed'; rides[idx].driver = ride.driver; saveRides(rides); }

      // Close tracker and open rating after delay
      setTimeout(() => {
        closeTracker();
        openRatingModal(ride);
      }, 2500);
      return;
    }

    rideStatusInterval = setTimeout(advanceStep, delays[step]);
  }

  rideStatusInterval = setTimeout(advanceStep, delays[0]);
}

/* ============================================================
   RATING MODAL
   ============================================================ */

function openRatingModal(ride) {
  currentRating = 0;
  document.getElementById('ratingDriverName').textContent = ride.driver || 'Your Driver';
  document.getElementById('ratingAvatar').textContent     = initials(ride.driver || 'D');

  // Reset stars
  document.querySelectorAll('#starRating i').forEach(s => s.classList.remove('lit'));
  document.getElementById('ratingLabel').textContent  = 'Tap to rate';
  document.getElementById('ratingComment').value      = '';

  openModal('ratingModal');
  showToast('Ride completed! Please rate your driver.', 'info');
}

function setRating(val) {
  currentRating = val;
  const labels  = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent!'];
  document.getElementById('ratingLabel').textContent = labels[val];
  document.querySelectorAll('#starRating i').forEach((s, i) => {
    s.classList.toggle('lit', i < val);
  });
}

function submitRating() {
  if (currentRating === 0) { showToast('Please select a rating', 'error'); return; }

  // Save rating to the last completed ride
  const rides = getRides();
  const last  = rides.find(r => r.userId === currentUser.email && r.status === 'completed' && !r.rating);
  if (last) { last.rating = currentRating; saveRides(rides); }

  closeModal('ratingModal');
  showToast(`Thanks for rating! You gave ${currentRating} ⭐`, 'success');

  // Reset form
  document.getElementById('pickup').value = '';
  document.getElementById('drop').value   = '';
  updateFareEstimate();
  currentRide = null;
}

/* ============================================================
   9. DRIVER PANEL LOGIC
   ============================================================ */

/** Initialize driver dashboard */
function initDriverDashboard() {
  renderDriverStats();
  updateDriverHistory();
}

/** Toggle driver online/offline */
function toggleDriverOnline() {
  const isOnline = document.getElementById('driverOnline').checked;
  document.getElementById('onlineLabel').textContent      = isOnline ? 'Online'  : 'Offline';
  document.getElementById('driverMapStatus').textContent  = isOnline ? 'Scanning for rides...' : 'Waiting for rides...';
  document.getElementById('driverIdle').classList.toggle('hidden', isOnline);

  if (isOnline) {
    showToast('You are now online and receiving rides!', 'success');
    // Auto-simulate an incoming ride after a few seconds
    driverAcceptTimeout = setTimeout(simulateIncomingRide, 4000 + Math.random() * 3000);
  } else {
    clearTimeout(driverAcceptTimeout);
    hideIncomingRide();
    showToast('You are now offline', 'info');
  }
}

/** Simulate an incoming ride request for driver */
function simulateIncomingRide() {
  // Pick a random recent user ride to show
  const rides = getRides().filter(r => r.status === 'requested' || r.status === 'completed');

  // Create a fake incoming ride
  const fakePickup = ['Connaught Place', 'Lajpat Nagar', 'Dwarka Sec 21', 'Rohini East', 'Vasant Kunj'][Math.floor(Math.random()*5)];
  const fakeDrop   = ['IGI Airport Terminal 3', 'Noida Sec 62', 'Cyber City Gurugram', 'Saket Select City', 'Nehru Place'][Math.floor(Math.random()*5)];
  const fakeDist   = (Math.random() * 20 + 4).toFixed(1);
  const fakeType   = ['bike','auto','cab','premium'][Math.floor(Math.random()*4)];
  const fakeFare   = calcFare(fakeType, parseFloat(fakeDist));
  const fakeRider  = DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)];
  const fakePay    = ['CASH','UPI','CARD'][Math.floor(Math.random()*3)];

  activeDriverRide = { pickup: fakePickup, drop: fakeDrop, dist: fakeDist, fare: fakeFare, rider: fakeRider, payment: fakePay };

  // Populate UI
  document.getElementById('driverPickup').textContent  = fakePickup;
  document.getElementById('driverDrop').textContent    = fakeDrop;
  document.getElementById('driverDist').textContent    = fakeDist + ' km';
  document.getElementById('driverFare').textContent    = '₹' + fakeFare;
  document.getElementById('riderNameDriver').textContent = fakeRider;
  document.getElementById('riderAvatarDriver').textContent = initials(fakeRider);
  document.getElementById('driverPayment').textContent = fakePay;

  // Reset countdown bar
  const fill = document.getElementById('countdownFill');
  fill.style.animation = 'none';
  requestAnimationFrame(() => {
    fill.style.animation = 'countdown 15s linear forwards';
  });

  document.getElementById('incomingRidePanel').classList.remove('hidden');
  document.getElementById('driverIdle').classList.add('hidden');

  // Auto-reject if driver doesn't respond in 15s
  driverAcceptTimeout = setTimeout(() => {
    if (document.getElementById('incomingRidePanel').classList.contains('hidden')) return;
    driverAction('reject');
  }, 15000);
}

/** Driver accepts or rejects a ride */
function driverAction(action) {
  clearTimeout(driverAcceptTimeout);
  document.getElementById('incomingRidePanel').classList.add('hidden');

  if (action === 'reject') {
    showToast('Ride declined', 'info');
    // Show another ride after a delay if still online
    if (document.getElementById('driverOnline').checked) {
      driverAcceptTimeout = setTimeout(simulateIncomingRide, 5000 + Math.random() * 5000);
    }
  } else {
    // Accept
    showToast('Ride accepted! Head to pickup point.', 'success');
    driverRideStep = 0;
    document.getElementById('activePickup').textContent = activeDriverRide.pickup;
    document.getElementById('activeDrop').textContent   = activeDriverRide.drop;
    document.getElementById('activeRidePanel').classList.remove('hidden');
    document.getElementById('driverMapStatus').textContent = 'En route to ' + activeDriverRide.pickup;

    // Reset status track
    document.querySelectorAll('.rst-step').forEach((s, i) => {
      s.classList.toggle('active', i === 0);
      s.classList.remove('done');
    });
    document.querySelectorAll('.rst-line').forEach(l => l.classList.remove('active'));
    document.getElementById('activeRideBtn').textContent = 'Arrived at Pickup';
  }
}

/** Advance driver's ride status (en route → picked up → dropped) */
function advanceRideStatus() {
  driverRideStep++;

  const steps   = document.querySelectorAll('.rst-step');
  const lines   = document.querySelectorAll('.rst-line');
  const btn     = document.getElementById('activeRideBtn');

  // Mark previous step as done, next as active
  steps.forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i < driverRideStep)    s.classList.add('done');
    if (i === driverRideStep)  s.classList.add('active');
  });
  lines.forEach((l, i) => l.classList.toggle('active', i < driverRideStep));

  if (driverRideStep === 1) {
    btn.textContent = 'Start Ride';
    document.getElementById('driverMapStatus').textContent = 'Rider picked up!';
    showToast('Rider picked up!', 'success');
  } else if (driverRideStep === 2) {
    btn.textContent = 'Complete Ride';
    document.getElementById('driverMapStatus').textContent = 'En route to ' + activeDriverRide.drop;
    showToast('Ride started!', 'success');
  } else {
    // Completed
    document.getElementById('activeRidePanel').classList.add('hidden');
    showToast('Ride completed! ₹' + activeDriverRide.fare + ' earned 🎉', 'success');
    addDriverTrip(activeDriverRide);
    activeDriverRide = null;

    // Show another ride soon
    if (document.getElementById('driverOnline').checked) {
      driverAcceptTimeout = setTimeout(simulateIncomingRide, 5000);
    }
  }
}

function hideIncomingRide() {
  document.getElementById('incomingRidePanel').classList.add('hidden');
  document.getElementById('activeRidePanel').classList.add('hidden');
}

/** Render driver stats from localStorage */
function renderDriverStats() {
  const driverRides = JSON.parse(localStorage.getItem('rw_driverRides') || '[]');
  const totalEarnings = driverRides.reduce((s, r) => s + (r.fare || 0), 0);
  document.getElementById('driverEarnings').textContent = '₹' + totalEarnings;
  document.getElementById('driverTrips').textContent    = driverRides.length;
}

/** Add a completed driver trip */
function addDriverTrip(ride) {
  const driverRides = JSON.parse(localStorage.getItem('rw_driverRides') || '[]');
  driverRides.unshift({ ...ride, ts: Date.now() });
  localStorage.setItem('rw_driverRides', JSON.stringify(driverRides));
  renderDriverStats();
  updateDriverHistory();
}

/** Render driver's recent trips */
function updateDriverHistory() {
  const driverRides = JSON.parse(localStorage.getItem('rw_driverRides') || '[]');
  const container   = document.getElementById('driverHistory');

  if (driverRides.length === 0) {
    container.innerHTML = '<div class="empty-small"><i class="fa-solid fa-inbox"></i> No trips yet today</div>';
    return;
  }

  container.innerHTML = driverRides.slice(0, 5).map(r => `
    <div class="driver-hist-item">
      <div class="dhi-locs">
        ${r.pickup} → ${r.drop}
        <span>${r.rider ? r.rider + ' · ' : ''}${formatDate(r.ts || Date.now())}</span>
      </div>
      <span class="dhi-fare">₹${r.fare}</span>
    </div>
  `).join('');
}

/* ============================================================
   10. RIDE HISTORY
   ============================================================ */

let currentHistoryFilter = 'all';

/** Render ride history list */
function renderHistory() {
  const allRides    = getRides().filter(r => r.userId === currentUser.email);
  const filtered    = currentHistoryFilter === 'all'
    ? allRides
    : allRides.filter(r => r.status === currentHistoryFilter);

  const container   = document.getElementById('historyList');
  const emptyState  = document.getElementById('emptyHistory');

  // Update summary stats
  const completed   = allRides.filter(r => r.status === 'completed');
  document.getElementById('totalRides').textContent = allRides.length;
  document.getElementById('totalSpent').textContent = '₹' + completed.reduce((s, r) => s + (r.fare || 0), 0);
  document.getElementById('totalKm').textContent    = completed.reduce((s, r) => s + parseFloat(r.dist || 0), 0).toFixed(1) + ' km';

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // Render ride cards
  container.innerHTML = filtered.map(ride => {
    const statusClass = ride.status === 'completed' ? 'completed' : 'cancelled';
    const typeIcon    = { bike: 'fa-motorcycle', auto: 'fa-taxi', cab: 'fa-car-side', premium: 'fa-star' }[ride.type] || 'fa-car';
    const stars       = ride.rating ? '★'.repeat(ride.rating) + '☆'.repeat(5 - ride.rating) : '';

    return `
      <div class="history-item">
        <div class="hist-icon ${statusClass}">
          <i class="fa-solid ${typeIcon}"></i>
        </div>
        <div class="hist-locs">
          <div class="hist-loc-row">
            <i class="fa-solid fa-location-dot" style="color:var(--primary)"></i>
            <span>${ride.pickup}</span>
          </div>
          <div class="hist-loc-row">
            <i class="fa-solid fa-flag-checkered" style="color:var(--secondary)"></i>
            <span>${ride.drop}</span>
          </div>
          <div class="hist-loc-row" style="margin-top:4px">
            <i class="fa-solid fa-road"></i>
            <span style="font-weight:400;color:var(--text-muted)">${parseFloat(ride.dist).toFixed(1)} km · ${ride.time} min · ${(ride.type||'').toUpperCase()}</span>
          </div>
          ${stars ? `<div style="color:#F59E0B;font-size:.85rem;margin-top:2px">${stars}</div>` : ''}
        </div>
        <div class="hist-meta">
          <span class="hist-fare">₹${ride.fare}</span>
          <span class="hist-status ${statusClass}">${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}</span>
          <span class="hist-date">${formatDate(ride.timestamp)}</span>
          <span style="font-size:.75rem;color:var(--text-light)">${ride.payment ? ride.payment.toUpperCase() : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

/** Filter ride history */
function filterHistory(type, btn) {
  currentHistoryFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistory();
}

/** Clear all history for current user */
function clearHistory() {
  if (!confirm('Clear all your ride history?')) return;
  const rides = getRides().filter(r => r.userId !== currentUser.email);
  saveRides(rides);
  renderHistory();
  showToast('History cleared', 'info');
}

/* ============================================================
   11. PROFILE
   ============================================================ */

function renderProfile() {
  const u = currentUser;
  const ini = initials(u.name);

  document.getElementById('avatarCircle').textContent  = ini;
  document.getElementById('profileName').textContent   = u.name;
  document.getElementById('profileEmail').textContent  = u.email;
  document.getElementById('detailName').textContent    = u.name;
  document.getElementById('detailEmail').textContent   = u.email;
  document.getElementById('detailPhone').textContent   = u.phone || '+91 XXXXXXXXXX';
  document.getElementById('detailJoined').textContent  = formatDate(u.joined || Date.now());
}

/* ============================================================
   12. INIT — Run on page load
   ============================================================ */

(function init() {
  // Check if a user session exists
  const saved = localStorage.getItem('rw_currentUser');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      document.getElementById('authSection').classList.add('hidden');
      enterDashboard(currentUser.role);
    } catch {
      localStorage.removeItem('rw_currentUser');
    }
  }
})();
