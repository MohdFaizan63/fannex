const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const CreatorProfile = require('../models/CreatorProfile');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Earnings = require('../models/Earnings');
const paymentService = require('../services/paymentService');

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SETTINGS (Creator only)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Get creator's own chat settings
// @route GET /api/v1/chat/creator/settings
// @access Creator
const getChatSettings = async (req, res, next) => {
    try {
        const profile = await CreatorProfile.findOne({ userId: req.user._id }).select(
            'chatEnabled chatPrice messagePrice minGift maxGift'
        );
        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found' });
        res.json({ success: true, data: profile });
    } catch (err) { next(err); }
};

// @desc  Update chat pricing settings
// @route PATCH /api/v1/chat/creator/settings
// @access Creator
const updateChatSettings = async (req, res, next) => {
    try {
        const { chatEnabled, chatPrice, messagePrice, minGift, maxGift } = req.body;

        const profile = await CreatorProfile.findOne({ userId: req.user._id });
        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found' });

        if (chatEnabled !== undefined) profile.chatEnabled = chatEnabled;
        if (chatPrice !== undefined) profile.chatPrice = Number(chatPrice);
        if (messagePrice !== undefined) profile.messagePrice = Number(messagePrice);
        if (minGift !== undefined) profile.minGift = Number(minGift);
        if (maxGift !== undefined) profile.maxGift = Number(maxGift);

        await profile.save({ validateModifiedOnly: true });

        res.json({
            success: true,
            data: {
                chatEnabled: profile.chatEnabled,
                chatPrice: profile.chatPrice,
                messagePrice: profile.messagePrice,
                minGift: profile.minGift,
                maxGift: profile.maxGift,
            },
        });
    } catch (err) {
        console.error('updateChatSettings error:', err.message);
        next(err);
    }
};

// @desc  Get chat info for a room: messagePrice + fan wallet balance
// @route GET /api/v1/chat/rooms/:chatId/info
// @access User or Creator in that room
const getChatInfo = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room) return res.status(404).json({ success: false, message: 'Chat room not found' });

        const isParticipant =
            room.userId.toString() === userId.toString() ||
            room.creatorId.toString() === userId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const [profile, fan] = await Promise.all([
            CreatorProfile.findOne({ userId: room.creatorId }).select('messagePrice displayName chatEnabled'),
            User.findById(room.userId).select('walletBalance'),
        ]);

        res.json({
            success: true,
            data: {
                messagePrice: profile?.messagePrice ?? 0,
                walletBalance: fan?.walletBalance ?? 0,
                creatorName: profile?.displayName ?? '',
                chatEnabled: profile?.chatEnabled ?? true,
            },
        });
    } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// CHAT UNLOCK (User)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Cashfree order to unlock a chat room
// @route POST /api/v1/chat/unlock
// @access User (logged in)
const createChatUnlockOrder = async (req, res, next) => {
    try {
        const { creatorId } = req.body;
        const user = req.user;

        // Check existing room
        const existing = await ChatRoom.findOne({ creatorId, userId: user._id });
        if (existing?.isPaid) {
            return res.json({ success: true, alreadyUnlocked: true, chatId: existing._id });
        }

        // Get creator's chat price
        const profile = await CreatorProfile.findOne({ userId: creatorId }).select('chatPrice chatEnabled displayName');
        if (!profile) return res.status(400).json({ success: false, message: 'Creator not found' });
        if (!profile.chatEnabled) {
            return res.status(400).json({ success: false, message: 'Chat not available — creator has disabled chat' });
        }

        const chatPrice = profile.chatPrice || 299;
        const orderId = `cu_${String(user._id).slice(-8)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: chatPrice,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                creatorId: creatorId.toString(),
                type: 'chat_unlock',
            },
        });

        // Save payment record
        await Payment.create({
            userId: user._id,
            creatorId,
            amount: chatPrice,
            type: 'chat_unlock',
            cfOrderId: order.orderId,
            status: 'created',
        });

        res.json({ success: true, order, chatPrice: profile.chatPrice, creatorName: profile.displayName });
    } catch (err) { next(err); }
};

// @desc  Verify Cashfree payment and unlock chat room
// @route POST /api/v1/chat/unlock/verify
// @access User
const verifyChatUnlock = async (req, res, next) => {
    try {
        const { orderId } = req.body;
        const userId = req.user._id;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Payment not completed' });
        }

        // Extract creatorId from order_tags (stored when order was created)
        const tags = orderData.order_tags || {};
        const creatorId = req.body.creatorId || tags.creatorId;

        if (!creatorId) {
            return res.status(400).json({ success: false, message: 'Could not determine creator from order' });
        }

        // Fetch payment ID
        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch (e) {
            console.warn('[verifyChatUnlock] Could not fetch payment details:', e.message);
        }

        // Update payment record
        const payment = await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            { cfPaymentId, status: 'captured' },
            { returnDocument: 'after' }
        );

        // Create or unlock chat room
        const room = await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, chatPaymentId: cfPaymentId, unlockedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );

        if (payment) { payment.chatId = room._id; await payment.save({ validateBeforeSave: false }); }

        // Credit creator earnings
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: payment?.amount || 0, pendingAmount: payment?.amount || 0 } },
            { upsert: true }
        );

        res.json({ success: true, chatId: room._id });
    } catch (err) {
        console.error('[verifyChatUnlock] Error:', err.message);
        if (err.response?.data) {
            console.error('[verifyChatUnlock] API response:', JSON.stringify(err.response.data, null, 2));
        }
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ROOMS & MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Get user's chat rooms (inbox)
// @route GET /api/v1/chat/rooms
// @access User
const getUserRooms = async (req, res, next) => {
    try {
        const rooms = await ChatRoom.find({ userId: req.user._id, isPaid: true })
            .sort({ lastMessageAt: -1 })
            .populate({ path: 'creatorId', select: 'name', model: 'User' })
            .lean();

        // Enrich with creator profile images
        const enriched = await Promise.all(rooms.map(async (r) => {
            const cp = await CreatorProfile.findOne({ userId: r.creatorId?._id }).select('displayName profileImage chatPrice username');
            return { ...r, creatorProfile: cp };
        }));

        res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
};

// @desc  Get creator's chat rooms (inbox)
// @route GET /api/v1/chat/creator/rooms
// @access Creator
const getCreatorRooms = async (req, res, next) => {
    try {
        const rooms = await ChatRoom.find({ creatorId: req.user._id, isPaid: true })
            .sort({ lastMessageAt: -1 })
            .populate({ path: 'userId', select: 'name email', model: 'User' })
            .lean();

        res.json({ success: true, data: rooms });
    } catch (err) { next(err); }
};

// @desc  Get creator chat stats
// @route GET /api/v1/chat/creator/stats
// @access Creator
const getCreatorChatStats = async (req, res, next) => {
    try {
        const creatorId = req.user._id;
        const [totalChats, unreadCount, giftEarnings, chatUnlockEarnings] = await Promise.all([
            ChatRoom.countDocuments({ creatorId, isPaid: true }),
            ChatRoom.aggregate([
                { $match: { creatorId, isPaid: true } },
                { $group: { _id: null, total: { $sum: '$unreadByCreator' } } },
            ]),
            Payment.aggregate([
                { $match: { creatorId, type: 'gift', status: 'captured' } },
                { $group: { _id: null, total: { $sum: '$giftAmount' } } },
            ]),
            Payment.aggregate([
                { $match: { creatorId, type: 'chat_unlock', status: 'captured' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                totalChats,
                unreadMessages: unreadCount[0]?.total ?? 0,
                giftEarnings: giftEarnings[0]?.total ?? 0,
                chatUnlockEarnings: chatUnlockEarnings[0]?.total ?? 0,
                totalChatEarnings: (giftEarnings[0]?.total ?? 0) + (chatUnlockEarnings[0]?.total ?? 0),
            },
        });
    } catch (err) { next(err); }
};

// @desc  Get messages for a chat room (paginated)
// @route GET /api/v1/chat/rooms/:chatId/messages
// @access Creator or User in that room
const getRoomMessages = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room) return res.status(404).json({ success: false, message: 'Chat room not found' });

        // Auth check — only the two participants can read
        const isParticipant =
            room.userId.toString() === userId.toString() ||
            room.creatorId.toString() === userId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const messages = await ChatMessage.find({ chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Mark messages as seen
        const isCreator = room.creatorId.toString() === userId.toString();
        await ChatMessage.updateMany(
            { chatId, senderId: { $ne: userId }, seen: false },
            { seen: true, seenAt: new Date() }
        );
        // Reset unread counter
        const unreadField = isCreator ? 'unreadByCreator' : 'unreadByUser';
        await ChatRoom.findByIdAndUpdate(chatId, { [unreadField]: 0 });

        res.json({ success: true, data: messages.reverse(), page, limit });
    } catch (err) { next(err); }
};

// @desc  Save a text/image/voice message (REST fallback — primary path is Socket.io)
// @route POST /api/v1/chat/rooms/:chatId/messages
// @access Creator or User in that room
const sendMessage = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { type = 'text', content } = req.body;
        const senderId = req.user._id;

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });

        const isParticipant =
            room.userId.toString() === senderId.toString() ||
            room.creatorId.toString() === senderId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const isCreator = room.creatorId.toString() === senderId.toString();

        // ── Wallet deduction for fan messages ─────────────────────────────────
        if (!isCreator) {
            const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('chatPrice');
            const msgCost = profile?.chatPrice ?? 0;

            if (msgCost > 0) {
                const fan = await User.findById(senderId).select('walletBalance');
                if (!fan || (fan.walletBalance ?? 0) < msgCost) {
                    return res.status(402).json({
                        success: false,
                        message: 'Insufficient wallet balance. Please top up to continue chatting.',
                        required: msgCost,
                        walletBalance: fan?.walletBalance ?? 0,
                    });
                }
                // Deduct from wallet and credit creator
                await User.findByIdAndUpdate(senderId, { $inc: { walletBalance: -msgCost } });
                await Earnings.findOneAndUpdate(
                    { creatorId: room.creatorId },
                    { $inc: { totalEarned: msgCost, pendingAmount: msgCost } },
                    { upsert: true }
                );
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        const message = await ChatMessage.create({ chatId, senderId, type, content });

        // Update room's last message
        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: content,
            lastMessageAt: new Date(),
            lastMessageType: type,
            $inc: { [isCreator ? 'unreadByUser' : 'unreadByCreator']: 1 },
        });

        res.status(201).json({ success: true, data: message });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Cashfree order for a gift
// @route POST /api/v1/chat/gift/order
// @access User
const createGiftOrder = async (req, res, next) => {
    try {
        const { chatId, amount } = req.body;
        const user = req.user;

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });
        if (room.userId.toString() !== user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Only the fan can send gifts' });
        }

        const profile = await CreatorProfile.findOne({ userId: room.creatorId }).select('minGift maxGift');
        if (profile) {
            if (amount < profile.minGift) return res.status(400).json({ success: false, message: `Minimum gift is ₹${profile.minGift}` });
            if (amount > profile.maxGift) return res.status(400).json({ success: false, message: `Maximum gift is ₹${profile.maxGift}` });
        }

        const orderId = `gf_${String(chatId).slice(-8)}_${Date.now()}`;
        const order = await paymentService.createOrder({
            amount,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: { userId: user._id.toString(), creatorId: room.creatorId.toString(), type: 'gift', chatId: String(chatId) },
        });

        await Payment.create({
            userId: user._id,
            creatorId: room.creatorId,
            amount,
            giftAmount: amount,
            type: 'gift',
            chatId,
            cfOrderId: order.orderId,
            status: 'created',
        });

        res.json({ success: true, order });
    } catch (err) { next(err); }
};

// @desc  Verify gift payment and save gift message
// @route POST /api/v1/chat/gift/verify
// @access User
const verifyGift = async (req, res, next) => {
    try {
        const { orderId, chatId, amount } = req.body;
        const userId = req.user._id;

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Gift payment not completed' });
        }
        const cfPaymentId = orderData.payments?.[0]?.cf_payment_id?.toString() || null;

        // Update payment
        const payment = await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            { cfPaymentId, status: 'captured' },
            { returnDocument: 'after' }
        );

        const room = await ChatRoom.findById(chatId);

        // Save gift message
        const message = await ChatMessage.create({
            chatId,
            senderId: userId,
            type: 'gift',
            content: `Sent a gift of ₹${amount}`,
            giftAmount: amount,
            giftPaymentId: cfPaymentId,
        });

        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: `🎁 ₹${amount} gift`,
            lastMessageAt: new Date(),
            lastMessageType: 'gift',
            $inc: { unreadByCreator: 1 },
        });

        if (room) {
            await Earnings.findOneAndUpdate(
                { creatorId: room.creatorId },
                { $inc: { totalEarned: amount, pendingAmount: amount } },
                { upsert: true }
            );
        }

        res.json({ success: true, data: message });
    } catch (err) { next(err); }
};

// @desc  Check if user has paid for a chat with a creator
// @route GET /api/v1/chat/status/:creatorId
// @access User (logged in)
const getChatStatus = async (req, res, next) => {
    try {
        const { creatorId } = req.params;
        const userId = req.user._id;

        const room = await ChatRoom.findOne({ creatorId, userId });
        const profile = await CreatorProfile.findOne({ userId: creatorId })
            .select('chatEnabled chatPrice minGift maxGift displayName profileImage username');

        res.json({
            success: true,
            data: {
                isPaid: room?.isPaid ?? false,
                chatId: room?._id ?? null,
                profile,
            },
        });
    } catch (err) { next(err); }
};

// @desc  Upload an image and send it as a chat message
// @route POST /api/v1/chat/rooms/:chatId/upload-image
// @access Creator or User in that room
const sendImageMessage = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const senderId = req.user._id;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const room = await ChatRoom.findById(chatId);
        if (!room || !room.isPaid) return res.status(403).json({ success: false, message: 'Chat not unlocked' });

        const isParticipant =
            room.userId.toString() === senderId.toString() ||
            room.creatorId.toString() === senderId.toString();
        if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

        const isCreator = room.creatorId.toString() === senderId.toString();

        // Determine image URL (Cloudinary or local fallback)
        const imageUrl = req.file.path || req.file.secure_url || req.file.location || '';

        const message = await ChatMessage.create({
            chatId,
            senderId,
            type: 'image',
            content: imageUrl,
        });

        await ChatRoom.findByIdAndUpdate(chatId, {
            lastMessage: '📷 Image',
            lastMessageAt: new Date(),
            lastMessageType: 'image',
            $inc: { [isCreator ? 'unreadByUser' : 'unreadByCreator']: 1 },
        });

        // Broadcast via socket so the other participant sees it in real time
        const io = req.app.get('io');
        if (io) {
            io.to(String(chatId)).emit('new_message', message.toObject ? message.toObject() : message);
        }

        res.status(201).json({ success: true, data: message });
    } catch (err) { next(err); }
};

module.exports = {
    getChatSettings,
    updateChatSettings,
    getChatInfo,
    createChatUnlockOrder,
    verifyChatUnlock,
    getUserRooms,
    getCreatorRooms,
    getCreatorChatStats,
    getRoomMessages,
    sendMessage,
    sendImageMessage,
    createGiftOrder,
    verifyGift,
    getChatStatus,
};

