const SUPABASE_URL = 'https://nwqtmkimhwscopczrjtq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXRta2ltaHdzY29wY3pyanRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTEzNjgsImV4cCI6MjA2NzEyNzM2OH0.o5lvZYZ6vfn7bhgSZw4z29pFG5Y7uphLP1trW2sG2KM';

const { createClient } = supabase;
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const editModal = document.getElementById('edit-modal');
const modalTitle = document.getElementById('modal-title');
const modalUsername = document.getElementById('modal-username');
const modalInput = document.getElementById('modal-input');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');


document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});


async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginResult = document.getElementById('loginResult');

    const { data, error } = await sbClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        loginResult.textContent = `Login Failed: ${error.message}`;
        loginResult.className = 'error';
        return;
    }

    checkAdminStatus(data.user);
}

async function checkSession() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
        checkAdminStatus(session.user);
    }
}

async function checkAdminStatus(user) {
    const { data: profile, error } = await sbClient
        .from('users')
        .select('is_admin')
        .eq('id', user.id) 
        .single();

    if (error || !profile) {
        alert('Could not verify user profile.');
        return;
    }

    if (profile.is_admin) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';

        loadUsers();
        loadLogs();

    } else {
     
        alert('Access Denied. You are not an administrator.');
        sbClient.auth.signOut(); 
    }
}


document.addEventListener('DOMContentLoaded', () => {

    loadUsers();
    loadLogs();
});

function openTab(evt, tabName) {

    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }


    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active");
    }


    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}



async function loadUsers(searchTerm = '') {
    let query = sbClient.from('users').select('*').order('coins', { ascending: false });
    if (searchTerm) {
        query = query.ilike('username', `%${searchTerm}%`);
    }

    const { data: users, error } = await query;
    if (error) { console.error('Error loading users:', error); return; }

    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');

        const lastActive = new Date(user.last_active);
        const minutesAgo = (new Date() - lastActive) / 60000;
        const onlineStatus = minutesAgo < 5
            ? `<span class="online-status online">Online</span>`
            : `<span class="online-status offline">${lastActive.toLocaleString()}</span>`;

        const statusBadge = user.is_banned
            ? `<span class="status status-banned">Banned</span>`
            : user.is_admin
                ? `<span class="status status-admin">Admin</span>`
                : `<span class="status status-active">Active</span>`;

        const userCoins = parseFloat(user.coins).toFixed(16);

        row.innerHTML = `
            <td class="user-id">${user.id}</td>
            <td>@${user.username || 'anonymous'}</td>
            <td>${userCoins}</td>
            <td>${onlineStatus}</td>
            <td>${statusBadge}</td>
            <td>
                <!-- THE FIX IS HERE: '${user.coins}' is now correctly passed as a string -->
                <button onclick="editUser('${user.id}', '${user.username || 'anonymous'}', '${user.coins}')">Edit</button>
            </td>
        `;
        usersList.appendChild(row);
    });
}

async function logAdminAction(actionType, targetUserId, details = {}) {
    const { data: { user } } = await sbClient.auth.getUser();

    if (!user) {
        console.error("Could not log action: no admin user found.");
        return;
    }

    const { error } = await sbClient.from('admin_logs').insert({
        admin_id: user.id,
        action: actionType,
        target_user_id: targetUserId,
        details: details
    });

    if (error) {
        console.error("Failed to write to admin_logs:", error.message);
    }
    
    else {
        loadLogs();
    }
}

async function loadLogs() {
    const logType = document.getElementById('logType').value;
    let query;

    if (logType === 'admin_logs') {
      
        query = sbClient
            .from('admin_logs')
            .select(`
                created_at,
                action,
                details,
                admin:admin_id(username),
                target_user:target_user_id(username)
            `);
        } 
   
        else { 
        query = sbClient
            .from('user_logs')
            .select(`
                created_at,
                action,
                details,
                user:user_id(username)
            `);
    }

    const { data: logs, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error loading logs:', error.message);
        const logsList = document.getElementById('logsList');
        logsList.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`;
        return;
    }

    const logsList = document.getElementById('logsList');
    logsList.innerHTML = '';

    logs.forEach(log => {
        const row = document.createElement('tr');
        let detailsText = '';

        if (logType === 'admin_logs') {
            const adminUsername = log.admin ? log.admin.username : 'system';
            const targetUsername = log.target_user ? log.target_user.username : 'none';
            detailsText = `Admin: <b>@${adminUsername}</b>, Target: <b>@${targetUsername}</b>`;
        } else {
            const userUsername = log.user ? log.user.username : 'unknown';
            detailsText = `User: <b>@${userUsername}</b>`;
        }

        if (log.details) 
            {
            const formattedDetails = { ...log.details };

            for (const key in formattedDetails) {
                if (typeof formattedDetails[key] === 'number' && formattedDetails[key] < 1 && formattedDetails[key] > 0) {
                    formattedDetails[key] = formattedDetails[key].toFixed(16);
                }
            }

            detailsText += `<br><small>${JSON.stringify(formattedDetails)}</small>`;
        }


        row.innerHTML = `
            <td>${new Date(log.created_at).toLocaleString()}</td>
            <td>${log.action}</td>
            <td>${detailsText}</td>
        `;
        logsList.appendChild(row);
    });
}

function searchUsers() {
    const searchTerm = document.getElementById('searchUser').value;
    loadUsers(searchTerm);
}



function editUser(userId, username, currentCoins) {

    modalTitle.textContent = `Edit Coins`;
    modalUsername.textContent = `Editing user: @${username}`;

    modalInput.value = parseFloat(currentCoins).toFixed(16);

    editModal.dataset.editingUserId = userId;

    editModal.classList.remove('hidden');
    modalInput.focus();
}


modalSaveBtn.onclick = () => {
    const userId = editModal.dataset.editingUserId;
    const newCoinsValue = modalInput.value;

    if (userId && newCoinsValue !== null && newCoinsValue.trim() !== '' && !isNaN(newCoinsValue)) {
        performQuickAction('set_coins', { id: userId, coins: parseFloat(newCoinsValue) });
        closeModal();
    } else {
        alert("Please enter a valid number.");
    }
};


modalCancelBtn.onclick = () => {
    closeModal();
};

editModal.onclick = (event) => {
    if (event.target === editModal) {
        closeModal();
    }
};

function closeModal() 
{
    editModal.classList.add('hidden');
    delete editModal.dataset.editingUserId;
}

async function performAction() {
    const username = document.getElementById('actionUser').value.replace('@', '');
    const actionType = document.getElementById('actionType').value;
    const actionValue = document.getElementById('actionValue').value;

    if (!username) { showActionResult('Please enter a username.', 'error'); return; }

    const { data: user, error: userError } = await sbClient.from('users').select('id').eq('username', username).single();
    if (userError || !user) { showActionResult('User not found.', 'error'); return; }


    const params = { id: user.id };


    if (actionType === 'set_coins' || actionType === 'add_coins') 
        {
        params.amount = parseFloat(actionValue);

        if (isNaN(params.amount)) 
            {
            showActionResult('Invalid amount specified.', 'error');
            return;
        }
    } 
    else if (actionType === 'ban') 
        {
        params.reason = actionValue || 'No reason provided';
    }

    performQuickAction(actionType, params);
}

async function performQuickAction(actionType, params) {
    let response = {};
    let successMessage = '';

    switch (actionType) {
        case 'set_coins':
            response = await sbClient.from('users')
            .update({ coins: params.coins || params.amount })
            .eq('id', params.id);

            successMessage = `Successfully set coins for user.`;
            break;

        case 'add_coins':
            const { data: user } = await sbClient
            .from('users')
            .select('coins')
            .eq('id', params.id)
            .single();

            if (user) 
                {
                response = await sbClient
                .from('users')
                .update({ coins: user.coins + params.amount })
                .eq('id', params.id);
                successMessage = `Successfully added coins to user.`;
            }
            break;

        case 'ban':
            response = await sbClient
            .from('users')
            .update({ is_banned: true, banned_reason: params.reason })
            .eq('id', params.id);
            successMessage = `Successfully banned user.`;
            break;

        case 'unban':
            response = await sbClient
            .from('users')
            .update({ is_banned: false, banned_reason: null })
            .eq('id', params.id);
            successMessage = `Successfully unbanned user.`;
            break;

        case 'make_admin':
            response = await sbClient
            .from('users')
            .update({ is_admin: true })
            .eq('id', params.id);
            successMessage = `Successfully granted admin privileges.`;
            break;

        default: showActionResult('Unknown action.', 'error'); return;
    }

    if (response.error) 
    {
        showActionResult(`Error: ${response.error.message}`, 'error');
    } 

    else 
    {
        showActionResult(successMessage, 'success');
        const logDetails = { ...params };
        if (logDetails.coins) { logDetails.amount = logDetails.coins; delete logDetails.coins; }
        logAdminAction(actionType, params.id, logDetails);
        loadUsers();
    }
}


function showActionResult(message, type) {
    const resultDiv = document.getElementById('actionResult');
    resultDiv.textContent = message;
    resultDiv.className = type; 
}