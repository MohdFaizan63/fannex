const path = require('path');
// Always load .env relative to THIS file so it works regardless of CWD
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Startup diagnostic (masked) — remove after confirming creds work ───────
console.log('[✔] ENV check:');
console.log('  CASHFREE_APP_ID   :', process.env.CASHFREE_APP_ID
    ? process.env.CASHFREE_APP_ID.slice(0, 6) + '****' + process.env.CASHFREE_APP_ID.slice(-4)
    : '❌ NOT SET');
console.log('  CASHFREE_SECRET_KEY:', process.env.CASHFREE_SECRET_KEY
    ? process.env.CASHFREE_SECRET_KEY.slice(0, 8) + '****'
    : '❌ NOT SET');
console.log('  CASHFREE_ENV      :', process.env.CASHFREE_ENV || 'production (default)');
// ─────────────────────────────────────────────────────────────────────

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

                    // Credit creator earnings
                    await Earnings.findOneAndUpdate(
                        { creatorId: room.creatorId },
                        { $inc: { totalEarned: msgCost, pendingAmount: msgCost } },
                        { upsert: true }
                    );

                    // ✅ FIX 2: Create a Payment doc per message so it shows in Earning History
                    // Use fire-and-forget so it doesn't block the message delivery path
                    const base = Math.round(msgCost / 1.18 * 100) / 100;
                    const creatorEarning = msgCost; // wallet deductions pass through fully — no extra GST
                    Payment.create({
                        userId: room.userId,
                        creatorId: room.creatorId,
                        chatId: room._id,
                        amount: msgCost,
                        baseAmount: base,
                        gstAmount: 0,
                        platformFee: 0,
                        creatorEarning,
                        type: 'chat_unlock',         // reuse chat_unlock so it appears in Chat tab
                        status: 'captured',
                        cfOrderId: `msg_${String(socket.userId).slice(-6)}_${Date.now()}`,
                        sideEffectsDone: true,
                    }).catch((err) => console.warn('[payment/msg] create failed:', err.message));
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
            // Single DB call: update + learn isCreator at once
            const room = await ChatRoom.findByIdAndUpdate(
                chatId,
                {},
                { new: false }
            );
            if (room) {
                const isCreator = room.creatorId.toString() === socket.userId;
                await ChatRoom.findByIdAndUpdate(chatId, {
                    [isCreator ? 'unreadByCreator' : 'unreadByUser']: 0,
                });
            }
            // Notify the sender that messages were seen
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
