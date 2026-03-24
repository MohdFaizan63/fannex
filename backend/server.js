const path = require('path');
// Always load .env relative to THIS file so it works regardless of CWD
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./src/config/db.js');
const app = require('./src/app.js');
const jwt = require('jsonwebtoken');
const ChatRoom = require('./src/models/ChatRoom.js');
const ChatMessage = require('./src/models/ChatMessage.js');
const CreatorProfile = require('./src/models/CreatorProfile.js');
const User = require('./src/models/User.js');
const Earnings = require('./src/models/Earnings.js');
const Payment = require('./src/models/Payment.js');
const { createNotification } = require('./src/services/notificationService.js');
// ✅ Bug 22 Fix: moved here from inside send_message handler (module-level, cached)
const { calcGST } = require('./src/utils/gstHelper');


const PORT = process.env.PORT || 8080;

// ── 1. Create HTTP server wrapping Express ────────────────────────────────────
const httpServer = http.createServer(app);

// ── 2. Socket.io setup ────────────────────────────────────────────────────────
// BUG-13 / SEC-2 FIX: Restrict Socket.IO CORS to same allowlist as Express
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://fannex.vercel.app',
    'https://fannex.in',
    'https://www.fannex.in',
];

const io = new Server(httpServer, {
    cors: {
        origin: (origin, cb) => {
            // Allow requests with no origin (e.g. server-to-server, mobile apps)
            if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
            return cb(new Error(`Socket.IO CORS: origin '${origin}' not allowed`));
        },
        credentials: true,
    },
});

// ── 3. JWT auth middleware for socket connections ─────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication error'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.role = decoded.role;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

// ── 4. Track online users ─────────────────────────────────────────────────────
const onlineUsers = new Map(); // userId → socketId

io.on('connection', (socket) => {
    console.log(`🟢 Socket connected: ${socket.userId}`);
    onlineUsers.set(socket.userId, socket.id);
    // NOTE: Removed global broadcast — it was firing for EVERY connected user
    // which causes O(n) fan-out. Presence is now tracked per-room only.

    // ── Join a chat room ──────────────────────────────────────────────────────
    socket.on('join_room', async ({ chatId }) => {
        try {
            const room = await ChatRoom.findById(chatId);
            if (!room || !room.isPaid) return;
            const isParticipant =
                room.userId.toString() === socket.userId ||
                room.creatorId.toString() === socket.userId;
            if (!isParticipant) return;

            socket.join(chatId);
        } catch (err) {
            console.error('join_room error:', err.message);
        }
    });

    // ── Send a message ────────────────────────────────────────────────────────
    socket.on('send_message', async ({ chatId, type = 'text', content }) => {
        try {
            // ✅ Bug 23 Fix: validate message type and content before hitting the DB
            const ALLOWED_MSG_TYPES = ['text', 'image', 'voice', 'gift'];
            if (!ALLOWED_MSG_TYPES.includes(type)) {
                return socket.emit('send_error', { code: 'INVALID_TYPE', message: `Invalid message type: ${type}` });
            }
            if (type === 'text' && (!content || typeof content !== 'string' || content.trim().length === 0)) {
                return socket.emit('send_error', { code: 'EMPTY_CONTENT', message: 'Message cannot be empty' });
            }
            if (content && content.length > 5000) {
                return socket.emit('send_error', { code: 'TOO_LONG', message: 'Message is too long (max 5000 chars)' });
            }

            const room = await ChatRoom.findById(chatId);
            if (!room || !room.isPaid) return;

            const isParticipant =
                room.userId.toString() === socket.userId ||
                room.creatorId.toString() === socket.userId;
            if (!isParticipant) return;

            const isCreator = room.creatorId.toString() === socket.userId;

            // ── Wallet deduction for fan messages ─────────────────────────────
            let newWalletBalance = null;
            if (!isCreator) {
                const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('messagePrice');
                const msgCost = profile?.messagePrice ?? 0;

                if (msgCost > 0) {
                    // Atomic deduction — only succeeds if balance is sufficient
                    const updatedFan = await User.findOneAndUpdate(
                        { _id: socket.userId, walletBalance: { $gte: msgCost } },
                        { $inc: { walletBalance: -msgCost } },
                        { new: true, select: 'walletBalance' }
                    );

                    if (!updatedFan) {
                        // Insufficient balance — notify sender and abort
                        const fan = await User.findById(socket.userId).select('walletBalance');
                        socket.emit('send_error', {
                            code: 'INSUFFICIENT_BALANCE',
                            message: 'Insufficient wallet balance. Please top up to continue chatting.',
                            required: msgCost,
                            walletBalance: fan?.walletBalance ?? 0,
                        });
                        return;
                    }

                    newWalletBalance = updatedFan.walletBalance;

                    // ✅ FIX 1: Emit wallet_deducted so the chat header refreshes instantly
                    socket.emit('wallet_deducted', {
                        deducted: msgCost,
                        newBalance: newWalletBalance,
                    });

                    // ── 80/20 split: creator gets 80%, platform keeps 20% ────────────
                    // ✅ Bug 22 Fix: calcGST is now imported at module top-level (not require() here)
                    const split = calcGST(msgCost);
                    const creatorEarning = split.creatorEarning; // 80% of msgCost

                    // Credit only 80% to creator earnings
                    await Earnings.findOneAndUpdate(
                        { creatorId: room.creatorId },
                        { $inc: { totalEarned: creatorEarning, pendingAmount: creatorEarning } },
                        { upsert: true }
                    );

                    // ✅ FIX 2: Create a Payment doc per message so it shows in Earning History
                    // Use fire-and-forget so it doesn't block the message delivery path
                    Payment.create({
                        userId: room.userId,
                        creatorId: room.creatorId,
                        chatId: room._id,
                        amount: msgCost,              // what fan paid (full msgCost from wallet)
                        baseAmount: msgCost,
                        gstAmount: split.gstAmount,
                        platformFee: split.platformFee, // 20% — platform keeps this
                        creatorEarning,                 // 80% — shown in Earning History
                        type: 'chat_unlock',            // shows in Chat tab of Earning History
                        status: 'captured',
                        cfOrderId: `msg_${String(socket.userId).slice(-6)}_${Date.now()}`,
                        sideEffectsDone: true,
                        _earningsCredited: true,
                    }).catch((err) => console.warn('[payment/msg] create failed:', err.message));

                    console.log(`[send_message] ₹${msgCost} → creator ₹${creatorEarning} (80%) + platform ₹${split.platformFee} (20%)`);

                }
            }
            // ─────────────────────────────────────────────────────────────────

            const message = await ChatMessage.create({
                chatId,
                senderId: socket.userId,
                type,
                content,
            });

            // Update room
            await ChatRoom.findByIdAndUpdate(chatId, {
                lastMessage: content,
                lastMessageAt: new Date(),
                lastMessageType: type,
                $inc: { [isCreator ? 'unreadByUser' : 'unreadByCreator']: 1 },
            });

            // Broadcast ONLY to other participants (sender already has optimistic message)
            socket.to(chatId).emit('new_message', {
                ...message.toObject(),
                chatId,
            });

            // Notify the other participant (fire-and-forget)
            const recipientId = isCreator ? room.userId : room.creatorId;
            createNotification({
                recipientId,
                senderId: socket.userId,
                type: 'new_message',
                title: 'New message received',
                body: type === 'text' ? content.slice(0, 100) : `Sent a ${type}`,
                referenceId: room._id,
                referenceModel: 'ChatRoom',
            }).catch(() => { });
        } catch (err) {
            console.error('send_message error:', err.message);
        }
    });



    // ── Typing indicator ──────────────────────────────────────────────────────
    socket.on('typing', ({ chatId, isTyping }) => {
        socket.to(chatId).emit('typing', { userId: socket.userId, isTyping });
    });

    // ── Mark messages seen ────────────────────────────────────────────────────
    socket.on('mark_seen', async ({ chatId }) => {
        try {
            await ChatMessage.updateMany(
                { chatId, senderId: { $ne: socket.userId }, seen: false },
                { seen: true, seenAt: new Date() }
            );
            // ✅ Bug 28 Fix: single pipeline-update call — no read, one write
            await ChatRoom.findByIdAndUpdate(
                chatId,
                [{
                    $set: {
                        unreadByCreator: {
                            $cond: [
                                { $eq: ['$creatorId', { $toObjectId: socket.userId }] },
                                0,
                                '$unreadByCreator',
                            ],
                        },
                        unreadByUser: {
                            $cond: [
                                { $ne: ['$creatorId', { $toObjectId: socket.userId }] },
                                0,
                                '$unreadByUser',
                            ],
                        },
                    },
                }]
            );
            socket.to(chatId).emit('messages_seen', { chatId, seenBy: socket.userId });
        } catch (err) {
            console.error('mark_seen error:', err.message);
        }
    });


    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        onlineUsers.delete(socket.userId);
        // NOTE: No global broadcast — removed to prevent O(n) fan-out on disconnect
        console.log(`🔴 Socket disconnected: ${socket.userId}`);
    });
});

// Expose io so controllers can emit if needed
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// ── 5. Start server ───────────────────────────────────────────────────────────
const { startSubscriptionExpiryJob } = require('./src/jobs/subscriptionExpiryJob');

const startServer = async () => {
    try {
        await connectDB();

        // Start background jobs
        startSubscriptionExpiryJob();

        httpServer.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⚡ Socket.io ready`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
};

startServer();
