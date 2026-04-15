// When opened via Live Server (port 5500) fetch relative URLs would hit 5500,
// not the Express backend (8080). Detect and prefix all API calls accordingly.
const API_BASE = window.location.port === "5500" ? "http://127.0.0.1:8080" : "";

// ── Pricing (mirrors src/utils/pricing.mjs) ───────────────────────────────────
function getSeatInfo(seatId) {
  return Number(seatId) <= 8
    ? { price: 100, category: "Front Row" }
    : { price: 150, category: "Back Row" };
}

// ── Validation helpers ────────────────────────────────────────────────────────
function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearFieldErr(id) {
  const el = document.getElementById(id);
  el.textContent = "";
  el.classList.add("hidden");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateLoginInputs(email, password) {
  let valid = true;
  clearFieldErr("loginEmailErr");
  clearFieldErr("loginPasswordErr");
  clearFieldErr("loginError");

  if (!email) {
    showFieldErr("loginEmailErr", "Email is required");
    valid = false;
  } else if (!isValidEmail(email)) {
    showFieldErr("loginEmailErr", "Enter a valid email address");
    valid = false;
  }

  if (!password) {
    showFieldErr("loginPasswordErr", "Password is required");
    valid = false;
  }

  return valid;
}

function validateRegisterInputs(name, email, password) {
  let valid = true;
  clearFieldErr("regNameErr");
  clearFieldErr("regEmailErr");
  clearFieldErr("regPasswordErr");
  clearFieldErr("registerError");

  if (!name.trim()) {
    showFieldErr("regNameErr", "Name is required");
    valid = false;
  } else if (name.trim().length < 2) {
    showFieldErr("regNameErr", "Name must be at least 2 characters");
    valid = false;
  } else if (name.trim().length > 100) {
    showFieldErr("regNameErr", "Name must be at most 100 characters");
    valid = false;
  }

  if (!email) {
    showFieldErr("regEmailErr", "Email is required");
    valid = false;
  } else if (!isValidEmail(email)) {
    showFieldErr("regEmailErr", "Enter a valid email address");
    valid = false;
  }

  if (!password) {
    showFieldErr("regPasswordErr", "Password is required");
    valid = false;
  } else if (password.length < 6) {
    showFieldErr("regPasswordErr", "Password must be at least 6 characters");
    valid = false;
  } else if (password.length > 128) {
    showFieldErr("regPasswordErr", "Password must be at most 128 characters");
    valid = false;
  }

  return valid;
}

// Show server error (details array or single message)
function showServerError(elId, data) {
  const el = document.getElementById(elId);
  if (data.details && data.details.length > 0) {
    el.textContent = data.details.join(" • ");
  } else {
    el.textContent = data.message || "Something went wrong";
  }
  el.classList.remove("hidden");
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("token");
const getUser  = () => JSON.parse(localStorage.getItem("user") || "null");

function saveSession(user, token) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function logout() {
  await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
  clearSession();
  location.reload();
}

// ── Panel switching ───────────────────────────────────────────────────────────
const PANELS = ["panelAuth", "panelForgot", "panelReset"];

function showPanel(name) {
  PANELS.forEach((id) => document.getElementById(id).classList.add("hidden"));
  const map = { auth: "panelAuth", forgot: "panelForgot", reset: "panelReset" };
  document.getElementById(map[name] || "panelAuth").classList.remove("hidden");
}

function showTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
  document.getElementById("registerForm").classList.toggle("hidden", isLogin);
  document.getElementById("tabLogin").className =
    `flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`;
  document.getElementById("tabRegister").className =
    `flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`;
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!validateLoginInputs(email, password)) return;

  const res  = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    showServerError("loginError", data);
    return;
  }
  saveSession(data.data.user, data.data.accessToken);
  showApp();
}

async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById("regName").value;
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!validateRegisterInputs(name, email, password)) return;

  const res  = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    showServerError("registerError", data);
    return;
  }
  saveSession(data.data.user, data.data.accessToken);
  showApp();
}

// ── Forgot password ───────────────────────────────────────────────────────────
async function handleForgotPassword(e) {
  e.preventDefault();
  clearFieldErr("forgotEmailErr");
  document.getElementById("forgotError").classList.add("hidden");
  document.getElementById("forgotSuccess").classList.add("hidden");

  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) { showFieldErr("forgotEmailErr", "Email is required"); return; }
  if (!isValidEmail(email)) { showFieldErr("forgotEmailErr", "Enter a valid email address"); return; }

  const btn = document.getElementById("forgotBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";

  const res  = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  const data = await res.json();

  btn.disabled = false;
  btn.textContent = "Send Reset Link";

  if (!res.ok) {
    const el = document.getElementById("forgotError");
    el.textContent = data.message || "Something went wrong";
    el.classList.remove("hidden");
    return;
  }

  const el = document.getElementById("forgotSuccess");
  el.textContent = data.message || "Reset link sent! Check your inbox.";
  el.classList.remove("hidden");
}

// ── Reset password ────────────────────────────────────────────────────────────
async function handleResetPassword(e) {
  e.preventDefault();
  clearFieldErr("resetPasswordErr");
  clearFieldErr("resetConfirmErr");
  document.getElementById("resetError").classList.add("hidden");
  document.getElementById("resetSuccess").classList.add("hidden");

  const password = document.getElementById("resetPassword").value;
  const confirm  = document.getElementById("resetConfirm").value;

  let valid = true;
  if (!password || password.length < 6) {
    showFieldErr("resetPasswordErr", "Password must be at least 6 characters");
    valid = false;
  }
  if (password !== confirm) {
    showFieldErr("resetConfirmErr", "Passwords do not match");
    valid = false;
  }
  if (!valid) return;

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    const el = document.getElementById("resetError");
    el.textContent = "Reset token is missing from the URL.";
    el.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("resetBtn");
  btn.disabled = true;
  btn.textContent = "Resetting…";

  const res  = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();

  btn.disabled = false;
  btn.textContent = "Reset Password";

  if (!res.ok) {
    const el = document.getElementById("resetError");
    el.textContent = data.message || "Reset failed. The link may have expired.";
    el.classList.remove("hidden");
    return;
  }

  const el = document.getElementById("resetSuccess");
  el.textContent = "Password reset! Redirecting to login…";
  el.classList.remove("hidden");

  // Clean the token from the URL then go back to login after a short delay
  setTimeout(() => {
    window.history.replaceState({}, "", window.location.pathname);
    showPanel("auth");
  }, 2000);
}


// ── Cinema layout definition ──────────────────────────────────────────────────
// split = how many seats go on the left side of the aisle
const CINEMA_LAYOUT = [
  { label: "A", ids: [1,  2,  3,  4],             split: 2 },
  { label: "B", ids: [5,  6,  7,  8],             split: 2 },
  { label: "C", ids: [9,  10, 11, 12, 13, 14],    split: 3 },
  { label: "D", ids: [15, 16, 17, 18, 19, 20],    split: 3 },
];

// ── Seat grid ─────────────────────────────────────────────────────────────────
function showApp() {
  document.getElementById("authModal").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("userNameDisplay").textContent = getUser()?.name || "";
  renderSeats();
}

async function renderSeats() {
  const container = document.getElementById("seating");
  container.innerHTML = "";

  const res   = await fetch(`${API_BASE}/api/seats`);
  const seats = (await res.json()).data;
  const seatMap = Object.fromEntries(seats.map(s => [s.id, s]));

  const currentUser = getUser();
  let lastCategory  = null;

  for (const row of CINEMA_LAYOUT) {
    const { price, category } = getSeatInfo(row.ids[0]);

    // Section divider when category changes
    if (category !== lastCategory) {
      lastCategory = category;
      const div = document.createElement("div");
      div.className = "flex items-center gap-3 my-1";
      div.innerHTML = `<div class="flex-1 h-px bg-slate-700/50"></div>
        <span class="text-slate-600 text-[10px] tracking-widest uppercase">${category} · ₹${price}</span>
        <div class="flex-1 h-px bg-slate-700/50"></div>`;
      container.appendChild(div);
    }

    const rowEl = document.createElement("div");
    rowEl.className = "flex items-center justify-center gap-2";

    // Row label (left)
    const lblL = document.createElement("span");
    lblL.className = "text-slate-500 text-xs font-bold w-5 text-right flex-shrink-0";
    lblL.textContent = row.label;
    rowEl.appendChild(lblL);

    // Left seat group
    const leftGroup = document.createElement("div");
    leftGroup.className = "flex gap-2";
    row.ids.slice(0, row.split).forEach(id => leftGroup.appendChild(buildSeat(seatMap[id], currentUser)));
    rowEl.appendChild(leftGroup);

    // Aisle gap
    const aisle = document.createElement("div");
    aisle.className = "w-6 flex-shrink-0";
    rowEl.appendChild(aisle);

    // Right seat group
    const rightGroup = document.createElement("div");
    rightGroup.className = "flex gap-2";
    row.ids.slice(row.split).forEach(id => rightGroup.appendChild(buildSeat(seatMap[id], currentUser)));
    rowEl.appendChild(rightGroup);

    // Row label (right)
    const lblR = document.createElement("span");
    lblR.className = "text-slate-500 text-xs font-bold w-5 text-left flex-shrink-0";
    lblR.textContent = row.label;
    rowEl.appendChild(lblR);

    container.appendChild(rowEl);
  }
}

function buildSeat(seat, currentUser) {
  const el = document.createElement("div");
  const base = "w-14 h-14 rounded-xl flex flex-col items-center justify-center text-sm font-bold transition-all duration-300 select-none relative group cursor-pointer";

  const isMySeat = seat.isbooked && seat.user_id === currentUser?.id;

  if (isMySeat) {
    el.className = `${base} bg-amber-500 text-white border-2 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:bg-amber-400 hover:-translate-y-1 active:scale-95`;
    el.innerHTML = `<span class="text-base font-bold leading-none">${seat.id}</span>
      <span class="text-[9px] uppercase tracking-wide opacity-90 leading-tight">Yours</span>
      <span class="text-[9px] opacity-75 leading-tight">Release</span>`;
    el.addEventListener("click", async () => {
      if (!confirm(`Release seat ${seat.id}? This cannot be undone.`)) return;
      const res = await fetch(`${API_BASE}/api/seats/${seat.id}/book`, {
        method: "DELETE", credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Failed to release seat"); return; }
      alert(`Seat ${seat.id} released.`);
      renderSeats();
    });

  } else if (seat.isbooked) {
    el.className = `${base} bg-rose-500/10 text-rose-500/50 border border-rose-500/20 cursor-not-allowed`;
    el.innerHTML = `<span>${seat.id}</span>
      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl z-50 pointer-events-none">
        ${seat.name}
      </div>`;

  } else {
    const { price, category } = getSeatInfo(seat.id);
    const isFront = category === "Front Row";
    el.className = `${base} ${isFront
      ? "bg-emerald-500 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:shadow-[0_8px_20px_rgba(16,185,129,0.5)]"
      : "bg-cyan-500 border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.3)] hover:bg-cyan-400 hover:shadow-[0_8px_20px_rgba(6,182,212,0.5)]"
    } text-white border-2 hover:-translate-y-1 active:scale-95`;
    el.innerHTML = `<span class="text-base font-bold leading-none">${seat.id}</span>
      <span class="text-[10px] font-semibold opacity-90">₹${price}</span>`;
    el.addEventListener("click", async () => {
      const { price: p, category: cat } = getSeatInfo(seat.id);
      if (!confirm(`Book seat ${seat.id} (${cat} – ₹${p})?`)) return;
      const res = await fetch(`${API_BASE}/api/seats/${seat.id}/book`, {
        method: "POST", credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Booking failed"); if (res.status === 401) logout(); return; }
      alert(`Seat ${seat.id} booked!`);
      renderSeats();
    });
  }

  return el;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const _resetToken = new URLSearchParams(window.location.search).get("token");
if (_resetToken) {
  showPanel("reset");           // URL has ?token= → show reset form immediately
} else if (getToken()) {
  showApp();                    // already logged in → go straight to app
}

// Clear field errors as the user types
document.getElementById("loginEmail").addEventListener("input",    () => clearFieldErr("loginEmailErr"));
document.getElementById("loginPassword").addEventListener("input", () => clearFieldErr("loginPasswordErr"));
document.getElementById("regName").addEventListener("input",       () => clearFieldErr("regNameErr"));
document.getElementById("regEmail").addEventListener("input",      () => clearFieldErr("regEmailErr"));
document.getElementById("regPassword").addEventListener("input",   () => clearFieldErr("regPasswordErr"));
