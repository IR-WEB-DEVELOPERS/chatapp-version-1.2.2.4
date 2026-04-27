// ============================================================
//  friends.js — Friends list, search, requests, remove
// ============================================================

async function loadFriendsList() {
    const friendsList = document.getElementById('friendsList');
    if (!friendsList) return;

    try {
        // FIX: currentUserData null అయినప్పుడు crash కాకుండా loading చూపించు
        if (!currentUserData) {
            friendsList.innerHTML = '<div class="no-chats">Loading...</div>';
            return;
        }

        const friendsFromArray = currentUserData.friends || [];

        // FIX: friends array లో లేకపోయినా messages exist అయిన contacts ని కూడా show చేయాలి
        // messages collection లో participants గా ఉన్న UIDs fetch చేయాలి
        let extraUIDs = [];
        try {
            const msgSnap = await db.collection('messages')
                .where('participants', 'array-contains', currentUser.uid)
                .limit(100)
                .get();
            const seen = new Set(friendsFromArray);
            msgSnap.forEach(doc => {
                const parts = doc.data().participants || [];
                parts.forEach(uid => {
                    if (uid !== currentUser.uid && !seen.has(uid)) {
                        seen.add(uid);
                        extraUIDs.push(uid);
                    }
                });
            });
        } catch (e) { console.log('Extra UIDs fetch error:', e); }

        const friends = [...friendsFromArray, ...extraUIDs];

        if (friends.length === 0) {
            friendsList.innerHTML = '<div class="no-chats">No chats yet</div>';
            return;
        }

        // FIX: already loaded items ఉంటే loading flash చూపించకు
        if (!friendsList.querySelector('.chat-item')) {
            friendsList.innerHTML = '<div class="no-chats">Loading chats...</div>';
        }

        const friendEntries = await Promise.all(friends.map(async (friendUID) => {
            const friendData = await getUserData(friendUID);
            if (!friendData) return null;

            const chatId       = generateChatId(currentUser.uid, friendUID);
            let lastTime       = 0;
            let lastPreview    = '';
            let lastTimeStr    = '';

            try {
                let snap;
                try {
                    snap = await db.collection('messages')
                        .where('chatId', '==', chatId)
                        .orderBy('time', 'desc')
                        .limit(1)
                        .get();
                } catch {
                    const allSnap = await db.collection('messages').where('chatId', '==', chatId).get();
                    const docs    = allSnap.docs.sort((a, b) => {
                        const ta = a.data().time?.toDate?.() || new Date(a.data().time);
                        const tb = b.data().time?.toDate?.() || new Date(b.data().time);
                        return tb - ta;
                    });
                    snap = { empty: docs.length === 0, docs };
                }

                if (!snap.empty) {
                    const msgData = snap.docs[0].data();
                    const t       = msgData.time;
                    const tDate   = t?.toDate ? t.toDate() : new Date(t);
                    lastTime      = tDate.getTime();

                    const now       = new Date();
                    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);

                    if (tDate.toDateString() === now.toDateString())
                        lastTimeStr = tDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    else if (tDate.toDateString() === yesterday.toDateString())
                        lastTimeStr = 'Yesterday';
                    else
                        lastTimeStr = tDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

                    if (msgData.type === 'call') {
                        lastPreview = msgData.callType === 'video' ? '📹 Video call' : '📞 Voice call';
                    } else if (msgData.type === 'file') {
                        lastPreview = '📎 File';
                    } else if (msgData.deletedForAll) {
                        lastPreview = '🚫 Message deleted';
                    } else {
                        const isMine = msgData.sender === currentUser.uid;
                        lastPreview  = (isMine ? 'You: ' : '') + (msgData.text || '').replace(/\n/g, ' ');
                    }
                }
            } catch (e) { console.log('Last msg fetch error:', e); }

            return { friendUID, friendData, chatId, lastTime, lastPreview, lastTimeStr };
        }));

        const sorted = friendEntries.filter(Boolean).sort((a, b) => b.lastTime - a.lastTime);

        let html = '';
        for (const { friendUID, friendData, chatId, lastPreview, lastTimeStr } of sorted) {
            const unreadCount  = unreadMap[chatId] || 0;
            const dotColor     = statusDotColor(friendData.status);
            html += `
                <button class="chat-item" data-uid="${escapeAttribute(friendUID)}">
                    <div class="chat-avatar">
                        ${escapeHTML(friendData.name?.charAt(0)?.toUpperCase() || 'U')}
                        <span class="status-dot" style="background:${dotColor};"></span>
                    </div>
                    <div class="chat-info">
                        <div class="chat-item-top">
                            <h4>${escapeHTML(friendData.name)}</h4>
                            ${lastTimeStr ? `<span class="chat-item-time">${escapeHTML(lastTimeStr)}</span>` : ''}
                        </div>
                        <div class="chat-item-bottom">
                            <p class="chat-item-preview">${escapeHTML(lastPreview)}</p>
                            ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                        </div>
                    </div>
                </button>
            `;
        }

        friendsList.innerHTML = html;
        friendsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => openChat(item.dataset.uid));
        });

    } catch (error) {
        console.error('Error loading friends list:', error);
        friendsList.innerHTML = '<div class="no-chats">Error loading chats</div>';
    }
}

async function searchUsers() {
    const searchInput = document.getElementById('searchUser');
    const searchTerm  = searchInput?.value.trim();
    const resultsDiv  = document.getElementById('searchedUser');

    if (!searchTerm || !resultsDiv) { if (resultsDiv) resultsDiv.innerHTML = ''; return; }

    try {
        resultsDiv.innerHTML = '<div class="no-results">Searching...</div>';
        const allResults     = new Map();

        // Strategy 1: usernameLower
        try {
            const snap = await db.collection('users')
                .where('usernameLower', '>=', searchTerm.toLowerCase())
                .where('usernameLower', '<=', searchTerm.toLowerCase() + '\uf8ff')
                .limit(10).get();
            snap.forEach(doc => { if (doc.id !== currentUser.uid) allResults.set(doc.id, doc.data()); });
        } catch {
            try {
                const snap = await db.collection('users')
                    .where('username', '>=', searchTerm)
                    .where('username', '<=', searchTerm + '\uf8ff')
                    .limit(10).get();
                snap.forEach(doc => { if (doc.id !== currentUser.uid) allResults.set(doc.id, doc.data()); });
            } catch { /* ignore */ }
        }

        // Strategy 2: emailLower
        try {
            const snap = await db.collection('users')
                .where('emailLower', '>=', searchTerm.toLowerCase())
                .where('emailLower', '<=', searchTerm.toLowerCase() + '\uf8ff')
                .limit(10).get();
            snap.forEach(doc => { if (doc.id !== currentUser.uid && !allResults.has(doc.id)) allResults.set(doc.id, doc.data()); });
        } catch { /* ignore */ }

        // Strategy 3: client-side filter on name/username/email
        try {
            const allUsers  = await db.collection('users').limit(50).get();
            const lower     = searchTerm.toLowerCase();
            allUsers.forEach(doc => {
                const user = doc.data();
                if (doc.id !== currentUser.uid && !allResults.has(doc.id)) {
                    if ((user.username || '').toLowerCase().includes(lower) ||
                        (user.name     || '').toLowerCase().includes(lower) ||
                        (user.email    || '').toLowerCase().includes(lower)) {
                        allResults.set(doc.id, user);
                    }
                }
            });
        } catch { /* ignore */ }

        resultsDiv.innerHTML = '';

        if (allResults.size === 0) {
            resultsDiv.innerHTML = '<div class="no-results">No users found</div>';
            return;
        }

        Array.from(allResults.entries()).slice(0, 10).forEach(([userId, user]) => {
            const div = document.createElement('div');
            div.className = 'search-result';
            div.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <strong>${escapeHTML(user.name || 'Unknown')}</strong>
                        <div style="font-size:0.8rem;color:#718096;">@${escapeHTML(user.username || 'No username')}</div>
                    </div>
                    <button class="primary-btn add-friend-btn" data-uid="${escapeAttribute(userId)}">Add Friend</button>
                </div>
            `;
            resultsDiv.appendChild(div);
        });

        resultsDiv.querySelectorAll('.add-friend-btn').forEach(btn => {
            btn.addEventListener('click', () => sendFriendRequest(btn.dataset.uid));
        });

    } catch (error) {
        console.error('Error searching users:', error);
        if (resultsDiv) resultsDiv.innerHTML = '<div class="no-results">Error searching users.</div>';
    }
}

async function sendFriendRequest(toUID) {
    try {
        const requestId = generateChatId(currentUser.uid, toUID);
        await db.collection('friendRequests').doc(requestId).set({
            from: currentUser.uid, to: toUID, status: 'pending', timestamp: new Date()
        });
        modalManager.showModal('Success', 'Friend request sent!', 'success');
    } catch (error) {
        console.error('Error sending friend request:', error);
        modalManager.showModal('Error', 'Failed to send friend request', 'error');
    }
}

async function loadFriendRequests() {
    const requestsDiv = document.getElementById('friendRequests');
    if (!requestsDiv) return;

    try {
        const snapshot = await db.collection('friendRequests')
            .where('to', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .get();

        if (snapshot.empty) {
            requestsDiv.innerHTML = '<div class="no-requests">No pending requests</div>';
            return;
        }

        let html = '';
        for (const doc of snapshot.docs) {
            const request  = doc.data();
            const fromUser = await getUserData(request.from);
            if (fromUser) {
                html += `
                    <div class="request-item">
                        <div class="friend-avatar">${escapeHTML(fromUser.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                        <div class="friend-info">
                            <h4>${escapeHTML(fromUser.name)}</h4>
                            <p>@${escapeHTML(fromUser.username)}</p>
                        </div>
                        <div class="request-actions">
                            <button class="accept-btn"  data-requestid="${escapeAttribute(doc.id)}">Accept</button>
                            <button class="decline-btn" data-requestid="${escapeAttribute(doc.id)}">Decline</button>
                        </div>
                    </div>
                `;
            }
        }

        requestsDiv.innerHTML = html;
        requestsDiv.querySelectorAll('.accept-btn').forEach(btn  => btn.addEventListener('click', () => acceptFriendRequest(btn.dataset.requestid)));
        requestsDiv.querySelectorAll('.decline-btn').forEach(btn => btn.addEventListener('click', () => declineFriendRequest(btn.dataset.requestid)));

    } catch (error) {
        console.error('Error loading friend requests:', error);
        requestsDiv.innerHTML = '<div class="no-requests">Error loading requests</div>';
    }
}

async function acceptFriendRequest(requestId) {
    try {
        const requestDoc = await db.collection('friendRequests').doc(requestId).get();
        if (!requestDoc.exists) return;
        const request = requestDoc.data();

        await db.collection('friendRequests').doc(requestId).update({ status: 'accepted' });

        const batch = db.batch();
        batch.update(db.collection('users').doc(request.from), { friends: firebase.firestore.FieldValue.arrayUnion(request.to) });
        batch.update(db.collection('users').doc(request.to),   { friends: firebase.firestore.FieldValue.arrayUnion(request.from) });
        await batch.commit();

        loadFriendRequests();
        loadAllFriends();
    } catch (error) {
        console.error('Error accepting friend request:', error);
        modalManager.showModal('Error', 'Failed to accept friend request', 'error');
    }
}

async function declineFriendRequest(requestId) {
    try {
        await db.collection('friendRequests').doc(requestId).update({ status: 'declined' });
        loadFriendRequests();
    } catch (error) {
        console.error('Error declining friend request:', error);
        modalManager.showModal('Error', 'Failed to decline friend request', 'error');
    }
}

async function loadAllFriends() {
    const friendsDiv = document.getElementById('friendsListAll');
    if (!friendsDiv) return;

    try {
        const friends = currentUserData.friends || [];
        if (friends.length === 0) { friendsDiv.innerHTML = '<div class="no-friends">No friends yet</div>'; return; }

        let html = '';
        for (const friendUID of friends) {
            const friendData = await getUserData(friendUID);
            if (friendData) {
                const dotColor = statusDotColor(friendData.status);
                html += `
                    <div class="friend-item">
                        <div class="friend-avatar">
                            ${escapeHTML(friendData.name?.charAt(0)?.toUpperCase() || 'U')}
                            <span class="status-dot" style="background:${dotColor};"></span>
                        </div>
                        <div class="friend-info">
                            <h4>${escapeHTML(friendData.name)}</h4>
                            <p style="font-size:0.75rem;">${formatStatus(friendData.status, friendData.lastSeen)}</p>
                        </div>
                        <button class="remove-friend-btn" data-uid="${escapeAttribute(friendUID)}" title="Remove Friend">&times;</button>
                    </div>
                `;
            }
        }

        friendsDiv.innerHTML = html;
        friendsDiv.querySelectorAll('.remove-friend-btn').forEach(btn => {
            btn.addEventListener('click', () => removeFriend(btn.dataset.uid));
        });

    } catch (error) {
        console.error('Error loading friends:', error);
        friendsDiv.innerHTML = '<div class="no-friends">Error loading friends</div>';
    }
}

async function removeFriend(friendUID) {
    const confirmed = await modalManager.showModal('Remove Friend', 'Are you sure you want to remove this friend?', 'warning', 'Remove', 'Cancel');
    if (!confirmed) return;

    try {
        const batch = db.batch();
        batch.update(db.collection('users').doc(currentUser.uid), { friends: firebase.firestore.FieldValue.arrayRemove(friendUID) });
        batch.update(db.collection('users').doc(friendUID),       { friends: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        await batch.commit();
        loadAllFriends();
        loadFriendsList();
    } catch (error) {
        console.error('Error removing friend:', error);
        modalManager.showModal('Error', 'Failed to remove friend', 'error');
    }
}

// ── Expose ───────────────────────────────────────────────────
window.loadFriendsList      = loadFriendsList;
window.loadAllFriends       = loadAllFriends;
window.loadFriendRequests   = loadFriendRequests;
window.searchUsers          = searchUsers;
window.sendFriendRequest    = sendFriendRequest;
window.acceptFriendRequest  = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.removeFriend         = removeFriend;

console.log('friends.js loaded');
