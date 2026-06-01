// Aegis Task Client-Side Application Engine

// Global State
const state = {
    token: localStorage.getItem("aegis_token") || null,
    role: localStorage.getItem("aegis_role") || null,
    email: localStorage.getItem("aegis_email") || null,
    name: localStorage.getItem("aegis_name") || null,
    tasks: [],
    users: [],
    systemHealthy: false,
    adminViewAll: false
};

const API_BASE = "/api/v1";

// DOM Elements
const elements = {
    connectionBadge: document.getElementById("connection-badge"),
    userBadge: document.getElementById("user-profile-badge"),
    userName: document.getElementById("user-display-name"),
    userRole: document.getElementById("user-display-role"),
    logoutBtn: document.getElementById("logout-btn"),
    
    authSection: document.getElementById("auth-section"),
    dashboardSection: document.getElementById("dashboard-section"),
    adminPanel: document.getElementById("admin-panel"),
    adminUsersTable: document.getElementById("admin-users-table-body"),
    
    // Forms
    loginForm: document.getElementById("login-form"),
    registerForm: document.getElementById("register-form"),
    tabLogin: document.getElementById("tab-login"),
    tabRegister: document.getElementById("tab-register"),
    
    // Filters & Search
    searchInput: document.getElementById("search-input"),
    filterStatus: document.getElementById("filter-status"),
    filterPriority: document.getElementById("filter-priority"),
    
    // Stats
    countTotal: document.getElementById("count-total"),
    countCompleted: document.getElementById("count-completed"),
    roleBadgeText: document.getElementById("user-role-badge-text"),
    statPending: document.getElementById("stat-pending"),
    statProgress: document.getElementById("stat-progress"),
    statCompleted: document.getElementById("stat-completed"),
    
    // Tasks list
    tasksGrid: document.getElementById("tasks-grid"),
    workspaceTitle: document.getElementById("workspace-title"),
    filteredCount: document.getElementById("filtered-count"),
    
    // Modal
    taskModal: document.getElementById("task-modal"),
    taskForm: document.getElementById("task-form"),
    modalTitle: document.getElementById("modal-title"),
    modalSubmitBtn: document.getElementById("modal-submit-btn"),
    
    // API Inspector
    inspectorBody: document.getElementById("api-inspector-body"),
    inspectorChevron: document.getElementById("inspector-chevron"),
    reqMethod: document.getElementById("request-method"),
    reqJson: document.getElementById("request-json"),
    resStatus: document.getElementById("response-status"),
    resJson: document.getElementById("response-json")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // Check API server status immediately
    checkServerStatus();
    setInterval(checkServerStatus, 15000); // Check health every 15s
    
    // Setup UI according to Auth State
    if (state.token) {
        showDashboard();
    } else {
        showAuth();
    }
    
    // Set up listeners
    elements.logoutBtn.addEventListener("click", handleLogout);
});

// --- API INSPECTOR UTILITY ---
function updateInspector(method, url, requestBody, status, responseBody) {
    elements.reqMethod.textContent = method;
    elements.reqMethod.className = `method-tag tag-${method.toLowerCase()}`;
    
    // Format JSON safely
    let reqString = typeof requestBody === 'object' ? JSON.stringify(requestBody, null, 2) : (requestBody || "{}");
    elements.reqJson.textContent = `URL: ${url}\n\n${reqString}`;
    
    elements.resStatus.textContent = status;
    if (parseInt(status) >= 200 && parseInt(status) < 300) {
        elements.resStatus.style.color = "var(--success)";
    } else {
        elements.resStatus.style.color = "var(--danger)";
    }
    
    let resString = typeof responseBody === 'object' ? JSON.stringify(responseBody, null, 2) : (responseBody || "{}");
    elements.resJson.textContent = resString;
}

function toggleApiInspector() {
    const isCollapsed = elements.inspectorBody.classList.contains("collapsed");
    if (isCollapsed) {
        elements.inspectorBody.classList.remove("collapsed");
        elements.inspectorChevron.className = "fa-solid fa-chevron-down";
    } else {
        elements.inspectorBody.classList.add("collapsed");
        elements.inspectorChevron.className = "fa-solid fa-chevron-up";
    }
}

// --- SYSTEM HEALTH CHECK ---
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        
        if (response.ok && data.status === "online") {
            elements.connectionBadge.className = "badge badge-healthy animate-fade-in";
            elements.connectionBadge.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-text">API Online (DB: ${data.database})</span>
            `;
            state.systemHealthy = true;
        } else {
            setSystemOffline();
        }
    } catch (err) {
        setSystemOffline();
    }
}

function setSystemOffline() {
    elements.connectionBadge.className = "badge badge-unhealthy animate-fade-in";
    elements.connectionBadge.innerHTML = `
        <span class="status-dot animate-pulse"></span>
        <span class="status-text">API Offline</span>
    `;
    state.systemHealthy = false;
}

// --- AUTHENTICATION FLOWS ---
function switchAuthTab(tab) {
    if (tab === "login") {
        elements.tabLogin.classList.add("active");
        elements.tabRegister.classList.remove("active");
        elements.loginForm.classList.remove("hidden");
        elements.registerForm.classList.add("hidden");
    } else {
        elements.tabLogin.classList.remove("active");
        elements.tabRegister.classList.add("active");
        elements.loginForm.classList.add("hidden");
        elements.registerForm.classList.remove("hidden");
    }
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = field.nextElementSibling.firstElementChild;
    if (field.type === "password") {
        field.type = "text";
        icon.className = "fa-regular fa-eye-slash";
    } else {
        field.type = "password";
        icon.className = "fa-regular fa-eye";
    }
}

function fillDemoCredentials(email, password) {
    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = password;
    showToast("Credentials Loaded", `Selected ${email === 'admin@aegis.com' ? 'Admin' : 'Standard User'} preset. Click Sign In!`, "info");
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    // Prepare urlencoded form data (OAuth2 compatible)
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
        });
        
        const data = await response.json();
        updateInspector("POST", `${API_BASE}/auth/login`, { username: email }, response.status, data);
        
        if (response.ok) {
            // Save state
            state.token = data.access_token;
            state.role = data.role;
            state.email = data.user_email;
            state.name = data.user_name || email.split("@")[0];
            
            localStorage.setItem("aegis_token", state.token);
            localStorage.setItem("aegis_role", state.role);
            localStorage.setItem("aegis_email", state.email);
            localStorage.setItem("aegis_name", state.name);
            
            showToast("Access Granted", `Successfully authenticated as ${state.name} (${state.role})`, "success");
            showDashboard();
        } else {
            showToast("Access Denied", data.error || "Authentication failed. Check your password.", "error");
        }
    } catch (err) {
        showToast("Network Error", "Unable to connect to security backend", "error");
        updateInspector("POST", `${API_BASE}/auth/login`, { username: email }, "500", { error: err.message });
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const role = document.getElementById("register-role").value;
    
    const requestPayload = { email, password, full_name: name, role };
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload)
        });
        
        const data = await response.json();
        // Hide password in inspector for privacy
        const inspectPayload = { ...requestPayload, password: "••••••••" };
        updateInspector("POST", `${API_BASE}/auth/register`, inspectPayload, response.status, data);
        
        if (response.ok) {
            showToast("Registration Complete", "Account secured and created successfully. Please login.", "success");
            // Switch back to login
            switchAuthTab("login");
            document.getElementById("login-email").value = email;
            document.getElementById("login-password").value = password;
        } else {
            showToast("Registration Failed", data.error || "Could not complete registration.", "error");
        }
    } catch (err) {
        showToast("Network Error", "Unable to connect to security backend", "error");
        updateInspector("POST", `${API_BASE}/auth/register`, requestPayload, "500", { error: err.message });
    }
}

function handleLogout() {
    state.token = null;
    state.role = null;
    state.email = null;
    state.name = null;
    
    localStorage.removeItem("aegis_token");
    localStorage.removeItem("aegis_role");
    localStorage.removeItem("aegis_email");
    localStorage.removeItem("aegis_name");
    
    showToast("Logged Out", "Vault locks successfully restored. Session cleared.", "info");
    showAuth();
}

// --- INTERFACE PANELS CONTROL ---
function showAuth() {
    elements.authSection.classList.remove("hidden");
    elements.dashboardSection.classList.add("hidden");
    elements.userBadge.classList.add("hidden");
}

function showDashboard() {
    elements.authSection.classList.add("hidden");
    elements.dashboardSection.classList.remove("hidden");
    
    // Update badge details
    elements.userName.textContent = state.name;
    elements.userRole.textContent = state.role;
    elements.userBadge.classList.remove("hidden");
    
    // Change avatar icon if admin vs user
    const avatarIcon = document.getElementById("avatar-icon");
    if (state.role === "admin") {
        avatarIcon.className = "fa-solid fa-user-shield text-accent";
        elements.roleBadgeText.textContent = "Admin Control";
        elements.roleBadgeText.className = "role-badge role-admin";
        elements.adminPanel.classList.remove("hidden");
        // Load Admin Panels
        loadAdminUsersTable();
    } else {
        avatarIcon.className = "fa-solid fa-user text-primary";
        elements.roleBadgeText.textContent = "Standard Vault";
        elements.roleBadgeText.className = "role-badge role-user";
        elements.adminPanel.classList.add("hidden");
    }
    
    // Load CRUD records
    loadTasks();
}

// --- TASK CRUD OPERATIONS (Entity Management) ---
async function loadTasks() {
    const queryParams = state.adminViewAll ? "?all_users=true" : "";
    try {
        const response = await fetch(`${API_BASE}/tasks/${queryParams}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });
        
        const data = await response.json();
        updateInspector("GET", `${API_BASE}/tasks/${queryParams}`, null, response.status, data);
        
        if (response.ok) {
            state.tasks = data;
            filterTasks();
            updateStatCounters();
        } else {
            if (response.status === 401) handleLogout(); // Expired token
            showToast("Database Fetch Error", data.error || "Could not retrieve user tasks.", "error");
        }
    } catch (err) {
        showToast("Network Error", "Unable to pull workspace tasks", "error");
    }
}

function updateStatCounters() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.status === "completed").length;
    const pending = state.tasks.filter(t => t.status === "pending").length;
    const inProgress = state.tasks.filter(t => t.status === "in_progress").length;
    
    elements.countTotal.textContent = total;
    elements.countCompleted.textContent = completed;
    
    elements.statPending.textContent = pending;
    elements.statProgress.textContent = inProgress;
    elements.statCompleted.textContent = completed;
}

function filterTasks() {
    const searchQuery = elements.searchInput.value.toLowerCase();
    const statusFilter = elements.filterStatus.value;
    const priorityFilter = elements.filterPriority.value;
    
    const filtered = state.tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery) || 
                            (task.description && task.description.toLowerCase().includes(searchQuery));
        const matchesStatus = statusFilter === "all" || task.status === statusFilter;
        const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
        
        return matchesSearch && matchesStatus && matchesPriority;
    });
    
    elements.filteredCount.textContent = filtered.length;
    renderTasks(filtered);
}

function renderTasks(taskList) {
    elements.tasksGrid.innerHTML = "";
    
    if (taskList.length === 0) {
        elements.tasksGrid.innerHTML = `
            <div class="no-tasks-state">
                <div class="empty-icon">
                    <i class="fa-regular fa-folder-open animate-pulse"></i>
                </div>
                <h3>No workspace records match your filters</h3>
                <p>Add a task or reset the dropdown criteria to see database contents.</p>
                <button class="btn btn-secondary btn-sm" onclick="resetFilters()">
                    <i class="fa-solid fa-rotate-left"></i> Reset Filter
                </button>
            </div>
        `;
        return;
    }
    
    taskList.forEach(task => {
        const card = document.createElement("div");
        card.className = "task-card animate-fade-in";
        
        // Formulate status text
        const statusLabel = task.status === "in_progress" ? "In Progress" : (task.status === "completed" ? "Completed" : "Pending");
        const statusClass = task.status === "in_progress" ? "progress" : (task.status === "completed" ? "completed" : "pending");
        
        // Formulate priority class
        const priorityClass = task.priority === "high" ? "high" : (task.priority === "medium" ? "medium" : "low");
        
        // Show owner badge for admins viewing all tasks
        const ownerBadge = state.adminViewAll && state.role === "admin" 
            ? `<div class="task-owner-badge">Owner ID: ${task.owner_id}</div>` 
            : "";
            
        card.innerHTML = `
            ${ownerBadge}
            <div class="task-card-header">
                <h3 class="task-title ${task.status === 'completed' ? 'completed' : ''}">${escapeHTML(task.title)}</h3>
                <div class="task-actions-menu">
                    <button class="icon-btn" onclick="openTaskModal(${task.id})" title="Edit Task">
                        <i class="fa-regular fa-pen-to-square text-cyan"></i>
                    </button>
                    <button class="icon-btn" onclick="deleteTask(${task.id})" title="Delete Task">
                        <i class="fa-regular fa-trash-can text-accent"></i>
                    </button>
                </div>
            </div>
            
            <p class="task-desc">${escapeHTML(task.description || "No security details provided.")}</p>
            
            <div class="task-card-footer">
                <div class="task-meta-left">
                    <span class="tag priority-${priorityClass}">${task.priority}</span>
                    <span class="tag status-${statusClass}">${statusLabel}</span>
                </div>
                <div class="task-meta-right">
                    <i class="fa-regular fa-clock"></i>
                    <span>${task.due_date ? task.due_date : "No Due Date"}</span>
                </div>
            </div>
        `;
        
        elements.tasksGrid.appendChild(card);
    });
}

function resetFilters() {
    elements.searchInput.value = "";
    elements.filterStatus.value = "all";
    elements.filterPriority.value = "all";
    filterTasks();
}

// Modal Form handling
function openTaskModal(taskId = null) {
    elements.taskForm.reset();
    
    if (taskId) {
        // Edit Mode
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        elements.modalTitle.textContent = "Modify Task Vault Entry";
        document.getElementById("task-edit-id").value = task.id;
        document.getElementById("task-title").value = task.title;
        document.getElementById("task-desc").value = task.description || "";
        document.getElementById("task-status").value = task.status;
        document.getElementById("task-priority").value = task.priority;
        document.getElementById("task-due-date").value = task.due_date || "";
        elements.modalSubmitBtn.textContent = "Apply Encryption Update";
    } else {
        // Create Mode
        elements.modalTitle.textContent = "Secure Workspace Task Creation";
        document.getElementById("task-edit-id").value = "";
        elements.modalSubmitBtn.textContent = "Save in Database Vault";
    }
    
    elements.taskModal.classList.remove("hidden");
}

function closeTaskModal() {
    elements.taskModal.classList.add("hidden");
}

async function handleTaskSubmit(event) {
    event.preventDefault();
    
    const taskId = document.getElementById("task-edit-id").value;
    const title = document.getElementById("task-title").value;
    const description = document.getElementById("task-desc").value;
    const statusVal = document.getElementById("task-status").value;
    const priority = document.getElementById("task-priority").value;
    const dueDate = document.getElementById("task-due-date").value || null;
    
    const payload = {
        title,
        description,
        status: statusVal,
        priority,
        due_date: dueDate
    };
    
    const isEdit = taskId !== "";
    const url = isEdit ? `${API_BASE}/tasks/${taskId}` : `${API_BASE}/tasks/`;
    const method = isEdit ? "PUT" : "POST";
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        updateInspector(method, url, payload, response.status, data);
        
        if (response.ok) {
            showToast(
                isEdit ? "Vault Record Updated" : "Vault Record Created", 
                `Successfully ${isEdit ? 'updated' : 'recorded'} task: "${title}"`, 
                "success"
            );
            closeTaskModal();
            loadTasks();
        } else {
            showToast("Database Validation Failed", data.error || "Request failed. Check field formats.", "error");
        }
    } catch (err) {
        showToast("Network Error", "Unable to establish task server connection", "error");
    }
}

async function deleteTask(taskId) {
    if (!confirm("Are you sure you want to purge this record permanently from the database?")) return;
    
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });
        
        updateInspector("DELETE", `${API_BASE}/tasks/${taskId}`, null, response.status, { success: response.ok, msg: "Task deleted successfully" });
        
        if (response.ok) {
            showToast("Record Purged", "The secure task was completely removed from the SQLite storage.", "success");
            loadTasks();
        } else {
            const data = await response.json();
            showToast("Access Restrained", data.error || "Unauthorized delete request", "error");
        }
    } catch (err) {
        showToast("Network Error", "Could not submit deletion query", "error");
    }
}

// --- ADMINISTRATIVE (RBAC PANEL) FUNCTIONS ---
async function loadAdminUsersTable() {
    if (state.role !== "admin") return;
    
    try {
        const response = await fetch(`${API_BASE}/users/`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });
        
        const data = await response.json();
        updateInspector("GET", `${API_BASE}/users/`, null, response.status, data);
        
        if (response.ok) {
            state.users = data;
            renderAdminUsersTable();
        } else {
            elements.adminUsersTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-accent">
                        <i class="fa-solid fa-triangle-exclamation"></i> RBAC Verification Denied: ${data.error || 'Forbidden'}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        elements.adminUsersTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">Network timeout fetching active user logs.</td>
            </tr>
        `;
    }
}

function renderAdminUsersTable() {
    elements.adminUsersTable.innerHTML = "";
    
    if (state.users.length === 0) {
        elements.adminUsersTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No security user records found.</td>
            </tr>
        `;
        return;
    }
    
    state.users.forEach(u => {
        const row = document.createElement("tr");
        
        const isSelf = u.email === state.email;
        const roleClass = u.role === "admin" ? "role-admin" : "role-user";
        const statusClass = u.is_active ? "status-active" : "status-inactive";
        const statusText = u.is_active ? "Active" : "Banned";
        
        // Define action button for role flipping
        const nextRole = u.role === "admin" ? "user" : "admin";
        const actionBtn = isSelf 
            ? `<span class="text-muted" style="font-size: 0.85rem">You (Current Session)</span>`
            : `<button class="btn btn-secondary btn-sm" onclick="changeUserRole(${u.id}, '${nextRole}')">
                Switch to ${nextRole.toUpperCase()}
               </button>`;
        
        row.innerHTML = `
            <td>${u.id}</td>
            <td><strong>${escapeHTML(u.full_name || 'N/A')}</strong></td>
            <td>${escapeHTML(u.email)}</td>
            <td><span class="role-badge ${roleClass}">${u.role}</span></td>
            <td><span class="status-badge ${statusClass}"><i class="fa-solid fa-circle"></i> ${statusText}</span></td>
            <td>${actionBtn}</td>
        `;
        
        elements.adminUsersTable.appendChild(row);
    });
}

async function changeUserRole(userId, newRole) {
    if (!confirm(`Are you absolutely sure you want to change user ${userId}'s access level to ${newRole.toUpperCase()}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/users/${userId}/role?new_role=${newRole}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });
        
        const data = await response.json();
        updateInspector("PUT", `${API_BASE}/users/${userId}/role?new_role=${newRole}`, null, response.status, data);
        
        if (response.ok) {
            showToast("RBAC Access Refined", `Successfully updated user permissions.`, "success");
            loadAdminUsersTable();
            // Reload tasks in case this changes tasks they can access
            loadTasks();
        } else {
            showToast("RBAC Revision Rejected", data.error || "Failed to update user authority.", "error");
        }
    } catch (err) {
        showToast("Network Error", "Unable to commit administrative change", "error");
    }
}

function toggleAdminViewAllTasks(checkbox) {
    state.adminViewAll = checkbox.checked;
    elements.workspaceTitle.textContent = state.adminViewAll ? "Cluster Console (ALL vaults)" : "Your Secure Worksheets";
    loadTasks();
}

// --- UTILITY TOAST NOTIFICATIONS ---
function showToast(title, message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconClass = "fa-solid fa-circle-info";
    if (type === "success") iconClass = "fa-solid fa-circle-check";
    if (type === "error") iconClass = "fa-solid fa-circle-exclamation";
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${iconClass}"></i>
        </div>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    document.getElementById("toast-container").appendChild(toast);
    
    // Auto dismiss after 4 seconds
    const timer = setTimeout(() => {
        dismissToast(toast);
    }, 4000);
    
    toast.addEventListener("click", () => {
        clearTimeout(timer);
        dismissToast(toast);
    });
}

function dismissToast(toastElement) {
    toastElement.classList.add("toast-fade-out");
    toastElement.addEventListener("animationend", () => {
        toastElement.remove();
    });
}

// Safe string escape for XSS prevention
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
