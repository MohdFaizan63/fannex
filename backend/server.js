require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./src/config/db.js');
const app = require('./src/app.js');
const jwt = require('jsonwebtoken');
const ChatRoom = require('./src/models/ChatRoom.js');
const ChatMessage = require('./src/models/ChatMessage.js');
const { createNotification } = require('./src/services/notificationService.js');

const PORT = process.env.PORT || 8080;

// ── 1. Create HTTP server wrapping Express ────────────────────────────────────
const httpServer = http.createServer(app);

// ── 2. Socket.io setup ────────────────────────────────────────────────────────
const io = new Server(httpServer, {
    cors: {
        origin: (origin, cb) => cb(null, true),
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

    // Broadcast online status to rooms this user belongs to
    socket.broadcast.emit('user_online', { userId: socket.userId, online: true });

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
                const CreatorProfile = require('./src/models/CreatorProfile.js');
                const User = require('./src/models/User.js');
                const Earnings = require('./src/models/Earnings.js');

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

                    // Credit creator earnings
                    await Earnings.findOneAndUpdate(
                        { creatorId: room.creatorId },
                        { $inc: { totalEarned: msgCost, pendingAmount: msgCost } },
                        { upsert: true }
                    );
                }
            }
            // ──────────────────────────────────────────────────────────────────

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

            // Inform sender of deduction + updated balance
            if (!isCreator && newWalletBalance !== null) {
                const CreatorProfile = require('./src/models/CreatorProfile.js');
                const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('messagePrice');
                socket.emit('wallet_deducted', {
                    chatId,
                    deducted: profile?.messagePrice ?? 0,
                    newBalance: newWalletBalance,
                });
            }

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
            const room = await ChatRoom.findById(chatId);
            const isCreator = room?.creatorId.toString() === socket.userId;
            await ChatRoom.findByIdAndUpdate(chatId, {
                [isCreator ? 'unreadByCreator' : 'unreadByUser']: 0,
            });
            // Notify the sender that messages were seen
            socket.to(chatId).emit('messages_seen', { chatId, seenBy: socket.userId });
        } catch (err) {
            console.error('mark_seen error:', err.message);
        }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        onlineUsers.delete(socket.userId);
        socket.broadcast.emit('user_online', { userId: socket.userId, online: false });
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
