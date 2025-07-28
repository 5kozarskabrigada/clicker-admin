const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const { createClient } = supabase;
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);


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
    usersList.innerHTML = ''; 

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
                <button onclick="editUser(${user.id}, '${user.username}', ${user.coins})">Edit</button>
            </td>
        `;
        usersList.appendChild(row);
    });
}

async function loadLogs() {
    const logType = document.getElementById('logType').value;


    const { data: logs, error } = await sbClient
        .from(logType)
        .select(`
            created_at,
            action,
            details,
            admin:users!${logType}_admin_id_fkey(username),
            target_user:users!${logType}_target_user_id_fkey(username),
            user:users!${logType}_user_id_fkey(username)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error loading logs:', error.message);
        return;
    }

    const logsList = document.getElementById('logsList');
    logsList.innerHTML = ''; 

    logs.forEach(log => {
        const row = document.createElement('tr');
        let detailsText = '';

        if (logType === 'admin_logs') {
            detailsText = `Admin: <b>@${log.admin?.username || 'system'}</b>, Target: <b>@${log.target_user?.username || 'none'}</b>`;
        } else { 
            detailsText = `User: <b>@${log.user?.username || 'unknown'}</b>`;
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
        performQuickAction('set_coins', { id: userId, coins: parseInt(newCoins) });
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


    const { data: user, error: userError } = await sbClient
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

    if (userError || !user) {
        showActionResult('User not found.', 'error');
        return;
    }

    const params = { id: user.id };
    if (actionType === 'set_coins' || actionType === 'add_coins') {
        params.amount = parseInt(actionValue);
        if (isNaN(params.amount)) {
            showActionResult('Invalid amount specified.', 'error');
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