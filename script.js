const SUPABASE_URL = 'https://nwqtmkimhwscopczrjtq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXRta2ltaHdzY29wY3pyanRxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTU1MTM2OCwiZXhwIjoyMDY3MTI3MzY4fQ.GewdCOp2qlssEf1DaRyD4ObjOgc81JUrAjwdnVKU4sE';

const { createClient } = supabase;
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);



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

    if (error) {
        console.error('Error loading users:', error);
        return;
    }

    const usersList = document.getElementById('usersList');
    usersList.innerHTML = ''; // Clear existing list

    users.forEach(user => {
        const row = document.createElement('tr');

        let statusBadge;
        if (user.is_banned) {
            statusBadge = `<span class="status status-banned">Banned</span>`;
        } else if (user.is_admin) {
            statusBadge = `<span class="status status-admin">Admin</span>`;
        } else {
            statusBadge = `<span class="status status-active">Active</span>`;
        }

        row.innerHTML = `
            <td>${user.id}</td>
            <td>@${user.username || 'anonymous'}</td>
            <td>${user.coins.toLocaleString()}</td>
            <td>${statusBadge}</td>
            <td>
                <!-- THE FIX IS HERE: '${user.id}' is now correctly wrapped in quotes -->
                <button onclick="editUser('${user.id}', '${user.username || 'anonymous'}', ${user.coins})">Edit</button>
            </td>
        `;
        usersList.appendChild(row);
    });
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

        if (log.details) {
            detailsText += `<br><small>${JSON.stringify(log.details)}</small>`;
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
    const newCoins = prompt(`Editing user @${username}.\nEnter new coin amount:`, currentCoins);
    if (newCoins !== null && !isNaN(newCoins)) {
        performQuickAction('set_coins', { id: userId, coins: parseInt(newCoins, 10) });
    }
}

async function performAction() {
    const username = document.getElementById('actionUser').value.replace('@', '');
    const actionType = document.getElementById('actionType').value;
    const actionValue = document.getElementById('actionValue').value;

    if (!username) {
        showActionResult('Please enter a username.', 'error');
        return;
    }

    const { data: user, error: userError } = await sbClient.from('users').select('id').eq('username', username).single();

    if (userError || !user) {
        showActionResult('User not found.', 'error');
        return;
    }

    const params = { id: user.id };

    if (actionType === 'set_coins') {
        params.coins = parseInt(actionValue, 10);
        if (isNaN(params.coins)) {
            showActionResult('Invalid coin amount.', 'error');
            return;
        }
    } else if (actionType === 'add_coins') {
        params.amount = parseInt(actionValue, 10);
        if (isNaN(params.amount)) {
            showActionResult('Invalid amount to add.', 'error');
            return;
        }
    } else if (actionType === 'ban') {
        params.reason = actionValue || 'No reason provided';
    }

    performQuickAction(actionType, params);
}

async function performQuickAction(actionType, params) {
    let response = {};
    let successMessage = '';

    switch (actionType) {
        case 'set_coins':
            response = await sbClient.from('users').update({ coins: params.coins }).eq('id', params.id);
            successMessage = `Successfully set coins to ${params.coins}.`;
            break;
        case 'add_coins':

            const { data: user } = await sbClient.from('users').select('coins').eq('id', params.id).single();
            if (user) {
                response = await sbClient.from('users').update({ coins: user.coins + params.amount }).eq('id', params.id);
                successMessage = `Successfully added ${params.amount} coins.`;
            }
            break;
        case 'ban':
            response = await sbClient.from('users').update({ is_banned: true, banned_reason: params.reason }).eq('id', params.id);
            successMessage = `Successfully banned user.`;
            break;
        case 'unban':
            response = await sbClient.from('users').update({ is_banned: false, banned_reason: null }).eq('id', params.id);
            successMessage = `Successfully unbanned user.`;
            break;
        case 'make_admin':
            response = await sbClient.from('users').update({ is_admin: true }).eq('id', params.id);
            successMessage = `Successfully granted admin privileges.`;
            break;
        default:
            showActionResult('Unknown action.', 'error');
            return;
    }

    if (response.error) {
        showActionResult(`Error: ${response.error.message}`, 'error');
    } else {
        showActionResult(successMessage, 'success');
        loadUsers(); 
    }
}

function showActionResult(message, type) {
    const resultDiv = document.getElementById('actionResult');
    resultDiv.textContent = message;
    resultDiv.className = type; 
}